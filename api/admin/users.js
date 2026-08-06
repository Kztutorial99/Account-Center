const { db, ensureTables, hashPassword, bodyOf, text } = require("../_users");
const { isAdmin } = require("./_auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ["active", "suspended", "banned"];

module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Sesi admin tidak valid" });
  try {
    const sql = db();
    await ensureTables(sql);

    /* ── LIST ── */
    if (request.method === "GET") {
      const users = await sql`
        SELECT u.id, u.name, u.email, u.phone, u.balance, u.status, u.note,
               u.created_at AS "createdAt",
               COALESCE(SUM(CASE WHEN t.status = 'approved' THEN t.amount ELSE 0 END), 0) AS "topupTotal",
               COUNT(t.id) FILTER (WHERE t.status = 'pending') AS "pendingCount",
               MAX(t.created_at) AS "lastTopupAt"
        FROM codexa_users u
        LEFT JOIN codexa_topups t ON t.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 500
      `;
      return response.status(200).json({
        users: users.map((u) => ({
          ...u,
          balance: Number(u.balance) || 0,
          topupTotal: Number(u.topupTotal) || 0,
          pendingCount: Number(u.pendingCount) || 0,
          status: u.status || "active",
        })),
      });
    }

    const body = bodyOf(request);
    const id = text(body.id, 60);

    /* ── DELETE ── */
    if (request.method === "DELETE") {
      if (!id) return response.status(400).json({ error: "ID user wajib diisi" });
      const rows = await sql`DELETE FROM codexa_users WHERE id = ${id} RETURNING id`;
      if (!rows.length) return response.status(404).json({ error: "User tidak ditemukan" });
      return response.status(200).json({ ok: true });
    }

    if (request.method !== "PATCH") {
      response.setHeader("Allow", "GET, PATCH, DELETE");
      return response.status(405).json({ error: "Method not allowed" });
    }

    /* ── UPDATE ── */
    if (!id) return response.status(400).json({ error: "ID user wajib diisi" });
    const existing = await sql`SELECT id FROM codexa_users WHERE id = ${id} LIMIT 1`;
    if (!existing.length) return response.status(404).json({ error: "User tidak ditemukan" });

    // aksi cepat: ubah status saja
    const action = text(body.action, 20);
    if (action) {
      const map = { activate: "active", suspend: "suspended", ban: "banned" };
      const status = map[action];
      if (!status) return response.status(400).json({ error: "Aksi tidak dikenal" });
      await sql`UPDATE codexa_users SET status = ${status} WHERE id = ${id}`;
      return response.status(200).json({ ok: true, status });
    }

    const name = text(body.name, 80);
    const email = text(body.email, 160).toLowerCase();
    const phone = text(body.phone, 30);
    const note = text(body.note, 300);
    const status = text(body.status, 20) || "active";
    const password = typeof body.password === "string" ? body.password : "";
    const balanceRaw = body.balance;

    if (name.length < 2) return response.status(400).json({ error: "Nama minimal 2 karakter" });
    if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Format email tidak valid" });
    if (!STATUSES.includes(status)) return response.status(400).json({ error: "Status tidak valid" });
    if (password && password.length < 6) return response.status(400).json({ error: "Password minimal 6 karakter" });

    const balance = Math.max(0, Math.round(Number(balanceRaw) || 0));
    if (!Number.isFinite(balance)) return response.status(400).json({ error: "Saldo tidak valid" });

    const dupe = await sql`SELECT id FROM codexa_users WHERE email = ${email} AND id <> ${id} LIMIT 1`;
    if (dupe.length) return response.status(409).json({ error: "Email sudah dipakai user lain" });

    await sql`
      UPDATE codexa_users
      SET name = ${name}, email = ${email}, phone = ${phone},
          balance = ${balance}, status = ${status}, note = ${note}
      WHERE id = ${id}
    `;
    if (password) {
      await sql`UPDATE codexa_users SET password_hash = ${hashPassword(password)} WHERE id = ${id}`;
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Admin users failure", error && error.message);
    return response.status(500).json({ error: "Gagal memproses data user" });
  }
};
