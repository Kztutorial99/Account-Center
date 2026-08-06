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

// Sensor bagian tengah email: 2 huruf awal + •••• + 1 huruf akhir @domain
function maskEmail(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  const at = value.lastIndexOf("@");
  if (at < 1) {
    if (value.length <= 3) return value[0] + "•••";
    return value.slice(0, 2) + "••••" + value.slice(-1);
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  let maskedLocal;
  if (local.length <= 2) maskedLocal = local[0] + "••••";
  else if (local.length <= 4) maskedLocal = local[0] + "••••" + local.slice(-1);
  else maskedLocal = local.slice(0, 2) + "••••" + local.slice(-1);
  const dot = domain.indexOf(".");
  let maskedDomain = domain;
  if (dot > 1) {
    const name = domain.slice(0, dot);
    const tld = domain.slice(dot);
    maskedDomain = (name.length <= 2 ? name[0] + "••" : name[0] + "••••" + name.slice(-1)) + tld;
  }
  return maskedLocal + "@" + maskedDomain;
}

// Password disensor seluruhnya
function maskPassword(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return "•".repeat(Math.min(Math.max(value.length, 6), 12));
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); return response.status(405).json({ error: "Method not allowed" }); }
  if (!process.env.DATABASE_URL) return response.status(500).json({ error: "DATABASE_URL is not configured" });
  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    const rows = await sql`
      SELECT id, title, description, login_type AS "loginType", price, stock, status, credential_blob AS "credentialBlob"
      FROM codexa_account_listings
      WHERE status = 'available'
      ORDER BY created_at DESC
    `;
    const products = rows.map((row) => {
      const credentials = decryptCredentials(row.credentialBlob) || {};
      const accounts = Array.isArray(credentials.accounts) && credentials.accounts.length
        ? credentials.accounts
        : (credentials.email || credentials.username || credentials.password
            ? [{ email: credentials.email || credentials.username || "", password: credentials.password || "" }]
            : []);
      const maskedAccounts = accounts.map((account, index) => ({
        index: index + 1,
        maskedEmail: maskEmail(account.email || account.username || ""),
        maskedPassword: maskPassword(account.password),
      }));
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        loginType: row.loginType,
        price: Number(row.price),
        stock: maskedAccounts.length || row.stock,
        status: row.status,
        accounts: maskedAccounts,
        maskedEmail: maskedAccounts[0] ? maskedAccounts[0].maskedEmail : "",
        maskedPassword: maskedAccounts[0] ? maskedAccounts[0].maskedPassword : "",
      };
    });
    return response.status(200).json({ products: products.filter((p) => p.stock > 0), source: "codexa_account_listings" });
  } catch (error) {
    console.error("Failed to read public catalog", error);
    return response.status(500).json({ error: "Unable to read product catalog" });
  }
};
