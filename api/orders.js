const crypto = require("crypto");
const { db, ensureTables, currentUser, bodyOf } = require("./_users");

/* ── enkripsi kredensial (format sama dengan api/admin/products.js) ── */
function key() { return process.env.ACCOUNT_CREDENTIALS_KEY || ""; }
function cipherKey() { return crypto.createHash("sha256").update(key()).digest(); }
function encryptCredentials(value) {
  if (!key()) throw new Error("ACCOUNT_CREDENTIALS_KEY is not configured");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
function decryptCredentials(value) {
  if (!key()) throw new Error("ACCOUNT_CREDENTIALS_KEY is not configured");
  const [ivText, tagText, encryptedText] = String(value).split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8"));
}

function accountsOf(credentials, basePrice) {
  const c = credentials || {};
  const fallback = Math.max(0, Math.round(Number(basePrice) || 0));
  const price = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback; };
  if (Array.isArray(c.accounts) && c.accounts.length) {
    return c.accounts.map((a) => ({ email: a.email || a.username || "", password: a.password || "", price: price(a.price) }));
  }
  const legacy = { email: c.email || c.username || "", password: c.password || "", price: fallback };
  return legacy.email || legacy.password ? [legacy] : [];
}

async function ensureOrderTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES codexa_users(id) ON DELETE CASCADE,
      total BIGINT NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','refunded')),
      payload_blob TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS codexa_orders_user_idx ON codexa_orders (user_id, created_at DESC)`;
}

function normalizeItems(body) {
  const raw = Array.isArray(body.items) ? body.items : [];
  const merged = new Map();
  for (const item of raw) {
    const id = typeof item?.id === "string" ? item.id.trim().slice(0, 160) : "";
    if (!id) continue;
    const picks = Array.isArray(item.accounts) ? item.accounts : [];
    const indexes = picks
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 500);
    if (!indexes.length) continue;
    const set = merged.get(id) || new Set();
    indexes.forEach((n) => set.add(n));
    merged.set(id, set);
  }
  return [...merged.entries()].map(([id, set]) => ({ id, indexes: [...set].sort((a, b) => a - b) }));
}

module.exports = async function handler(request, response) {
  try {
    const sql = db();
    await ensureTables(sql);
    await ensureOrderTables(sql);
    const user = await currentUser(sql, request);
    if (!user) return response.status(401).json({ error: "Silakan masuk terlebih dahulu" });

    if (request.method === "GET") {
      const rows = await sql`
        SELECT id, total, item_count AS "itemCount", status, payload_blob AS "payloadBlob", created_at AS "createdAt"
        FROM codexa_orders WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50
      `;
      const orders = rows.map((row) => {
        let items = [];
        try { items = decryptCredentials(row.payloadBlob).items || []; } catch (_) { items = []; }
        return {
          id: row.id,
          total: Number(row.total) || 0,
          itemCount: row.itemCount,
          status: row.status,
          createdAt: row.createdAt,
          items,
        };
      });
      return response.status(200).json({ orders, balance: user.balance });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const items = normalizeItems(bodyOf(request));
    if (!items.length) return response.status(400).json({ error: "Keranjang kosong atau belum ada akun yang dipilih" });

    // Ambil listing yang dibeli, validasi ketersediaan & hitung total
    const purchases = [];
    let total = 0;
    for (const item of items) {
      const [row] = await sql`
        SELECT id, title, login_type AS "loginType", price, status, credential_blob AS "credentialBlob"
        FROM codexa_account_listings WHERE id = ${item.id} LIMIT 1
      `;
      if (!row) return response.status(404).json({ error: "Salah satu listing sudah tidak tersedia" });
      if (row.status !== "available") return response.status(409).json({ error: `${row.title} sudah tidak tersedia` });
      let credentials;
      try { credentials = decryptCredentials(row.credentialBlob); }
      catch (_) { return response.status(500).json({ error: "Kredensial listing tidak bisa dibaca" }); }
      const accounts = accountsOf(credentials, row.price);
      const taken = [];
      for (const index of item.indexes) {
        const account = accounts[index - 1];
        if (!account) return response.status(409).json({ error: `Stok ${row.title} sudah berubah, muat ulang katalog` });
        taken.push({ index, ...account });
        total += account.price;
      }
      const remaining = accounts.filter((_, i) => !item.indexes.includes(i + 1));
      purchases.push({ row, credentials, accounts, taken, remaining });
    }

    if (total > user.balance) {
      return response.status(402).json({
        error: `Saldo tidak cukup. Butuh Rp${total.toLocaleString("id-ID")}, saldo kamu Rp${user.balance.toLocaleString("id-ID")}`,
        needTopup: true,
      });
    }

    // Potong saldo dulu (atomic) agar tidak bisa dobel-belanja
    const [debited] = await sql`
      UPDATE codexa_users SET balance = balance - ${total}
      WHERE id = ${user.id} AND balance >= ${total}
      RETURNING balance
    `;
    if (!debited) return response.status(402).json({ error: "Saldo tidak cukup", needTopup: true });

    // Keluarkan akun yang terjual dari listing
    const orderItems = [];
    for (const purchase of purchases) {
      const { row, credentials, taken, remaining } = purchase;
      const nextCredentials = { ...credentials, accounts: remaining };
      const nextStock = remaining.length;
      const nextPrice = remaining.length ? Math.min(...remaining.map((a) => a.price)) : Number(row.price) || 0;
      const nextStatus = remaining.length ? "available" : "sold";
      await sql`
        UPDATE codexa_account_listings
        SET credential_blob = ${encryptCredentials(nextCredentials)},
            stock = ${nextStock}, price = ${nextPrice}, status = ${nextStatus}, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      orderItems.push({
        listingId: row.id,
        title: row.title,
        loginType: row.loginType,
        deliveryDetails: credentials.deliveryDetails || "",
        accounts: taken.map((a) => ({ email: a.email, password: a.password, price: a.price })),
      });
    }

    const orderId = crypto.randomUUID();
    const itemCount = orderItems.reduce((sum, i) => sum + i.accounts.length, 0);
    const [order] = await sql`
      INSERT INTO codexa_orders (id, user_id, total, item_count, payload_blob)
      VALUES (${orderId}, ${user.id}, ${total}, ${itemCount}, ${encryptCredentials({ items: orderItems })})
      RETURNING id, total, item_count AS "itemCount", status, created_at AS "createdAt"
    `;

    return response.status(201).json({
      order: { ...order, total: Number(order.total) || 0, items: orderItems },
      balance: Number(debited.balance) || 0,
    });
  } catch (error) {
    console.error("Checkout failure", error && error.message);
    const message = error && error.message === "ACCOUNT_CREDENTIALS_KEY is not configured"
      ? "Kunci enkripsi kredensial belum dikonfigurasi"
      : "Checkout gagal diproses";
    return response.status(500).json({ error: message });
  }
};
