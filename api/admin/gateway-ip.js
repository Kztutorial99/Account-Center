const { isAdmin } = require("./_auth");
const { currentOutboundIp, syncWhitelist, proxyUrl, WEBHOOK_IP } = require("../_wijayapay");

/**
 * Diagnostik & auto-whitelist IP gateway pembayaran.
 * GET  -> lihat IP keluar server saat ini
 * POST -> kirim IP keluar terbaru ke endpoint whitelist WijayaPay
 */
module.exports = async function handler(request, response) {
  if (!isAdmin(request)) {
    response.status(401).json({ error: "Tidak diizinkan" });
    return;
  }
  try {
    if (request.method === "POST") {
      const result = await syncWhitelist();
      response.status(result.ok ? 200 : 400).json(result);
      return;
    }
    const ip = await currentOutboundIp({ maxAgeMs: 0 });
    response.status(200).json({
      outboundIp: ip,
      proxyActive: Boolean(proxyUrl()),
      whitelistConfigured: Boolean(process.env.WIJAYAPAY_WHITELIST_URL),
      webhookIp: WEBHOOK_IP,
    });
  } catch (err) {
    response.status(500).json({ error: (err && err.message) || "Gagal membaca IP" });
  }
};
