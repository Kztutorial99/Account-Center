const crypto = require("crypto");
const { db, ensureTables, currentUser, bodyOf, text } = require("./_users");
const { notifyNewTopup } = require("./_telegram");

const MIN_TOPUP = 10000;
const MAX_TOPUP = 20000000;

module.exports = async function handler(request, response) {
  try {
    const sql = db();
    await ensureTables(sql);
    const user = await currentUser(sql, request);
    if (!user) return response.status(401).json({ error: "Silakan masuk terlebih dahulu" });

    if (request.method === "GET") {
      const rows = await sql`
        SELECT id, amount, method, reference, note, status,
               created_at AS "createdAt", reviewed_at AS "reviewedAt"
        FROM codexa_topups WHERE user_id = ${user.id}
        ORDER BY created_at DESC LIMIT 30
      `;
      return response.status(200).json({
        balance: user.balance,
        topups: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
      });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const body = bodyOf(request);
    const amount = Math.round(Number(body.amount) || 0);
    const method = text(body.method, 40) || "Transfer Bank";
    const reference = text(body.reference, 120);
    const note = text(body.note, 300);

    if (!Number.isFinite(amount) || amount < MIN_TOPUP) {
      return response.status(400).json({ error: `Minimal top up Rp${MIN_TOPUP.toLocaleString("id-ID")}` });
    }
    if (amount > MAX_TOPUP) return response.status(400).json({ error: "Nominal top up terlalu besar" });
    if (!reference) return response.status(400).json({ error: "Nomor ID transaksi wajib diisi" });

    const pending = await sql`
      SELECT COUNT(*)::int AS total FROM codexa_topups WHERE user_id = ${user.id} AND status = 'pending'
    `;
    if ((pending[0] && pending[0].total) >= 3) {
      return response.status(429).json({ error: "Masih ada 3 permintaan top up menunggu verifikasi" });
    }

    const rows = await sql`
      INSERT INTO codexa_topups (id, user_id, amount, method, reference, note)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${amount}, ${method}, ${reference}, ${note})
      RETURNING id, amount, method, reference, note, status, created_at AS "createdAt", reviewed_at AS "reviewedAt"
    `;
    const topup = { ...rows[0], amount: Number(rows[0].amount) || 0 };

    // Kirim notifikasi ke admin lewat bot Telegram. Kegagalan Telegram
    // tidak boleh membatalkan permintaan top up yang sudah tersimpan.
    try {
      await notifyNewTopup({ topup, user });
    } catch (notifyError) {
      console.error("Telegram notify failure", notifyError && notifyError.message);
    }

    return response.status(201).json({ topup });
  } catch (error) {
    console.error("Topup failure", error && error.message);
    return response.status(500).json({ error: "Permintaan top up gagal diproses" });
  }
};
