const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_account_listings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      login_type TEXT NOT NULL,
      price BIGINT NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
      credential_blob TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function key() { return process.env.ACCOUNT_CREDENTIALS_KEY || ""; }
function cipherKey() { return crypto.createHash("sha256").update(key()).digest(); }
function decryptCredentials(value) {
  if (!key()) return null;
  try {
    const [ivText, tagText, encryptedText] = String(value).split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8"));
  } catch (_) { return null; }
}

function maskEmail(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  const at = value.lastIndexOf("@");
  const local = at > 0 ? value.slice(0, at) : value;
  const domain = at > 0 ? value.slice(at) : "";
  if (local.length <= 2) return local[0] + "****" + domain;
  const keep = Math.min(5, local.length - 1);
  return local.slice(0, keep) + "****" + domain;
}

function maskPassword(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return "*".repeat(6);
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); return response.status(405).json({ error: "Method not allowed" }); }
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  if (!process.env.DATABASE_URL) return response.status(500).json({ error: "DATABASE_URL is not configured" });
  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    const rows = await sql`
      SELECT id, title, description, login_type AS "loginType", price, stock, status, credential_blob AS "credentialBlob"
      FROM codexa_account_listings
      WHERE status = 'available' AND stock > 0
      ORDER BY created_at DESC
    `;

    const products = rows.map((row) => {
      const credentials = decryptCredentials(row.credentialBlob) || {};
      const accounts = Array.isArray(credentials.accounts) && credentials.accounts.length
        ? credentials.accounts
        : (credentials.email || credentials.username || credentials.password
            ? [{ email: credentials.email || credentials.username || "", password: credentials.password || "", price: row.price }]
            : []);
      const basePrice = Math.max(0, Math.round(Number(row.price) || 0));
      const maskedAccounts = accounts.map((account, index) => {
        const n = Number(account.price);
        return {
          index: index + 1,
          price: Number.isFinite(n) && n >= 0 ? Math.round(n) : basePrice,
          maskedEmail: maskEmail(account.email || account.username || ""),
          maskedPassword: maskPassword(account.password),
        };
      });
      const effectiveStock = maskedAccounts.length || Math.max(0, Number(row.stock) || 0);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        loginType: row.loginType,
        price: maskedAccounts.length ? Math.min(...maskedAccounts.map((a) => a.price)) : basePrice,
        stock: effectiveStock,
        status: row.status,
        accounts: maskedAccounts,
        maskedEmail: maskedAccounts[0] ? maskedAccounts[0].maskedEmail : "",
        maskedPassword: maskedAccounts[0] ? maskedAccounts[0].maskedPassword : "",
      };
    }).filter((p) => p.status === "available" && p.stock > 0);

    return response.status(200).json({ products, source: "codexa_account_listings", generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to read public catalog", error);
    return response.status(500).json({ error: "Unable to read product catalog" });
  }
};
