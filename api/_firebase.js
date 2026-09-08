/* Verifikasi Firebase ID token tanpa firebase-admin.
   Token Firebase adalah JWT RS256 yang ditandatangani Google; kunci publiknya
   berupa sertifikat x509 yang bisa diambil dan di-cache. */
const crypto = require("crypto");

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "project-akuninstan";

let certCache = { certs: null, expiresAt: 0 };

async function fetchCerts() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAt > now) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("Gagal mengambil kunci Google");
  const certs = await res.json();
  let ttl = 3600;
  const cc = res.headers.get("cache-control") || "";
  const m = /max-age=(\d+)/.exec(cc);
  if (m) ttl = Math.max(300, Number(m[1]) || 3600);
  certCache = { certs, expiresAt: now + ttl * 1000 };
  return certs;
}

function b64urlToBuffer(part) {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) {
    throw new Error("Token Google tidak valid");
  }
  const [headerB64, payloadB64, signatureB64] = idToken.split(".");
  const header = JSON.parse(b64urlToBuffer(headerB64).toString("utf8"));
  const payload = JSON.parse(b64urlToBuffer(payloadB64).toString("utf8"));

  if (header.alg !== "RS256" || !header.kid) throw new Error("Token Google tidak valid");

  const certs = await fetchCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Token Google kedaluwarsa, coba lagi");

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const ok = verifier.verify(cert, b64urlToBuffer(signatureB64));
  if (!ok) throw new Error("Tanda tangan token tidak sah");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error("Token bukan untuk aplikasi ini");
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error("Penerbit token tidak dikenal");
  }
  if (!payload.sub) throw new Error("Token Google tidak valid");
  if (Number(payload.exp) <= now) throw new Error("Sesi Google kedaluwarsa, coba lagi");
  if (Number(payload.iat) > now + 300) throw new Error("Waktu token tidak wajar");

  const email = String(payload.email || "").toLowerCase();
  if (!email) throw new Error("Akun Google tidak punya email");

  return {
    uid: payload.sub,
    email,
    emailVerified: payload.email_verified === true,
    name: String(payload.name || "").slice(0, 80),
    picture: String(payload.picture || "").slice(0, 500),
  };
}

module.exports = { verifyFirebaseIdToken, FIREBASE_PROJECT_ID };
