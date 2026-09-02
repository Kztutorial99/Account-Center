const crypto = require("crypto");

/**
 * Helper gateway pembayaran WijayaPay (QRIS).
 * Docs: https://docs.wijayapay.com
 *
 * Env yang dipakai:
 *  - WIJAYAPAY_CODE_MERCHANT  code merchant dari https://wijayapay.com/pengaturan/credential
 *  - WIJAYAPAY_API_KEY        api key merchant
 *  - WIJAYAPAY_CALLBACK_URL   URL webhook publik (mis. https://domain/api/callback/wijayapay)
 */

const BASE_URL = "https://gateway.wijayapay.com/api";
const CODE_PAYMENT = "QRIS";
/* IP resmi pengirim webhook WijayaPay (dipakai untuk logging / pengecekan lunak). */
const WEBHOOK_IP = "45.158.126.118";

const codeMerchant = () => process.env.WIJAYAPAY_CODE_MERCHANT || "";
const apiKey = () => process.env.WIJAYAPAY_API_KEY || "";
const callbackUrl = () => process.env.WIJAYAPAY_CALLBACK_URL || "";
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

async function requestGateway(path, { method = "GET", refId, form } = {}) {
  if (!configured()) throw new Error("Gateway pembayaran belum dikonfigurasi");
  const headers = { "X-Signature": signature(refId) };
  let url = `${BASE_URL}${path}`;
  const options = { method, headers };
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(form).toString();
  }
  const res = await fetch(url, options);
  const raw = await res.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch (_) { payload = null; }
  if (!res.ok || !payload) {
    console.error(`WijayaPay ${path} gagal [${res.status}]: ${raw.slice(0, 500)}`);
    const message = (payload && (payload.message || payload.error)) || `Gateway pembayaran menolak permintaan (${res.status})`;
    throw new Error(message);
  }
  if (payload.success === false) {
    console.error(`WijayaPay ${path} error: ${raw.slice(0, 500)}`);
    throw new Error(payload.message || "Gateway pembayaran menolak permintaan");
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
  signature,
  signatureValid,
  newRefId,
  createQrisTransaction,
  checkQrisStatus,
  mapStatus,
};
