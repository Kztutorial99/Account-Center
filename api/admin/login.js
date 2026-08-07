const crypto = require("crypto");
const { isAdmin, setSession, clearSession } = require("./_auth");
const { db, clientIp, rateLimit, resetRateLimit } = require("../_users");

function sameSecret(value) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || typeof value !== "string") return false;
  const left = crypto.createHash("sha256").update(value).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({ authenticated: isAdmin(request) });
  }
  if (request.method === "DELETE") {
    clearSession(response);
    return response.status(200).json({ ok: true });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};

    // Password admin cuma satu, jadi wajib dithrottle: 8 percobaan / 10 menit per IP.
    let sql = null;
    const throttleKey = `admin-login:${clientIp(request)}`;
    try { sql = db(); } catch (_) { sql = null; }
    if (sql) {
      const gate = await rateLimit(sql, { key: throttleKey, limit: 8, windowSec: 600 });
      if (!gate.allowed) {
        response.setHeader("Retry-After", String(gate.retryAfter));
        return response.status(429).json({
          error: `Terlalu banyak percobaan login. Coba lagi dalam ${gate.retryAfter} detik.`,
        });
      }
    }

    if (!sameSecret(body.password)) {
      return response.status(401).json({ error: "Password admin salah" });
    }
    if (sql) await resetRateLimit(sql, throttleKey);
    setSession(response);
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(400).json({ error: "Permintaan login tidak valid" });
  }
};