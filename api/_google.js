/* Verifikasi login Google langsung (Google Identity Services).
   Access token dari browser wajib dicek ke Google: audience-nya harus OAuth
   Client milik akuninstan.com, supaya token dari aplikasi lain tidak diterima. */

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "838919285407-5jla1ha1huh7ljpuo68b6spl68ri3uh9.apps.googleusercontent.com";

async function verifyGoogleAccessToken(accessToken) {
  if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 4096) {
    throw new Error("Token Google tidak valid");
  }

  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!infoRes.ok) throw new Error("Sesi Google tidak berlaku, coba lagi");
  const info = await infoRes.json();

  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("Token bukan untuk aplikasi ini");
  if (Number(info.expires_in) <= 0) throw new Error("Sesi Google kedaluwarsa, coba lagi");

  const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profRes.ok) throw new Error("Gagal membaca profil Google");
  const prof = await profRes.json();

  const email = String(prof.email || info.email || "").toLowerCase();
  if (!email) throw new Error("Akun Google tidak punya email");

  return {
    uid: String(prof.sub || info.sub || ""),
    email,
    emailVerified: prof.email_verified === true || info.email_verified === "true",
    name: String(prof.name || "").slice(0, 80),
    picture: String(prof.picture || "").slice(0, 500),
  };
}

module.exports = { verifyGoogleAccessToken, GOOGLE_CLIENT_ID };
