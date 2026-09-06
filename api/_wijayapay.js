const crypto = require("crypto");

/**
 * Helper gateway pembayaran WijayaPay (QRIS).
 * Docs: https://docs.wijayapay.com
 *
 * Env yang dipakai:
 *  - WIJAYAPAY_CODE_MERCHANT  code merchant dari https://wijayapay.com/pengaturan/credential
 *  - WIJAYAPAY_API_KEY        api key merchant
 *  - WIJAYAPAY_CALLBACK_URL   URL webhook publik (mis. https://domain/api/callback/wijayapay)
 *  - STATIC_PROXY_URL         (opsional) URL proxy HTTP ber-IP tetap, format:
 *                             http://user:pass@host:port
 *                             Jika diisi, SEMUA request ke gateway WijayaPay keluar lewat
 *                             proxy ini, sehingga IP yang terlihat WijayaPay selalu sama.
 *                             Whitelist IP proxy ini (bukan IP Vercel) di dashboard WijayaPay.
 */

const BASE_URL = "https://gateway.wijayapay.com/api";
const CODE_PAYMENT = "QRIS";
/* IP resmi pengirim webhook WijayaPay (dipakai untuk logging / pengecekan lunak). */
const WEBHOOK_IP = "45.158.126.118";

const codeMerchant = () => process.env.WIJAYAPAY_CODE_MERCHANT || "";
const apiKey = () => process.env.WIJAYAPAY_API_KEY || "";
const callbackUrl = () => process.env.WIJAYAPAY_CALLBACK_URL || "";
const proxyUrl = () => process.env.STATIC_PROXY_URL || "";
const configured = () => Boolean(codeMerchant() && apiKey());

/** X-Signature = md5(code_merchant + api_key + ref_id) — digabung tanpa pemisah. */
function signature(refId) {
  return crypto.createHash("md5").update(`${codeMerchant()}${apiKey()}${String(refId || "")}`).digest("hex");
}

