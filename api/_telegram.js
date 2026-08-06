/**
 * Helper Telegram Bot untuk notifikasi & verifikasi top up.
 * Env yang dipakai:
 *  - TELEGRAM_BOT_TOKEN      token dari @BotFather
 *  - TELEGRAM_ADMIN_CHAT_ID  chat/grup admin tujuan notifikasi
 *  - TELEGRAM_WEBHOOK_SECRET secret token webhook (dicek di api/telegram/webhook.js)
 */

const API_BASE = "https://api.telegram.org";

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function adminChatId() {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || "";
}

function telegramEnabled() {
  return Boolean(botToken() && adminChatId());
}

async function callTelegram(method, payload) {
  if (!botToken()) return null;
  try {
    const res = await fetch(`${API_BASE}/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) {
      console.error("Telegram", method, "gagal:", (data && data.description) || res.status);
    }
    return data;
  } catch (error) {
    console.error("Telegram", method, "error:", error && error.message);
    return null;
  }
}

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const rupiah = (value) => `Rp${(Number(value) || 0).toLocaleString("id-ID")}`;

const STATUS_LABEL = {
  pending: "⏳ MENUNGGU VERIFIKASI",
  approved: "✅ DISETUJUI",
  rejected: "❌ DITOLAK",
};

function waktuWib(date) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(date ? new Date(date) : new Date());
  } catch (_) {
    return new Date().toISOString();
  }
}

/** Susun isi pesan notifikasi top up. */
function topupMessage({ topup, user, status, reviewer }) {
  const state = status || topup.status || "pending";
  const lines = [
    `<b>${STATUS_LABEL[state] || STATUS_LABEL.pending}</b>`,
    "",
    "💰 <b>Permintaan Top Up</b>",
    `Nominal   : <b>${rupiah(topup.amount)}</b>`,
    `Metode    : ${escapeHtml(topup.method || "-")}`,
    `ID Transaksi : <code>${escapeHtml(topup.reference || "-")}</code>`,
  ];
  if (topup.note) lines.push(`Catatan   : ${escapeHtml(topup.note)}`);
  lines.push(
    "",
    "👤 <b>Pengguna</b>",
    `Nama  : ${escapeHtml(user.name || "-")}`,
    `Email : ${escapeHtml(user.email || "-")}`,
  );
  if (user.phone) lines.push(`No. HP: ${escapeHtml(user.phone)}`);
  lines.push(
    `Saldo sekarang: ${rupiah(user.balance)}`,
    "",
    `🕒 ${waktuWib(topup.createdAt)} WIB`,
    `🆔 <code>${escapeHtml(topup.id)}</code>`,
  );
  if (state !== "pending" && reviewer) {
    lines.push("", `Diproses oleh ${escapeHtml(reviewer)} • ${waktuWib()} WIB`);
  }
  return lines.join("\n");
}

/** Tombol Setujui / Tolak untuk permintaan yang masih pending. */
function reviewKeyboard(topupId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Setujui", callback_data: `tp:approve:${topupId}` },
        { text: "❌ Tolak", callback_data: `tp:reject:${topupId}` },
      ],
    ],
  };
}

/**
 * Kirim notifikasi top up baru ke chat admin.
 * Tidak pernah melempar error — kegagalan Telegram tidak boleh menggagalkan top up.
 */
async function notifyNewTopup({ topup, user, proof }) {
  if (!telegramEnabled()) return null;

  const caption = topupMessage({ topup, user, status: "pending" });
  const file = decodeProof(proof);

  if (file) {
    const form = new FormData();
    form.append("chat_id", String(adminChatId()));
    form.append("caption", clampCaption(caption));
    form.append("parse_mode", "HTML");
    form.append("reply_markup", JSON.stringify(reviewKeyboard(topup.id)));
    form.append(
      "photo",
      new Blob([file.buffer], { type: file.mime }),
      `bukti-${topup.reference || topup.id}.${file.ext}`,
    );
    const sent = await callTelegramForm("sendPhoto", form);
    if (sent && sent.ok) return sent;
    // Kalau kirim foto gagal, tetap kabari admin lewat teks biasa.
  }

  return callTelegram("sendMessage", {
    chat_id: adminChatId(),
    text: topupMessage({ topup, user, status: "pending" }),
    parse_mode: "HTML",
    reply_markup: reviewKeyboard(topup.id),
    disable_web_page_preview: true,
  });
}

/** Kirim foto bukti transfer + caption + tombol verifikasi. */
async function callTelegramForm(method, form) {
  if (!botToken()) return null;
  try {
    const res = await fetch(`${API_BASE}/bot${botToken()}/${method}`, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) {
      console.error("Telegram", method, "gagal:", (data && data.description) || res.status);
    }
    return data;
  } catch (error) {
    console.error("Telegram", method, "error:", error && error.message);
    return null;
  }
}

/** Ubah data URL base64 jadi { buffer, mime, ext }. Null kalau tidak valid. */
function decodeProof(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:(image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const buffer = Buffer.from(match[3].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 6 * 1024 * 1024) return null;
  const mime = match[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { buffer, mime, ext };
}

/** Caption Telegram dibatasi 1024 karakter. */
const clampCaption = (value) => (value.length > 1024 ? `${value.slice(0, 1000)}\n…` : value);

module.exports = {
  callTelegram,
  callTelegramForm,
  decodeProof,
  clampCaption,
  telegramEnabled,
  adminChatId,
  topupMessage,
  reviewKeyboard,
  escapeHtml,
  rupiah,
  waktuWib,
  STATUS_LABEL,
};
