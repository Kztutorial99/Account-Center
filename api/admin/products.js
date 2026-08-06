const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");
const { isAdmin } = require("./_auth");

const LOGIN_TYPES = new Set(["Google", "Facebook", "Email/password", "Apple", "Microsoft", "Lainnya"]);
const STATUSES = new Set(["available", "sold"]);
function bodyOf(request) { if (typeof request.body === "string") return JSON.parse(request.body || "{}"); return request.body || {}; }
function text(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function key() { return process.env.ACCOUNT_CREDENTIALS_KEY || ""; }
function cipherKey() { return crypto.createHash("sha256").update(key()).digest(); }
function encryptCredentials(value) {
  if (!key()) throw new Error("ACCOUNT_CREDENTIALS_KEY is not configured");
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
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
function validate(body, requireId = false) {
  const id = text(body.id, 160); const title = text(body.title, 160); const description = text(body.description, 500);
  const loginType = text(body.loginType, 40); const price = Number(body.price); const stock = Number(body.stock); const status = text(body.status || "available", 20);
  if (requireId && !id) return { error: "id listing wajib diisi" }; if (!title) return { error: "Nama listing wajib diisi" }; if (!LOGIN_TYPES.has(loginType)) return { error: "Tipe login tidak valid" }; if (!Number.isInteger(price) || price < 0) return { error: "Harga harus berupa angka bulat positif" }; if (!Number.isInteger(stock) || stock < 0) return { error: "Stok harus berupa angka bulat positif" }; if (!STATUSES.has(status)) return { error: "Status listing tidak valid" };
  return { id, title, description, loginType, price, stock, status, credentials: { username: text(body.username, 320), email: text(body.email, 320).toLowerCase(), password: text(body.password, 500), deliveryDetails: text(body.deliveryDetails, 3000) } };
}
async function ensureTable(sql) { await sql`CREATE TABLE IF NOT EXISTS codexa_account_listings (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', login_type TEXT NOT NULL, price BIGINT NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')), credential_blob TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; }
function view(row) { return { id: row.id, title: row.title, description: row.description, loginType: row.loginType, price: Number(row.price), stock: row.stock, status: row.status, ...row.credentials, createdAt: row.createdAt, updatedAt: row.updatedAt }; }
module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Admin login diperlukan" }); if (!process.env.DATABASE_URL) return response.status(500).json({ error: "DATABASE_URL is not configured" });
  try {
    const sql = neon(process.env.DATABASE_URL); await ensureTable(sql);
    if (request.method === "GET") { const rows = await sql`SELECT id, title, description, login_type AS "loginType", price, stock, status, credential_blob AS "credentialBlob", created_at AS "createdAt", updated_at AS "updatedAt" FROM codexa_account_listings ORDER BY created_at DESC`; return response.status(200).json({ products: rows.map((row) => view({ ...row, credentials: decryptCredentials(row.credentialBlob) })) }); }
    const input = validate(bodyOf(request), request.method === "PATCH"); if (input.error) return response.status(400).json({ error: input.error });
    if (request.method === "POST") { const id = crypto.randomUUID(); const [row] = await sql`INSERT INTO codexa_account_listings (id,title,description,login_type,price,stock,status,credential_blob) VALUES (${id},${input.title},${input.description},${input.loginType},${input.price},${input.stock},${input.status},${encryptCredentials(input.credentials)}) RETURNING id,title,description,login_type AS "loginType",price,stock,status,credential_blob AS "credentialBlob",created_at AS "createdAt",updated_at AS "updatedAt"`; return response.status(201).json({ product: view({ ...row, credentials: input.credentials }) }); }
    if (request.method === "PATCH") { const [existing] = await sql`SELECT credential_blob AS "credentialBlob" FROM codexa_account_listings WHERE id = ${input.id}`; if (!existing) return response.status(404).json({ error: "Listing tidak ditemukan" }); const credentials = Object.values(input.credentials).some(Boolean) ? input.credentials : decryptCredentials(existing.credentialBlob); const [row] = await sql`UPDATE codexa_account_listings SET title=${input.title},description=${input.description},login_type=${input.loginType},price=${input.price},stock=${input.stock},status=${input.status},credential_blob=${encryptCredentials(credentials)},updated_at=NOW() WHERE id=${input.id} RETURNING id,title,description,login_type AS "loginType",price,stock,status,credential_blob AS "credentialBlob",created_at AS "createdAt",updated_at AS "updatedAt"`; return response.status(200).json({ product: view({ ...row, credentials }) }); }
    if (request.method === "DELETE") { const id = text(bodyOf(request).id, 160); if (!id) return response.status(400).json({ error: "id listing wajib diisi" }); const [row] = await sql`DELETE FROM codexa_account_listings WHERE id=${id} RETURNING id`; if (!row) return response.status(404).json({ error: "Listing tidak ditemukan" }); return response.status(200).json({ deleted: row }); }
    response.setHeader("Allow", "GET, POST, PATCH, DELETE"); return response.status(405).json({ error: "Method not allowed" });
  } catch (error) { console.error("Admin products API failed", error); return response.status(500).json({ error: error.message === "ACCOUNT_CREDENTIALS_KEY is not configured" ? "Kunci enkripsi kredensial belum dikonfigurasi di Vercel" : "Operasi listing gagal diproses" }); }
};
