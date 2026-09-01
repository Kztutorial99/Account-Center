const crypto = require("crypto");

const API_URL = "https://gateway.wijayapay.com/api/transaction/create";

function config() {
  const codeMerchant = process.env.WIJAYAPAY_CODE_MERCHANT || "";
  const apiKey = process.env.WIJAYAPAY_API_KEY || "";
  const callbackUrl = process.env.WIJAYAPAY_CALLBACK_URL || "";
  if (!codeMerchant || !apiKey || !callbackUrl) throw new Error("WijayaPay belum dikonfigurasi lengkap");
  return { codeMerchant, apiKey, callbackUrl };
}

async function createPayment({ refId, amount }) {
  const { codeMerchant, apiKey, callbackUrl } = config();
  const signature = crypto.createHash("md5").update(`${codeMerchant}${apiKey}${refId}`).digest("hex");
  const result = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body: JSON.stringify({
      payment_name: "QRIS",
      payment_method: "QRIS",
      total_bayar: amount,
      ref_id: refId,
      callback_url: callbackUrl,
    }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || "Gagal membuat pembayaran QRIS");
  }
  return payload.data;
}

function validSignature(refId, provided) {
  const { codeMerchant, apiKey } = config();
  const expected = crypto.createHash("md5").update(`${codeMerchant}${apiKey}${refId}`).digest("hex");
  const actual = String(provided || "").toLowerCase();
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

module.exports = { createPayment, validSignature };
