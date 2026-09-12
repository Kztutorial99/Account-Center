/* Sitemap dinamis: halaman statis + semua halaman produk aktif.
   URL produk mengikuti logika slug yang sama dengan frontend
   (src/main.jsx: BRAND_SLUGS + penomoran per platform). */
const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");

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

/* ── Logika slug produk (mirror dari src/main.jsx) ── */
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

/* Urutan & filter HARUS sama dengan /api/data (ORDER BY created_at DESC,
   status available, stok efektif > 0) supaya nomor slug (google, google-2, …)
   persis seperti yang dipakai frontend. */
function assignSlugs(products) {
  const seen = {};
  return products.map((p) => {
    const base = productBaseSlug(p);
    seen[base] = (seen[base] || 0) + 1;
    return { ...p, slug: seen[base] > 1 ? `${base}-${seen[base]}` : base };
  });
}

function cipherKey() {
  return crypto.createHash("sha256").update(process.env.ACCOUNT_CREDENTIALS_KEY || "").digest();
}
function decryptCredentials(value) {
  if (!process.env.ACCOUNT_CREDENTIALS_KEY) return null;
  try {
    const [ivText, tagText, encryptedText] = String(value).split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8"));
  } catch (_) { return null; }
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

module.exports = async function handler(request, response) {
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); return response.status(405).send("Method not allowed"); }

  let productUrls = [];
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
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
        /* lastmod dari updated_at produk — timestamp asli per halaman. */
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
      }));
    } catch (error) {
      console.error("sitemap: gagal membaca produk", error);
      /* Tetap sajikan halaman statis walau database bermasalah. */
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_URLS.map(urlEntry),
    ...productUrls.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, must-revalidate");
  response.setHeader("X-Robots-Tag", "all");
  return response.status(200).send(xml);
};
