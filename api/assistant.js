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
const { runAssistant, modelFor, schemasForRole } = require("./_assistant");
const { assistantConfig } = require("./_settings");

const MAX_HISTORY = 24;
const MAX_CHARS = 4000;

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .filter((m) => m.content.length > 0)
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
    let role = "";
    let user = null;
    if (adminCookie) {
      role = "admin";
    } else {
      user = await currentUser(sql, request);
      if (user) role = user.role === "admin" ? "admin" : "user";
    }

    // GET → info kemampuan assisten untuk pemanggil ini (dipakai UI).
    if (request.method === "GET") {
      if (!role) return response.status(401).json({ error: "Silakan masuk dulu untuk memakai Assisten" });
      return response.status(200).json({
        available: active,
        reason: active ? "" : cfg.enabled ? "no_key" : "disabled",
        role,
        model: modelFor(role, cfg),
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
      model: modelFor(ctx.role, cfg),
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
