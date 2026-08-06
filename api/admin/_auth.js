const crypto = require("crypto");

const COOKIE_NAME = "codexa_admin";
const MAX_AGE = 60 * 60 * 8;

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

function signature(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function cookieValue(request) {
  const cookies = request.headers.cookie || "";
  const item = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return item ? item.slice(COOKIE_NAME.length + 1) : "";
}

function isAdmin(request) {
  if (!secret()) return false;
  const [payload, provided] = cookieValue(request).split(".");
  if (!payload || !provided) return false;
  const expected = signature(payload);
  const validSignature = provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!validSignature) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function setSession(response) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${payload}.${signature(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
}

function clearSession(response) {
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

module.exports = { isAdmin, setSession, clearSession };