/** Bandingkan signature tanpa membocorkan waktu perbandingan. */
function signatureValid(refId, provided) {
  const expected = signature(refId);
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Buat ref_id unik & aman dipakai sebagai ID transaksi merchant. */
function newRefId() {
  return `AC${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Fetch dengan dukungan proxy IP statis.
 * Vercel tidak punya IP keluar tetap, jadi request gateway dialihkan lewat
 * STATIC_PROXY_URL (undici ProxyAgent) supaya IP whitelist WijayaPay stabil.
 * Kalau paket undici belum terpasang atau proxy gagal, fallback ke fetch biasa
 * agar fitur tidak mati total (dicatat di log).
 */
async function gatewayFetch(url, options = {}) {
  const proxy = proxyUrl();
  if (!proxy) return fetch(url, options);
  try {
    const { ProxyAgent, request } = require("undici");
    const dispatcher = new ProxyAgent({ uri: proxy, requestTimeout: 20000 });
    const res = await request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
      dispatcher,
    });
    const text = await res.body.text();
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      text: async () => text,
    };
  } catch (err) {
    console.error(`STATIC_PROXY_URL gagal dipakai (${err && err.message}); fallback ke koneksi langsung`);
    return fetch(url, options);
  }
}

/**
 * Auto-whitelist IP (opsional).
 * Vercel tidak punya IP keluar tetap. Kalau WijayaPay menyediakan endpoint untuk
 * memperbarui daftar IP whitelist, isi env berikut supaya IP terbaru dikirim otomatis
 * setiap kali gateway menolak karena IP tidak terdaftar:
 *  - WIJAYAPAY_WHITELIST_URL   URL endpoint update whitelist (POST form)
 *  - WIJAYAPAY_WHITELIST_FIELD nama field IP pada form (default: "ip")
 */
const whitelistUrl = () => process.env.WIJAYAPAY_WHITELIST_URL || "";
const whitelistField = () => process.env.WIJAYAPAY_WHITELIST_FIELD || "ip";

let cachedIp = { value: "", at: 0 };

/** Ambil IP publik yang dipakai server saat ini (lewat proxy bila diset). */
async function currentOutboundIp({ maxAgeMs = 60000 } = {}) {
  if (cachedIp.value && Date.now() - cachedIp.at < maxAgeMs) return cachedIp.value;
  const sources = ["https://api.ipify.org?format=json", "https://ifconfig.co/json"];
  for (const url of sources) {
    try {
      const res = await gatewayFetch(url, { method: "GET", headers: { Accept: "application/json" } });
      const data = JSON.parse(await res.text());
      const ip = String(data.ip || "").trim();
      if (ip) {
        cachedIp = { value: ip, at: Date.now() };
        return ip;
      }
    } catch (err) {
      console.error(`Gagal membaca IP keluar dari ${url}: ${err && err.message}`);
    }
  }
  return "";
}

/** Tebak apakah error dari gateway disebabkan IP tidak masuk whitelist. */
function looksLikeIpBlock(message, status) {
  const m = String(message || "").toLowerCase();
  if (status === 403) return true;
  return /whitelist|ip .*(tidak|belum|not).*(terdaftar|allowed|registered)|not allowed|forbidden|unauthorized ip/.test(m);
}

/**
 * Kirim IP keluar terbaru ke endpoint whitelist WijayaPay.
 * Balikan: { ok, ip, skipped?, status?, message? }
 */
async function syncWhitelist() {
  const ip = await currentOutboundIp({ maxAgeMs: 0 });
  if (!ip) return { ok: false, ip: "", message: "IP keluar tidak terbaca" };
  const url = whitelistUrl();
  if (!url) return { ok: false, ip, skipped: true, message: "WIJAYAPAY_WHITELIST_URL belum diisi" };
  const refId = newRefId();
  const form = new URLSearchParams({
    code_merchant: codeMerchant(),
    api_key: apiKey(),
    ref_id: refId,
    [whitelistField()]: ip,
  }).toString();
  try {
    const res = await gatewayFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Signature": signature(refId) },
      body: form,
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`Update whitelist gagal [${res.status}]: ${raw.slice(0, 300)}`);
      return { ok: false, ip, status: res.status, message: raw.slice(0, 300) };
    }
    console.log(`Whitelist WijayaPay diperbarui ke IP ${ip}`);
    return { ok: true, ip, message: raw.slice(0, 300) };
  } catch (err) {
    console.error(`Update whitelist error: ${err && err.message}`);
    return { ok: false, ip, message: err && err.message };
  }
}

async function requestGateway(path, options = {}) {
  try {
    return await sendGateway(path, options);
  } catch (err) {
    if (!looksLikeIpBlock(err && err.message, err && err.status)) throw err;
    const sync = await syncWhitelist();
    if (!sync.ok) {
      const ipInfo = sync.ip ? ` (IP keluar saat ini: ${sync.ip})` : "";
      throw new Error(`${err.message}${ipInfo}`);
    }
    return await sendGateway(path, options);
  }
}

async function sendGateway(path, { method = "GET", refId, form } = {}) {
  if (!configured()) throw new Error("Gateway pembayaran belum dikonfigurasi");
  const headers = { "X-Signature": signature(refId) };
  const url = `${BASE_URL}${path}`;
  const options = { method, headers };
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(form).toString();
  }
  const res = await gatewayFetch(url, options);
  const raw = await res.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch (_) { payload = null; }
  if (!res.ok || !payload) {
    console.error(`WijayaPay ${path} gagal [${res.status}]: ${raw.slice(0, 500)}`);
    const message = (payload && (payload.message || payload.error)) || `Gateway pembayaran menolak permintaan (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  if (payload.success === false) {
    console.error(`WijayaPay ${path} error: ${raw.slice(0, 500)}`);
    const error = new Error(payload.message || "Gateway pembayaran menolak permintaan");
    error.status = res.status;
    throw error;
  }
  return payload;
}

/**
 * Generate pembayaran QRIS baru.
 * Balikan: { refId, trxReference, qrImage, qrString, totalBayar, totalFee, expired, tutorial }
 */
async function createQrisTransaction({ refId, amount }) {
  const form = {
    code_merchant: codeMerchant(),
    api_key: apiKey(),
    code_payment: CODE_PAYMENT,
    ref_id: refId,
    nominal: String(Math.round(Number(amount) || 0)),
  };
  if (callbackUrl()) form.callback_url = callbackUrl();
  const payload = await requestGateway("/transaction/create", { method: "POST", refId, form });
  const d = payload.data || {};
  return {
    refId,
    trxReference: String(d.trx_reference || ""),
    qrImage: String(d.qr_image || ""),
    qrString: String(d.qr_string || ""),
    totalBayar: Number(d.total_bayar) || 0,
    totalFee: Number(d.total_fee) || 0,
    totalDiterima: Number(d.total_diterima) || 0,
    expired: d.expired || null,
    tutorial: String(d.tutorial_pembayaran || ""),
    paymentName: String(d.payment_name || "QRIS"),
  };
}

/** Cek status pembayaran: 'pending' | 'paid' | 'expired'. */
async function checkQrisStatus(refId) {
  const query = new URLSearchParams({
    code_merchant: codeMerchant(),
    api_key: apiKey(),
    ref_id: String(refId || ""),
  }).toString();
  const payload = await requestGateway(`/get-status?${query}`, { refId });
  const status = String(payload.status_pembayaran || payload.status || "pending").toLowerCase();
  return { status, data: payload.data || {} };
}

/** Normalisasi status gateway ke status internal codexa_topups. */
function mapStatus(gatewayStatus) {
  const s = String(gatewayStatus || "").toLowerCase();
  if (s === "paid" || s === "success" || s === "settled") return "approved";
  if (s === "expired" || s === "failed" || s === "cancel" || s === "canceled") return "rejected";
  return "pending";
}

module.exports = {
  BASE_URL,
  CODE_PAYMENT,
  WEBHOOK_IP,
  configured,
  callbackUrl,
  proxyUrl,
  signature,
  signatureValid,
  newRefId,
  gatewayFetch,
  currentOutboundIp,
  looksLikeIpBlock,
  syncWhitelist,
  createQrisTransaction,
  checkQrisStatus,
  mapStatus,
};
