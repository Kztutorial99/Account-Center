const { db, ensureTables, bodyOf, text } = require("../_users");
const { isAdmin } = require("./_auth");

module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Sesi admin tidak valid" });
  try {
    const sql = db();
    await ensureTables(sql);

    if (request.method === "GET") {
      const topups = await sql`
        SELECT t.id, t.amount, t.method, t.reference, t.note, t.status,
               t.created_at AS "createdAt", t.reviewed_at AS "reviewedAt",
               u.id AS "userId", u.name AS "userName", u.email AS "userEmail", u.balance AS "userBalance"
        FROM codexa_topups t JOIN codexa_users u ON u.id = t.user_id
        ORDER BY (t.status = 'pending') DESC, t.created_at DESC
        LIMIT 100
      `;
      const users = await sql`
        SELECT id, name, email, phone, balance, created_at AS "createdAt"
        FROM codexa_users ORDER BY created_at DESC LIMIT 200
      `;
      return response.status(200).json({
        topups: topups.map((t) => ({ ...t, amount: Number(t.amount) || 0, userBalance: Number(t.userBalance) || 0 })),
        users: users.map((u) => ({ ...u, balance: Number(u.balance) || 0 })),
      });
    }

    if (request.method !== "PATCH") {
      response.setHeader("Allow", "GET, PATCH");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const body = bodyOf(request);
    const id = text(body.id, 60);
    const action = text(body.action, 20);
    if (!id || !["approve", "reject"].includes(action)) {
      return response.status(400).json({ error: "Permintaan tidak valid" });
    }

    const rows = await sql`SELECT id, user_id AS "userId", amount, status FROM codexa_topups WHERE id = ${id} LIMIT 1`;
    const topup = rows[0];
    if (!topup) return response.status(404).json({ error: "Permintaan top up tidak ditemukan" });
    if (topup.status !== "pending") return response.status(409).json({ error: "Permintaan sudah diproses" });

    if (action === "approve") {
      await sql`UPDATE codexa_users SET balance = balance + ${Number(topup.amount) || 0} WHERE id = ${topup.userId}`;
      await sql`UPDATE codexa_topups SET status = 'approved', reviewed_at = NOW() WHERE id = ${id}`;
    } else {
      await sql`UPDATE codexa_topups SET status = 'rejected', reviewed_at = NOW() WHERE id = ${id}`;
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Admin topup failure", error && error.message);
    return response.status(500).json({ error: "Gagal memproses top up" });
  }
};
