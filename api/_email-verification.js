const crypto = require("crypto");

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function createVerificationToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    hash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  };
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function appOrigin(request) {
  const forwardedHost = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(request.headers.host || "akuninstan.com");
  const allowed = host === "akuninstan.com" || host === "www.akuninstan.com" || host.endsWith(".vercel.app");
  return `https://${allowed ? host : "akuninstan.com"}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendVerificationEmail({ request, email, name, token }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY belum dikonfigurasi");

  const verifyUrl = `${appOrigin(request)}/api/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name || "Pengguna");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Akun Instan <noreplay@akuninstan.com>",
      to: [email],
      subject: "Verifikasi akun Akun Instan",
      html: `<!doctype html><html><body style="margin:0;background:#f7f5fa;font-family:Arial,sans-serif;color:#241832"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7dff0;border-radius:12px"><tr><td style="padding:32px"><div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:18px">AKUN INSTAN</div><h1 style="font-size:24px;line-height:1.3;margin:0 0 12px">Verifikasi email kamu</h1><p style="font-size:15px;line-height:1.7;color:#62566f;margin:0 0 12px">Halo ${safeName}, terima kasih sudah mendaftar. Klik tombol berikut untuk mengaktifkan akun kamu.</p><p style="margin:24px 0"><a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px">Verifikasi akun</a></p><p style="font-size:13px;line-height:1.6;color:#81758c;margin:0">Link ini berlaku selama 24 jam dan hanya dapat digunakan satu kali. Jika kamu tidak merasa mendaftar, abaikan email ini.</p></td></tr></table></td></tr></table></body></html>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Resend verification failed [${response.status}]: ${detail}`);
    throw new Error("Email verifikasi gagal dikirim");
  }
}

module.exports = { createVerificationToken, hashVerificationToken, sendVerificationEmail };