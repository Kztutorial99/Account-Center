const crypto = require("crypto");
const {
  db, ensureTables, hashPassword, verifyPassword,
  setSession, clearSession, currentUser, bodyOf, text,
  clientIp, rateLimit, resetRateLimit,
} = require("./_users");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(request, response) {
  try {
    const sql = db();
    await ensureTables(sql);

    if (request.method === "GET") {
      const user = await currentUser(sql, request);
      return response.status(200).json({ user });
    }

    if (request.method === "DELETE") {
      clearSession(response);
      return response.status(200).json({ ok: true });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST, DELETE");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const body = bodyOf(request);
    const action = text(body.action, 20) || "login";
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

    if (action === "register") {
      const name = text(body.name, 80);
      const phone = text(body.phone, 30);
      if (name.length < 2) return response.status(400).json({ error: "Nama minimal 2 karakter" });

      const existing = await sql`SELECT id FROM codexa_users WHERE email = ${email} LIMIT 1`;
      if (existing.length) return response.status(409).json({ error: "Email sudah terdaftar, silakan masuk" });

      const id = crypto.randomUUID();
      const rows = await sql`
        INSERT INTO codexa_users (id, name, email, phone, password_hash, balance)
        VALUES (${id}, ${name}, ${email}, ${phone}, ${hashPassword(password)}, 0)
        RETURNING id, name, email, phone, balance, role, created_at AS "createdAt"
      `;
      await resetRateLimit(sql, throttleKey);
      setSession(response, id);
      return response.status(201).json({
        user: { ...rows[0], balance: Number(rows[0].balance) || 0, role: rows[0].role === "admin" ? "admin" : "user" },
      });
    }

    const rows = await sql`
      SELECT id, name, email, phone, balance, status, role, password_hash AS "passwordHash", created_at AS "createdAt"
      FROM codexa_users WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];
    if (!row || !verifyPassword(password, row.passwordHash)) {
      return response.status(401).json({ error: "Email atau password salah" });
    }
    if (row.status && row.status !== "active") {
      return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
    }
    await resetRateLimit(sql, throttleKey);
    setSession(response, row.id);
    return response.status(200).json({
      user: {
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        balance: Number(row.balance) || 0, createdAt: row.createdAt,
        role: row.role === "admin" ? "admin" : "user",
      },
    });
  } catch (error) {
    console.error("Auth failure", error && error.message);
    return response.status(500).json({ error: "Layanan akun sedang bermasalah" });
  }
};
