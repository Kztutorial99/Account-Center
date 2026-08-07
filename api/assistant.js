/**
 * POST /api/assistant  — chat dengan Assisten CodeXa.
 *
 * Role ditentukan SERVER-SIDE:
 *   - cookie admin valid            → role "admin" (akses penuh)
 *   - user login dengan role admin  → role "admin"
 *   - user login biasa              → role "user"  (hanya data sendiri)
 *   - tidak ada sesi                → 401
 *
 * Konfigurasi (API key, model, dll) diambil dari admin panel (database),
 * dengan fallback ke env var QWEN_*.
 *
 * Body: { messages: [{ role: "user"|"assistant", content: string }, ...] }
 * Respons: { reply, role, model, actions, usage }
 */

const { db, ensureTables, currentUser, bodyOf } = require("./_users");
const { isAdmin } = require("./admin/_auth");
const { runAssistant, modelFor, visionModelFor, schemasForRole } = require("./_assistant");
const { assistantConfig } = require("./_settings");

const MAX_HISTORY = 24;
const MAX_CHARS = 4000;
const MAX_IMAGES_PER_MSG = 3;
const MAX_IMAGE_CHARS = 2_400_000; // ± 1.7 MB per gambar setelah base64
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;

/** Ambil bagian gambar + teks dari satu pesan (multimodal). */
function sanitizeParts(content) {
  const parts = [];
  let images = 0;
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" && typeof part.text === "string") {
      const t = part.text.trim().slice(0, MAX_CHARS);
      if (t) parts.push({ type: "text", text: t });
      continue;
    }
    if (part.type === "image_url") {
      const url = part.image_url && typeof part.image_url.url === "string" ? part.image_url.url.trim() : "";
      if (!url || images >= MAX_IMAGES_PER_MSG) continue;
      const isHttp = /^https:\/\/\S+$/i.test(url);
      const isData = IMAGE_DATA_URL.test(url) && url.length <= MAX_IMAGE_CHARS;
      if (!isHttp && !isData) continue;
      images += 1;
      parts.push({ type: "image_url", image_url: { url } });
    }
  }
  return parts;
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content.trim().slice(0, MAX_CHARS) };
      }
      // Gambar hanya boleh datang dari user.
      if (Array.isArray(m.content) && m.role === "user") {
        const parts = sanitizeParts(m.content);
        return parts.length ? { role: m.role, content: parts } : null;
      }
      return null;
    })
    .filter((m) => m && (typeof m.content === "string" ? m.content.length > 0 : m.content.length > 0))
    .slice(-MAX_HISTORY);
}

module.exports = async function handler(request, response) {
  try {
    const adminCookie = isAdmin(request);
    const sql = db();
    await ensureTables(sql);
    const cfg = await assistantConfig(sql);
    const active = cfg.enabled && cfg.hasKey;

    // Siapa pemanggilnya + role efektifnya.
    // Sesi user selalu diprioritaskan: kalau seseorang login sebagai user di
    // browser yang juga punya cookie admin panel, Assisten tetap mode user.
    let role = "";
    const user = await currentUser(sql, request);
    if (user) {
      role = user.role === "admin" ? "admin" : "user";
    } else if (adminCookie) {
      role = "admin";
    }

    // GET → info kemampuan assisten untuk pemanggil ini (dipakai UI).
    if (request.method === "GET") {
      if (!role) return response.status(401).json({ error: "Silakan masuk dulu untuk memakai Assisten" });
      return response.status(200).json({
        available: active,
        reason: active ? "" : cfg.enabled ? "no_key" : "disabled",
        role,
        model: modelFor(role, cfg),
        visionModel: visionModelFor(cfg),
        supportsImages: true,
        tools: schemasForRole(role).map((t) => t.function.name),
      });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }

    if (!role) return response.status(401).json({ error: "Silakan masuk dulu untuk memakai Assisten" });

    if (!cfg.enabled) {
      return response.status(503).json({ error: "Assisten sedang dimatikan oleh admin." });
    }
    if (!cfg.hasKey) {
      return response.status(503).json({
        error: "Assisten belum aktif. Admin bisa mengisi API key di Admin Panel → Assisten.",
      });
    }

    const ctx = {
      sql,
      cfg,
      role,
      user: user || { id: "admin", name: "Admin", email: "admin@codexa", phone: "", balance: 0 },
    };

    const history = sanitizeHistory(bodyOf(request).messages);
    if (!history.length) return response.status(400).json({ error: "Pesan tidak boleh kosong" });
    if (history[history.length - 1].role !== "user") {
      return response.status(400).json({ error: "Pesan terakhir harus dari user" });
    }

    const result = await runAssistant({ ctx, history });
    return response.status(200).json({
      reply: result.reply,
      role: ctx.role,
      model: result.model || modelFor(ctx.role, cfg),
      actions: result.actions,
      usage: result.usage,
    });
  } catch (error) {
    const message = (error && error.message) || "";
    console.error("Assistant failure", message);
    if (/QWEN_API_KEY/.test(message)) {
      return response.status(503).json({ error: "Assisten belum dikonfigurasi. Cek Admin Panel → Assisten." });
    }
    if (/DATABASE_URL/.test(message)) {
      return response.status(503).json({ error: "Database belum terhubung. Hubungi admin." });
    }
    if (error && error.status === 429) {
      return response.status(429).json({ error: "Assisten sedang sibuk, coba lagi beberapa saat." });
    }
    if (error && (error.status === 401 || error.status === 403)) {
      return response.status(502).json({ error: "API key Assisten ditolak penyedia AI. Hubungi admin." });
    }
    return response.status(500).json({ error: "Assisten sedang bermasalah, coba lagi." });
  }
};
