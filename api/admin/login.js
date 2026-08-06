const crypto = require("crypto");
const { isAdmin, setSession, clearSession } = require("./_auth");

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
    if (!sameSecret(body.password)) {
      return response.status(401).json({ error: "Password admin salah" });
    }
    setSession(response);
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(400).json({ error: "Permintaan login tidak valid" });
  }
};