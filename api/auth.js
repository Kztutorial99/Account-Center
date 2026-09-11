const crypto = require("crypto");
const {
  db, ensureTables, hashPassword, verifyPassword,
  setSession, clearSession, sessionUserId, currentUser, bodyOf, text,
  clientIp, rateLimit, resetRateLimit,
} = require("./_users");

const { verifyFirebaseIdToken } = require("./_firebase");
const { verifyGoogleAccessToken } = require("./_google");
const { createVerificationToken, sendVerificationEmail } = require("./_email-verification");

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

    if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Format email tidak valid" });
    if (password.length < 6) return response.status(400).json({ error: "Password minimal 6 karakter" });

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
      const verification = createVerificationToken();
      await sql`
        UPDATE codexa_users
        SET verification_token_hash = ${verification.hash}, verification_expires_at = ${verification.expiresAt}
        WHERE id = ${user.id}
      `;
      await sendVerificationEmail({ request, email, name: user.name, token: verification.token });
      await resetRateLimit(sql, throttleKey);
      return response.status(200).json({ message: "Link verifikasi baru sudah dikirim. Cek inbox atau folder spam." });
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
      return response.status(201).json({
        verificationRequired: true,
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

