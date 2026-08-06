/**
 * POST /api/assistant  — chat dengan Assisten CodeXa.
 *
 * Role ditentukan SERVER-SIDE dari cookie sesi:
 *   - cookie admin valid  → role "admin" (akses penuh)
 *   - cookie user valid   → role "user"  (hanya data sendiri)
 *   - tidak ada sesi      → 401
 *
 * Body: { messages: [{ role: "user"|"assistant", content: string }, ...] }
 * Respons: { reply, role, model, actions, usage }
 */

const { db, ensureTables, currentUser, bodyOf } = require("./_users");
const { isAdmin } = require("./admin/_auth");
const { runAssistant, modelFor, schemasForRole } = require("./_assistant");

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
    const admin = isAdmin(request);

    // GET → info kemampuan assisten untuk pemanggil ini (dipakai UI).
    if (request.method === "GET") {
      if (admin) {
        return response.status(200).json({
          available: Boolean(process.env.QWEN_API_KEY),
          role: "admin",
          model: modelFor("admin"),
          tools: schemasForRole("admin").map((t) => t.function.name),
        });
      }
      const sql = db();
      await ensureTables(sql);
      const user = await currentUser(sql, request);
      if (!user) return response.status(401).json({ error: "Silakan masuk dulu untuk memakai Assisten" });
      return response.status(200).json({
        available: Boolean(process.env.QWEN_API_KEY),
        role: "user",
        model: modelFor("user"),
        tools: schemasForRole("user").map((t) => t.function.name),
      });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.QWEN_API_KEY) {
      return response.status(503).json({ error: "Assisten belum aktif. Admin perlu mengatur QWEN_API_KEY." });
    }

    const sql = db();
    await ensureTables(sql);

    let ctx;
    if (admin) {
      ctx = { sql, role: "admin", user: { id: "admin", name: "Admin", email: "admin@codexa", phone: "", balance: 0 } };
    } else {
      const user = await currentUser(sql, request);
      if (!user) return response.status(401).json({ error: "Silakan masuk dulu untuk memakai Assisten" });
      ctx = { sql, role: "user", user };
    }

    const history = sanitizeHistory(bodyOf(request).messages);
    if (!history.length) return response.status(400).json({ error: "Pesan tidak boleh kosong" });
    if (history[history.length - 1].role !== "user") {
      return response.status(400).json({ error: "Pesan terakhir harus dari user" });
    }

    const result = await runAssistant({ ctx, history });
    return response.status(200).json({
      reply: result.reply,
      role: ctx.role,
      model: modelFor(ctx.role),
      actions: result.actions,
      usage: result.usage,
    });
  } catch (error) {
    const message = (error && error.message) || "";
    console.error("Assistant failure", message);
    if (/QWEN_API_KEY/.test(message)) {
      return response.status(503).json({ error: "Assisten belum dikonfigurasi" });
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
