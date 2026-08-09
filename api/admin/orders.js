const crypto = require("crypto");
const { db, ensureTables, bodyOf, text } = require("../_users");
const { isAdmin } = require("./_auth");

function key() { return process.env.ACCOUNT_CREDENTIALS_KEY || ""; }
function cipherKey() { return crypto.createHash("sha256").update(key()).digest(); }
function decryptCredentials(value) {
  if (!key()) throw new Error("ACCOUNT_CREDENTIALS_KEY is not configured");
  const [ivText, tagText, encryptedText] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8"));
}

// Admin hanya butuh ringkasan pesanan — kredensial akun tetap disamarkan.
function maskEmail(value) {
  const raw = String(value || "");
  const [name, domain] = raw.split("@");
  if (!domain) return raw ? `${raw.slice(0, 2)}***` : "-";
  return `${name.slice(0, 2)}***@${domain}`;
}

module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Sesi admin tidak valid" });
  try {
    const sql = db();
    await ensureTables(sql);

    if (request.method === "GET") {
      const rows = await sql`
        SELECT o.id, o.total, o.item_count AS "itemCount", o.status, o.payload_blob AS "payloadBlob",
               o.created_at AS "createdAt",
               u.id AS "userId", u.name AS "userName", u.email AS "userEmail",
               u.phone AS "userPhone", u.balance AS "userBalance"
        FROM codexa_orders o JOIN codexa_users u ON u.id = o.user_id
        ORDER BY o.created_at DESC LIMIT 100
      `;
      const orders = rows.map((row) => {
        let items = [];
        try { items = (decryptCredentials(row.payloadBlob) || {}).items || []; } catch (_) { items = []; }
        return {
          id: row.id,
          total: Number(row.total) || 0,
          itemCount: row.itemCount,
          status: row.status,
          createdAt: row.createdAt,
          buyer: {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
            phone: row.userPhone || "",
            balance: Number(row.userBalance) || 0,
          },
          items: items.map((item) => ({
            title: item.title || "Listing",
            loginType: item.loginType || "-",
            accounts: (item.accounts || []).map((a) => ({
              index: a.index,
              email: maskEmail(a.email),
              price: Number(a.price) || 0,
            })),
          })),
        };
      });
      return response.status(200).json({ orders });
    }

    if (request.method === "DELETE") {
      const body = bodyOf(request);
      const id = text(body.id, 60);
      if (!id) return response.status(400).json({ error: "id pesanan wajib diisi" });
      const [row] = await sql`DELETE FROM codexa_orders WHERE id = ${id} RETURNING id`;
      if (!row) return response.status(404).json({ error: "Pesanan tidak ditemukan" });
      return response.status(200).json({ deleted: row.id });
    }

    response.setHeader("Allow", "GET, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin orders API failed", error && error.message);
    return response.status(500).json({ error: "Data pesanan gagal dimuat" });
  }
};
