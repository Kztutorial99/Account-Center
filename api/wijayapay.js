const { db, ensureTables, bodyOf } = require("./_users");
const { validSignature } = require("./_wijayapay");
const { createNotification } = require("./_notifications");

module.exports = async function handler(request, response) {
  if (!["POST", "GET"].includes(request.method)) return response.status(405).json({ status: false });
  try {
    const payload = bodyOf(request);
    const data = payload.data || {};
    const refId = String(data.ref_id || "");
    if (!refId || !validSignature(refId, request.headers["x-signature"])) {
      return response.status(401).json({ status: false });
    }
    if (String(payload.status).toLowerCase() !== "paid") return response.status(200).json({ status: true });

    const sql = db();
    await ensureTables(sql);
    const claimed = await sql`
      UPDATE codexa_topups
      SET status = 'approved', reviewed_at = NOW()
      WHERE reference = ${refId} AND status = 'pending'
      RETURNING id, user_id AS "userId", amount
    `;
    if (!claimed.length) return response.status(200).json({ status: true });

    const topup = claimed[0];
    try {
      await sql`UPDATE codexa_users SET balance = balance + ${Number(topup.amount) || 0} WHERE id = ${topup.userId}`;
    } catch (error) {
      await sql`UPDATE codexa_topups SET status = 'pending', reviewed_at = NULL WHERE id = ${topup.id} AND status = 'approved'`;
      throw error;
    }
    await createNotification(sql, {
      userId: topup.userId,
      type: "topup_approved",
      title: "Pembayaran QRIS berhasil",
      body: `Saldo kamu bertambah Rp${Number(topup.amount).toLocaleString("id-ID")}. Selamat belanja!`,
      link: "topup",
    });
    return response.status(200).json({ status: true });
  } catch (error) {
    console.error("WijayaPay callback failure", error && error.message);
    return response.status(500).json({ status: false });
  }
};
