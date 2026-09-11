const crypto = require("crypto");
const {
  db, ensureTables, hashPassword, verifyPassword,
  setSession, clearSession, sessionUserId, currentUser, bodyOf, text,
  clientIp, rateLimit, resetRateLimit,
} = require("./_users");

const { verifyFirebaseIdToken } = require("./_firebase");
const { verifyGoogleAccessToken } = require("./_google");
const {
  createVerificationToken, hashVerificationToken, sendVerificationEmail,
  createResetToken, sendPasswordResetEmail,
} = require("./_email-verification");
const { verifyCaptcha } = require("./_turnstile");

/* Form publik yang wajib lewat captcha Cloudflare Turnstile. */
const CAPTCHA_ACTIONS = new Set(["register", "resend-verification", "forgot-password"]);

const RESEND_COOLDOWN_SEC = 60;
const RESEND_HOURLY_CAP = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const shapeUser = (row) => ({
  id: row.id, name: row.name, email: row.email, phone: row.phone || "",
  avatar: row.avatar || "", balance: Number(row.balance) || 0,
  createdAt: row.createdAt, role: row.role === "admin" ? "admin" : "user",
  provider: row.provider === "google" ? "google" : "email",
});

module.exports = async function handler(request, response) {
  try {
    const sql = db();
    await ensureTables(sql);

    if (request.method === "GET") {
      const token = request.query && typeof request.query.verify === "string" ? request.query.verify : "";
      if (token) {
        if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
          return response.redirect(302, "/status-verifikasi?verification=invalid");
        }
        const tokenHash = hashVerificationToken(token);
        const verified = await sql`
          UPDATE codexa_users
          SET email_verified_at = NOW(), verification_token_hash = NULL, verification_expires_at = NULL
          WHERE verification_token_hash = ${tokenHash}
            AND verification_expires_at > NOW()
            AND email_verified_at IS NULL
          RETURNING id
        `;
        return response.redirect(302, verified.length
          ? "/status-verifikasi?verification=success"
          : "/status-verifikasi?verification=invalid");
      }
      const user = await currentUser(sql, request);
      return response.status(200).json({ user });
    }

    /* Update profil sendiri: nama, nomor WhatsApp, dan foto profil. */
    if (request.method === "PATCH" || request.method === "PUT") {
      const uid = sessionUserId(request);
      if (!uid) return response.status(401).json({ error: "Silakan masuk dulu" });
      const body = bodyOf(request);
      const name = text(body.name, 80);
      const phone = text(body.phone, 30);
      const avatarRaw = typeof body.avatar === "string" ? body.avatar.trim() : "";
      if (name.length < 2) return response.status(400).json({ error: "Nama minimal 2 karakter" });
      if (phone && !/^[0-9+()\s-]{6,25}$/.test(phone)) {
        return response.status(400).json({ error: "Nomor WhatsApp tidak valid" });
      }
      if (avatarRaw && !/^data:image\/(png|jpeg|webp);base64,/.test(avatarRaw)) {
        return response.status(400).json({ error: "Foto profil harus berupa gambar" });
      }
      if (avatarRaw.length > 400000) return response.status(413).json({ error: "Foto profil terlalu besar" });
      const avatar = body.avatar === null ? "" : avatarRaw;
      const rows = body.avatar === undefined
        ? await sql`
            UPDATE codexa_users SET name = ${name}, phone = ${phone} WHERE id = ${uid}
            RETURNING id, name, email, phone, balance, role, avatar, provider, created_at AS "createdAt"`
        : await sql`
            UPDATE codexa_users SET name = ${name}, phone = ${phone}, avatar = ${avatar} WHERE id = ${uid}
            RETURNING id, name, email, phone, balance, role, avatar, provider, created_at AS "createdAt"`;
      if (!rows.length) return response.status(404).json({ error: "Akun tidak ditemukan" });
      const row = rows[0];
      return response.status(200).json({
        user: { ...row, balance: Number(row.balance) || 0, role: row.role === "admin" ? "admin" : "user", provider: row.provider === "google" ? "google" : "email" },
      });
    }

    if (request.method === "DELETE") {
      clearSession(response);
      return response.status(200).json({ ok: true });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const body = bodyOf(request);
    const action = text(body.action, 20) || "login";

    /* Captcha: dilewati untuk permintaan reset dari user yang sudah login
       (halaman profil), karena sesinya sudah terverifikasi. */
    if (CAPTCHA_ACTIONS.has(action) && !(action === "forgot-password" && sessionUserId(request))) {
      const captcha = await verifyCaptcha(body.captchaToken, clientIp(request));
      if (!captcha.ok) {
        return response.status(400).json({ error: captcha.error, code: "CAPTCHA_FAILED" });
      }
    }

    /* Login/daftar lewat Google (Firebase). Akun dicocokkan berdasarkan email,
       jadi user lama tetap dapat saldo & riwayat pesanannya. */
    if (action === "google") {
      const gate = await rateLimit(sql, {
        key: `auth:google:${clientIp(request)}`, limit: 20, windowSec: 300,
      });
      if (!gate.allowed) {
        response.setHeader("Retry-After", String(gate.retryAfter));
        return response.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${gate.retryAfter} detik.` });
      }

      let profile;
      try {
        profile = body.accessToken
          ? await verifyGoogleAccessToken(body.accessToken)
          : await verifyFirebaseIdToken(body.idToken);
      } catch (err) {
        return response.status(401).json({ error: err.message || "Login Google gagal" });
      }

      const existing = await sql`
        SELECT id, name, email, phone, balance, status, role, avatar, provider, created_at AS "createdAt"
        FROM codexa_users WHERE email = ${profile.email} LIMIT 1
      `;

      if (existing.length) {
        const row = existing[0];
        if (row.status && row.status !== "active") {
          return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
        }
        /* Tandai sebagai akun Google & lengkapi foto profil kalau masih kosong. */
        if (row.provider !== "google") {
          await sql`UPDATE codexa_users SET provider = 'google' WHERE id = ${row.id}`;
          row.provider = "google";
        }
        if (!row.avatar && profile.picture) {
          await sql`UPDATE codexa_users SET avatar = ${profile.picture} WHERE id = ${row.id}`;
          row.avatar = profile.picture;
        }
        setSession(response, row.id);
        return response.status(200).json({ user: shapeUser(row) });
      }

      const id = crypto.randomUUID();
      const name = profile.name || profile.email.split("@")[0];
      /* Akun Google tidak punya password lokal: isi hash acak yang tidak bisa dipakai login. */
      const randomPass = crypto.randomBytes(24).toString("hex");
      const created = await sql`
        INSERT INTO codexa_users (id, name, email, phone, password_hash, balance, avatar, provider)
        VALUES (${id}, ${name}, ${profile.email}, '', ${hashPassword(randomPass)}, 0, ${profile.picture || ""}, 'google')
        RETURNING id, name, email, phone, balance, role, avatar, provider, created_at AS "createdAt"
      `;
      return setSession(response, id), response.status(201).json({ user: shapeUser(created[0]) });
    }
    const email = text(body.email, 160).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    /* Ganti password langsung dari halaman profil (tanpa link email).
       Wajib sudah login dan tahu password lama. */
    if (action === "change-password") {
      const uid = sessionUserId(request);
      if (!uid) return response.status(401).json({ error: "Silakan masuk dulu" });
      const gate = await rateLimit(sql, { key: `auth:change-pass:${uid}`, limit: 10, windowSec: 600 });
      if (!gate.allowed) {
        response.setHeader("Retry-After", String(gate.retryAfter));
        return response.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${gate.retryAfter} detik.` });
      }
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (password.length < 6) return response.status(400).json({ error: "Password baru minimal 6 karakter" });
      const rows = await sql`
        SELECT id, provider, status, password_hash AS "passwordHash"
        FROM codexa_users WHERE id = ${uid} LIMIT 1
      `;
      const me = rows[0];
      if (!me) return response.status(404).json({ error: "Akun tidak ditemukan" });
      if (me.status && me.status !== "active") {
        return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
      }
      if (me.provider === "google") {
        return response.status(400).json({ error: "Akun Google tidak memakai password" });
      }
      if (!verifyPassword(currentPassword, me.passwordHash)) {
        return response.status(400).json({ error: "Password saat ini salah" });
      }
      if (verifyPassword(password, me.passwordHash)) {
        return response.status(400).json({ error: "Password baru harus berbeda dari password lama" });
      }
      await sql`
        UPDATE codexa_users
        SET password_hash = ${hashPassword(password)}, reset_token_hash = NULL, reset_expires_at = NULL
        WHERE id = ${uid}
      `;
      return response.status(200).json({ message: "Password berhasil diganti" });
    }


    /* Lupa password: kirim link reset ke email (jawaban selalu sama supaya
       email yang terdaftar tidak bisa ditebak dari respons). */
    if (action === "forgot-password") {
      if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Format email tidak valid" });
      const gate = await rateLimit(sql, { key: `auth:forgot:${clientIp(request)}`, limit: 8, windowSec: 600 });
      if (!gate.allowed) {
        response.setHeader("Retry-After", String(gate.retryAfter));
        return response.status(429).json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${gate.retryAfter} detik.`, retryAfter: gate.retryAfter });
      }
      const rows = await sql`SELECT id, name, provider, status FROM codexa_users WHERE email = ${email} LIMIT 1`;
      const user = rows[0];
      if (!user) {
        return response.status(404).json({ error: "Email ini belum terdaftar di sistem kami. Periksa kembali atau daftar akun baru.", code: "EMAIL_NOT_REGISTERED" });
      }
      if (user.provider === "google") {
        return response.status(400).json({ error: "Akun ini memakai Masuk dengan Google, jadi tidak punya password. Silakan masuk lewat Google.", code: "GOOGLE_ACCOUNT" });
      }
      if (user.status && user.status !== "active") {
        return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
      }
      /* Jeda 60 detik antar kiriman + maksimal 5 link per jam per email. */
      const coolKey = `auth:forgot-cool:${email}`;
      const cool = await rateLimit(sql, { key: coolKey, limit: 1, windowSec: RESEND_COOLDOWN_SEC });
      if (!cool.allowed) {
        response.setHeader("Retry-After", String(cool.retryAfter));
        return response.status(429).json({ error: `Link reset baru bisa dikirim lagi dalam ${cool.retryAfter} detik.`, retryAfter: cool.retryAfter });
      }
      const cap = await rateLimit(sql, { key: `auth:forgot-cap:${email}`, limit: RESEND_HOURLY_CAP, windowSec: 3600 });
      if (!cap.allowed) {
        response.setHeader("Retry-After", String(cap.retryAfter));
        return response.status(429).json({ error: `Batas ${RESEND_HOURLY_CAP} permintaan per jam tercapai. Coba lagi dalam ${Math.ceil(cap.retryAfter / 60)} menit.`, retryAfter: cap.retryAfter });
      }
      const reset = createResetToken();
      await sql`
        UPDATE codexa_users
        SET reset_token_hash = ${reset.hash}, reset_expires_at = ${reset.expiresAt}
        WHERE id = ${user.id}
      `;
      try {
        await sendPasswordResetEmail({ request, email, name: user.name, token: reset.token });
      } catch (error) {
        console.error("Reset email failure", error && error.message);
        await resetRateLimit(sql, coolKey);
        return response.status(502).json({ error: "Email reset password gagal dikirim. Coba lagi sebentar." });
      }
      return response.status(200).json({
        message: "Link reset password sudah dikirim ke email kamu. Cek inbox atau folder spam.",
        retryAfter: RESEND_COOLDOWN_SEC,
      });
    }

    /* Simpan password baru memakai token dari link email. */
    if (action === "reset-password") {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const gate = await rateLimit(sql, { key: `auth:reset:${clientIp(request)}`, limit: 20, windowSec: 600 });
      if (!gate.allowed) {
        response.setHeader("Retry-After", String(gate.retryAfter));
        return response.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${gate.retryAfter} detik.` });
      }
      if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
        return response.status(400).json({ error: "Link reset tidak valid atau sudah kedaluwarsa" });
      }
      if (password.length < 6) return response.status(400).json({ error: "Password minimal 6 karakter" });
      const tokenHash = hashVerificationToken(token);
      const updated = await sql`
        UPDATE codexa_users
        SET password_hash = ${hashPassword(password)},
            reset_token_hash = NULL,
            reset_expires_at = NULL,
            email_verified_at = COALESCE(email_verified_at, NOW())
        WHERE reset_token_hash = ${tokenHash}
          AND reset_expires_at > NOW()
          AND status = 'active'
        RETURNING id, name, email, phone, balance, role, avatar, provider, created_at AS "createdAt"
      `;
      if (!updated.length) {
        return response.status(400).json({ error: "Link reset tidak valid atau sudah kedaluwarsa" });
      }
      const row = updated[0];
      setSession(response, row.id);
      return response.status(200).json({ user: shapeUser(row) });
    }

    if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Format email tidak valid" });
    if (password.length < 6) return response.status(400).json({ error: "Password minimal 6 karakter" });

    /* Halaman /email-verifikasi memeriksa berkala apakah link sudah diklik.
       Kalau sudah, sesi langsung dibuat supaya user tidak perlu login lagi. */
    if (action === "verify-status") {
      const pollKey = `auth:verify-status:${clientIp(request)}:${email}`;
      const pollGate = await rateLimit(sql, { key: pollKey, limit: 120, windowSec: 300 });
      if (!pollGate.allowed) {
        response.setHeader("Retry-After", String(pollGate.retryAfter));
        return response.status(429).json({ error: "Terlalu sering memeriksa. Tunggu sebentar ya." });
      }
      const rows = await sql`
        SELECT id, name, email, phone, balance, status, role, avatar, provider,
               email_verified_at AS "emailVerifiedAt", password_hash AS "passwordHash",
               created_at AS "createdAt"
        FROM codexa_users WHERE email = ${email} LIMIT 1
      `;
      const row = rows[0];
      if (!row || !verifyPassword(password, row.passwordHash)) {
        return response.status(401).json({ error: "Email atau password salah" });
      }
      if (row.status && row.status !== "active") {
        return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
      }
      if (!row.emailVerifiedAt && row.provider !== "google") {
        return response.status(200).json({ verified: false });
      }
      await resetRateLimit(sql, pollKey);
      setSession(response, row.id);
      return response.status(200).json({ verified: true, user: shapeUser(row) });
    }

    // Tahan brute force: maksimal 10 percobaan per 5 menit per IP+email.
    const throttleKey = `auth:${action}:${clientIp(request)}:${email}`;
    const gate = await rateLimit(sql, { key: throttleKey, limit: 10, windowSec: 300 });
    if (!gate.allowed) {
      response.setHeader("Retry-After", String(gate.retryAfter));
      return response.status(429).json({
        error: `Terlalu banyak percobaan. Coba lagi dalam ${gate.retryAfter} detik.`,
      });
    }

    if (action === "resend-verification") {
      const rows = await sql`
        SELECT id, name, provider, email_verified_at AS "emailVerifiedAt", password_hash AS "passwordHash"
        FROM codexa_users WHERE email = ${email} LIMIT 1
      `;
      const user = rows[0];
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return response.status(401).json({ error: "Email atau password salah" });
      }
      if (user.provider === "google" || user.emailVerifiedAt) {
        return response.status(200).json({ message: "Email akun ini sudah terverifikasi." });
      }
      /* Jeda 60 detik antar kiriman + maksimal 5 link per jam per email. */
      const coolKey = `auth:resend-cool:${email}`;
      const cool = await rateLimit(sql, { key: coolKey, limit: 1, windowSec: RESEND_COOLDOWN_SEC });
      if (!cool.allowed) {
        response.setHeader("Retry-After", String(cool.retryAfter));
        return response.status(429).json({ error: `Tunggu ${cool.retryAfter} detik sebelum mengirim link verifikasi lagi.`, retryAfter: cool.retryAfter });
      }
      const cap = await rateLimit(sql, { key: `auth:resend-cap:${email}`, limit: RESEND_HOURLY_CAP, windowSec: 3600 });
      if (!cap.allowed) {
        response.setHeader("Retry-After", String(cap.retryAfter));
        return response.status(429).json({ error: `Batas ${RESEND_HOURLY_CAP} pengiriman per jam tercapai. Coba lagi dalam ${Math.ceil(cap.retryAfter / 60)} menit.`, retryAfter: cap.retryAfter });
      }
      const verification = createVerificationToken();
      await sql`
        UPDATE codexa_users
        SET verification_token_hash = ${verification.hash}, verification_expires_at = ${verification.expiresAt}
        WHERE id = ${user.id}
      `;
      try {
        await sendVerificationEmail({ request, email, name: user.name, token: verification.token });
      } catch (error) {
        await resetRateLimit(sql, coolKey);
        throw error;
      }
      await resetRateLimit(sql, throttleKey);
      return response.status(200).json({
        message: "Link verifikasi baru sudah dikirim. Cek inbox atau folder spam.",
        retryAfter: RESEND_COOLDOWN_SEC,
      });
    }

    if (action === "register") {
      const name = text(body.name, 80);
      const phone = text(body.phone, 30);
      if (name.length < 2) return response.status(400).json({ error: "Nama minimal 2 karakter" });

      const existing = await sql`SELECT id FROM codexa_users WHERE email = ${email} LIMIT 1`;
      if (existing.length) return response.status(409).json({ error: "Email sudah terdaftar, silakan masuk" });

      const id = crypto.randomUUID();
      const verification = createVerificationToken();
      const rows = await sql`
        INSERT INTO codexa_users (
          id, name, email, phone, password_hash, balance, provider,
          email_verified_at, verification_token_hash, verification_expires_at
        )
        VALUES (
          ${id}, ${name}, ${email}, ${phone}, ${hashPassword(password)}, 0, 'email',
          NULL, ${verification.hash}, ${verification.expiresAt}
        )
        RETURNING id, name, email, phone, balance, role, avatar, provider, created_at AS "createdAt"
      `;
      try {
        await sendVerificationEmail({ request, email, name, token: verification.token });
      } catch (error) {
        await sql`DELETE FROM codexa_users WHERE id = ${id} AND email_verified_at IS NULL`;
        throw error;
      }
      await resetRateLimit(sql, throttleKey);
      await rateLimit(sql, { key: `auth:resend-cool:${email}`, limit: 1, windowSec: RESEND_COOLDOWN_SEC });
      return response.status(201).json({
        verificationRequired: true,
        retryAfter: RESEND_COOLDOWN_SEC,
        message: "Link verifikasi sudah dikirim. Cek inbox atau folder spam sebelum masuk.",
      });
    }

    const rows = await sql`
      SELECT id, name, email, phone, balance, status, role, avatar, provider,
             email_verified_at AS "emailVerifiedAt", password_hash AS "passwordHash", created_at AS "createdAt"
      FROM codexa_users WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];
    if (!row || !verifyPassword(password, row.passwordHash)) {
      return response.status(401).json({ error: "Email atau password salah" });
    }
    if (row.status && row.status !== "active") {
      return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
    }
    if (row.provider !== "google" && !row.emailVerifiedAt) {
      return response.status(403).json({
        error: "Email belum diverifikasi. Buka link yang kami kirim ke email kamu.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }
    await resetRateLimit(sql, throttleKey);
    setSession(response, row.id);
    return response.status(200).json({
      user: {
        id: row.id, name: row.name, email: row.email, phone: row.phone, avatar: row.avatar || "",
        balance: Number(row.balance) || 0, createdAt: row.createdAt,
        role: row.role === "admin" ? "admin" : "user",
        provider: row.provider === "google" ? "google" : "email",
      },
    });
  } catch (error) {
    console.error("Auth failure", error && error.message);
    return response.status(500).json({ error: "Layanan akun sedang bermasalah" });
  }
};

