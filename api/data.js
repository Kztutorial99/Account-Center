const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");
const { once } = require("./_schema");
const { effectiveAccountPrice, agedInfo, readAgedConfig } = require("./_aged");

const ensureTable = once(async function ensureTableUncached(sql) {
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
});

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

/* ── Sitemap helpers (mirror dari src/main.jsx) ── */
const SITE = "https://akuninstan.com";

const STATIC_URLS = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/katalog", changefreq: "daily", priority: "0.9" },
  { loc: "/custom-email", changefreq: "weekly", priority: "0.9" },
  { loc: "/produk/gmail-fresh", changefreq: "weekly", priority: "0.8" },
  { loc: "/produk/custom-gmail", changefreq: "weekly", priority: "0.8" },
  { loc: "/produk/gmail-aged", changefreq: "weekly", priority: "0.8" },
  { loc: "/produk/akun-game", changefreq: "weekly", priority: "0.8" },
  { loc: "/produk/akun-social-media", changefreq: "weekly", priority: "0.8" },
  { loc: "/help", changefreq: "monthly", priority: "0.6" },
  { loc: "/faq", changefreq: "monthly", priority: "0.7" },
  { loc: "/cara-beli", changefreq: "monthly", priority: "0.7" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
  { loc: "/refund", changefreq: "yearly", priority: "0.3" },
  { loc: "/disclaimer", changefreq: "yearly", priority: "0.3" },
];

const BRAND_SLUGS = [
  [/mobile\s*legend|\bmlbb\b|\bml\b/, "mobile-legends"],
  [/free\s*fire|\bff\b/, "free-fire"],
  [/gmail|google/, "google"],
  [/facebook|\bfb\b/, "facebook"],
  [/instagram|\big\b/, "instagram"],
  [/tiktok/, "tiktok"],
  [/twitter|\bx\b/, "twitter"],
  [/telegram/, "telegram"],
  [/whats\s*app|\bwa\b/, "whatsapp"],
  [/discord/, "discord"],
  [/netflix/, "netflix"],
  [/spotify/, "spotify"],
  [/canva/, "canva"],
  [/chat\s*gpt|openai/, "chatgpt"],
  [/steam/, "steam"],
  [/roblox/, "roblox"],
  [/pubg/, "pubg"],
  [/genshin/, "genshin"],
  [/valorant/, "valorant"],
  [/youtube/, "youtube"],
  [/twitch/, "twitch"],
  [/linkedin/, "linkedin"],
  [/shopee/, "shopee"],
  [/yahoo/, "yahoo"],
  [/outlook|hotmail|microsoft/, "outlook"],
  [/apple|icloud/, "apple"],
];

const slugifyText = (value) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "akun";

const productBaseSlug = (p) => {
  const hay = `${(p && p.title) || ""} ${(p && p.loginType) || ""}`.toLowerCase();
  for (const [re, slug] of BRAND_SLUGS) if (re.test(hay)) return slug;
  const words = slugifyText(p && p.title).split("-").filter(Boolean).slice(0, 2).join("-");
  return words || "akun";
};

function assignSlugs(products) {
  const seen = {};
  return products.map((p) => {
    const base = productBaseSlug(p);
    seen[base] = (seen[base] || 0) + 1;
    return { ...p, slug: seen[base] > 1 ? `${base}-${seen[base]}` : base };
  });
}

const xmlEscape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function urlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(SITE + loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority ? `    <priority>${priority}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function buildSitemap(sql) {
  let productUrls = [];
  try {
    const rows = await sql`
      SELECT id, title, login_type AS "loginType", stock, status, credential_blob AS "credentialBlob", updated_at AS "updatedAt"
      FROM codexa_account_listings
      WHERE status = 'available'
      ORDER BY created_at DESC
    `;
    const visible = rows.filter((row) => {
      const credentials = decryptCredentials(row.credentialBlob) || {};
      const accountCount = Array.isArray(credentials.accounts) && credentials.accounts.length
        ? credentials.accounts.length
        : (credentials.email || credentials.username || credentials.password ? 1 : 0);
      const effectiveStock = accountCount || Math.max(0, Number(row.stock) || 0);
      return effectiveStock > 0;
    });
    productUrls = assignSlugs(visible).map((p) => ({
      loc: `/produk/akun/${p.slug}`,
      changefreq: "daily",
      priority: "0.8",
      lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
    }));
  } catch (error) {
    console.error("sitemap: gagal membaca produk", error);
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_URLS.map(urlEntry),
    ...productUrls.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  return xml;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); return response.status(405).json({ error: "Method not allowed" }); }

  if (request.query && request.query.resource === "sitemap") {
    if (!process.env.DATABASE_URL) {
      return response.status(500).json({ error: "DATABASE_URL is not configured" });
    }
    try {
      const sql = neon(process.env.DATABASE_URL);
      await ensureTable(sql);
      const xml = await buildSitemap(sql);
      response.setHeader("Content-Type", "application/xml; charset=utf-8");
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, must-revalidate");
      response.setHeader("X-Robots-Tag", "all");
      return response.status(200).send(xml);
    } catch (error) {
      console.error("Failed to generate sitemap", error);
      return response.status(500).json({ error: "Unable to generate sitemap" });
    }
  }

  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  if (!process.env.DATABASE_URL) return response.status(500).json({ error: "DATABASE_URL is not configured" });
  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    const agedCfg = await readAgedConfig(sql);
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
            ? [{ email: credentials.email || credentials.username || "", password: credentials.password || "", price: row.price }]
            : []);
      const basePrice = Math.max(0, Math.round(Number(row.price) || 0));
      const agedEnabled = credentials.agedPricing !== false && agedCfg.enabled !== false;
      const maskedAccounts = accounts.map((account, index) => {
        const info = agedEnabled ? agedInfo(account.createdAt, agedCfg) : { days: null, bonus: 0, label: "" };
        return {
          index: index + 1,
          /* harga tampil = harga dasar + bonus umur akun (otomatis, sistem aged) */
          price: effectiveAccountPrice(account, basePrice, agedEnabled, agedCfg),
          agedDays: info.days,
          agedLabel: info.label,
          agedBonus: info.bonus,
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
