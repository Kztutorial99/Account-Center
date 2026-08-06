const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");

const COOKIE_NAME = "codexa_user";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 hari

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

function secret() {
  return process.env.USER_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      balance BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_topups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES codexa_users(id) ON DELETE CASCADE,
      amount BIGINT NOT NULL,
      method TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE codexa_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE codexa_users ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`;
}

/* ── password hashing (scrypt) ── */
function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(String(password), useSalt, 32).toString("base64url");
  return `scrypt.${useSalt}.${derived}`;
}
function verifyPassword(password, stored) {
  try {
    const [scheme, salt] = String(stored).split(".");
    if (scheme !== "scrypt" || !salt) return false;
    const expected = Buffer.from(stored);
    const actual = Buffer.from(hashPassword(password, salt));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) {
    return false;
  }
}

/* ── session cookie ── */
function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
function setSession(response, userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${payload}.${sign(payload)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
}
function clearSession(response) {
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
function sessionUserId(request) {
  if (!secret()) return "";
  const cookies = request.headers.cookie || "";
  const item = cookies.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE_NAME}=`));
  if (!item) return "";
  const [payload, provided] = item.slice(COOKIE_NAME.length + 1).split(".");
  if (!payload || !provided) return "";
  const expected = sign(payload);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return "";
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? String(data.uid || "") : "";
  } catch (_) {
    return "";
  }
}

async function currentUser(sql, request) {
  const id = sessionUserId(request);
  if (!id) return null;
  const rows = await sql`
    SELECT id, name, email, phone, balance, status, created_at AS "createdAt"
    FROM codexa_users WHERE id = ${id} LIMIT 1
  `;
  if (!rows.length) return null;
  if (rows[0].status && rows[0].status !== "active") return null;
  return { ...rows[0], balance: Number(rows[0].balance) || 0 };
}

function bodyOf(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

module.exports = {
  db, ensureTables, hashPassword, verifyPassword,
  setSession, clearSession, sessionUserId, currentUser, bodyOf, text,
};
