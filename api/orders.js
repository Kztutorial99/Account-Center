const crypto = require("crypto");
const { db, ensureTables, currentUser, bodyOf } = require("./_users");
const { createNotification } = require("./_notifications");

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

const MAX_ITEMS = 50;
const MAX_PICKS_PER_ITEM = 100;

function normalizeItems(body) {
  // Batasi jumlah listing & akun per request supaya tidak bisa dipakai
  // membanjiri server dengan ribuan query berurutan.
  const raw = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS);
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
    indexes.slice(0, MAX_PICKS_PER_ITEM).forEach((n) => set.add(n));
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

    if (request.method === "DELETE") {
      const id = String((bodyOf(request) || {}).id || "").trim().slice(0, 60);
      if (!id) return response.status(400).json({ error: "id pesanan wajib diisi" });
      const [row] = await sql`DELETE FROM codexa_orders WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
      if (!row) return response.status(404).json({ error: "Pesanan tidak ditemukan" });
      return response.status(200).json({ deleted: row.id });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST, DELETE");
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
      if (!row) return response.status(404).json({ error: "Salah satu listing sudah tidak tersedia", failedItemId: item.id });
      if (row.status !== "available") {
        return response.status(409).json({ error: `${row.title} sudah tidak tersedia`, failedItemId: row.id });
      }
      let credentials;
      try { credentials = decryptCredentials(row.credentialBlob); }
      catch (_) { return response.status(500).json({ error: "Kredensial listing tidak bisa dibaca" }); }
      const accounts = accountsOf(credentials, row.price);
      const taken = [];
      for (const index of item.indexes) {
        const account = accounts[index - 1];
        if (!account) {
          return response.status(409).json({ error: `Stok ${row.title} sudah berubah, muat ulang katalog`, failedItemId: row.id });
        }
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

    /* Klaim akun dulu pakai compare-and-swap: UPDATE hanya jalan kalau
       credential_blob masih sama dengan yang kita baca. Dua checkout
       bersamaan untuk akun yang sama membuat yang kedua gagal, jadi satu
       akun tidak bisa terjual dua kali. */
    const orderItems = [];
    const claimed = [];
    const rollbackClaims = async () => {
      for (const c of claimed) {
        await sql`
          UPDATE codexa_account_listings
          SET credential_blob = ${c.blob}, stock = ${c.stock}, price = ${c.price},
              status = ${c.status}, updated_at = NOW()
          WHERE id = ${c.id}
        `;
      }
    };

    for (const purchase of purchases) {
      const { row, credentials, accounts, taken, remaining } = purchase;
      const nextCredentials = { ...credentials, accounts: remaining };
      const nextStock = remaining.length;
      const nextPrice = remaining.length ? Math.min(...remaining.map((a) => a.price)) : Number(row.price) || 0;
      const nextStatus = remaining.length ? "available" : "sold";
      const [claimedRow] = await sql`
        UPDATE codexa_account_listings
        SET credential_blob = ${encryptCredentials(nextCredentials)},
            stock = ${nextStock}, price = ${nextPrice}, status = ${nextStatus}, updated_at = NOW()
        WHERE id = ${row.id} AND status = 'available' AND credential_blob = ${row.credentialBlob}
        RETURNING id
      `;
      if (!claimedRow) {
        await rollbackClaims();
        return response.status(409).json({
          error: `${row.title} baru saja dibeli orang lain, muat ulang katalog`,
        });
      }
      claimed.push({
        id: row.id,
        blob: row.credentialBlob,
        stock: accounts.length,
        price: Number(row.price) || 0,
        status: row.status,
      });
      orderItems.push({
        listingId: row.id,
        title: row.title,
        loginType: row.loginType,
        deliveryDetails: credentials.deliveryDetails || "",
        accounts: taken.map((a) => ({ email: a.email, password: a.password, price: a.price })),
      });
    }

    // Akun sudah dikunci untuk pembeli ini, baru potong saldo.
    const [debited] = await sql`
      UPDATE codexa_users SET balance = balance - ${total}
      WHERE id = ${user.id} AND balance >= ${total}
      RETURNING balance
    `;
    if (!debited) {
      await rollbackClaims();
      return response.status(402).json({ error: "Saldo tidak cukup", needTopup: true });
    }

    const orderId = crypto.randomUUID();
    const itemCount = orderItems.reduce((sum, i) => sum + i.accounts.length, 0);
    let order;
    try {
      [order] = await sql`
        INSERT INTO codexa_orders (id, user_id, total, item_count, payload_blob)
        VALUES (${orderId}, ${user.id}, ${total}, ${itemCount}, ${encryptCredentials({ items: orderItems })})
        RETURNING id, total, item_count AS "itemCount", status, created_at AS "createdAt"
      `;
    } catch (error) {
      // Pesanan gagal dicatat → kembalikan saldo dan akun supaya user tidak dirugikan.
      await sql`UPDATE codexa_users SET balance = balance + ${total} WHERE id = ${user.id}`;
      await rollbackClaims();
      throw error;
    }

    await createNotification(sql, {
      userId: user.id,
      type: "order_paid",
      title: "Pembelian berhasil",
      body: `${itemCount} akun senilai Rp${total.toLocaleString("id-ID")} sudah dibayar. Detail login bisa dilihat di halaman Pesanan.`,
      link: "orders",
    });

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
