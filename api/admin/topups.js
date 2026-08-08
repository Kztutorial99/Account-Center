const { db, ensureTables, bodyOf, text } = require("../_users");
const { isAdmin } = require("./_auth");
const { callTelegram, adminChatId, topupMessage } = require("../_telegram");
const { createNotification } = require("../_notifications");

module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Sesi admin tidak valid" });
  try {
    const sql = db();
    await ensureTables(sql);

    if (request.method === "GET") {
      // Ambil satu bukti transfer (base64) untuk ditampilkan di panel admin.
      const proofId = text((request.query && request.query.proof) || "", 60);
      if (proofId) {
        const [row] = await sql`SELECT proof_blob AS "proof" FROM codexa_topups WHERE id = ${proofId} LIMIT 1`;
        if (!row || !row.proof) return response.status(404).json({ error: "Bukti transfer tidak tersimpan" });
        return response.status(200).json({ proof: row.proof });
      }
      const topups = await sql`
        SELECT t.id, t.amount, t.method, t.reference, t.note, t.status,
               t.created_at AS "createdAt", t.reviewed_at AS "reviewedAt",
               (t.proof_blob IS NOT NULL AND t.proof_blob <> '') AS "hasProof",
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
    const topupAmount = Number(topup.amount) || 0;
    await createNotification(sql, {
      userId: topup.userId,
      type: action === "approve" ? "topup_approved" : "topup_rejected",
      title: action === "approve" ? "Top up disetujui" : "Top up ditolak",
      body: action === "approve"
        ? `Saldo kamu bertambah Rp${topupAmount.toLocaleString("id-ID")}. Selamat belanja!`
        : `Permintaan top up Rp${topupAmount.toLocaleString("id-ID")} ditolak. Cek kembali bukti transfermu atau hubungi admin.`,
      link: "topup",
    });

    // Beri tahu chat admin bahwa permintaan sudah diproses lewat panel web,
    // supaya status di Telegram tidak tertinggal.
    try {
      const detail = await sql`
        SELECT t.id, t.amount, t.method, t.reference, t.note, t.created_at AS "createdAt",
               u.name AS "userName", u.email AS "userEmail", u.phone AS "userPhone", u.balance AS "userBalance"
        FROM codexa_topups t JOIN codexa_users u ON u.id = t.user_id
        WHERE t.id = ${id} LIMIT 1
      `;
      if (detail[0] && adminChatId()) {
        const d = detail[0];
        await callTelegram("sendMessage", {
          chat_id: adminChatId(),
          text: topupMessage({
            topup: {
              id: d.id,
              amount: Number(d.amount) || 0,
              method: d.method,
              reference: d.reference,
              note: d.note,
              createdAt: d.createdAt,
            },
            user: {
              name: d.userName,
              email: d.userEmail,
              phone: d.userPhone,
              balance: Number(d.userBalance) || 0,
            },
            status: action === "approve" ? "approved" : "rejected",
            reviewer: "panel admin web",
          }),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }
    } catch (notifyError) {
      console.error("Telegram notify failure", notifyError && notifyError.message);
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Admin topup failure", error && error.message);
    return response.status(500).json({ error: "Gagal memproses top up" });
  }
};
