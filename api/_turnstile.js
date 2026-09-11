/* Verifikasi Cloudflare Turnstile (captcha) di sisi server.
   Kalau TURNSTILE_SECRET_KEY belum diisi, captcha dilewati supaya
   form tetap jalan sampai secret dipasang di environment. */
const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const captchaEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

async function verifyCaptcha(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
    return { ok: false, error: "Verifikasi keamanan belum selesai. Selesaikan captcha lalu coba lagi." };
  }

  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set("remoteip", ip);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (data && data.success) return { ok: true };
    console.error("Turnstile rejected", data && data["error-codes"]);
    return { ok: false, error: "Verifikasi keamanan gagal. Coba ulangi captcha-nya." };
  } catch (error) {
    console.error("Turnstile failure", error && error.message);
    return { ok: false, error: "Verifikasi keamanan tidak bisa diproses. Coba lagi sebentar." };
  }
}

module.exports = { verifyCaptcha, captchaEnabled };
