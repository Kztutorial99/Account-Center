const crypto = require("crypto");
const {
  db, ensureTables, hashPassword, verifyPassword,
  setSession, clearSession, currentUser, bodyOf, text,
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
        RETURNING id, name, email, phone, balance, created_at AS "createdAt"
      `;
      setSession(response, id);
      return response.status(201).json({ user: { ...rows[0], balance: Number(rows[0].balance) || 0 } });
    }

    const rows = await sql`
      SELECT id, name, email, phone, balance, status, password_hash AS "passwordHash", created_at AS "createdAt"
      FROM codexa_users WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];
    if (!row || !verifyPassword(password, row.passwordHash)) {
      return response.status(401).json({ error: "Email atau password salah" });
    }
    if (row.status && row.status !== "active") {
      return response.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
    }
    setSession(response, row.id);
    return response.status(200).json({
      user: {
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        balance: Number(row.balance) || 0, createdAt: row.createdAt,
      },
    });
  } catch (error) {
    console.error("Auth failure", error && error.message);
    return response.status(500).json({ error: "Layanan akun sedang bermasalah" });
  }
};
