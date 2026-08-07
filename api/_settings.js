/**
 * Pengaturan runtime yang bisa diubah admin dari panel (disimpan di database).
 *
 * Kenapa di database: supaya admin bisa mengatur API key / model Assisten
 * langsung dari admin panel tanpa harus buka dashboard Vercel dan redeploy.
 * Env var tetap dipakai sebagai fallback bila belum diisi dari panel.
 */

const DEFAULT_BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL_ADMIN = "qwen3.8-max";
const DEFAULT_MODEL_USER = "qwen3.7-flash";

const ASSISTANT_KEY = "assistant";

const DEFAULTS = {
  enabled: true,
  apiKey: "",
  baseUrl: "",
  modelAdmin: "",
  modelUser: "",
  maxSteps: 6,
  temperature: 0.3,
  extraPrompt: "",
};

async function ensureSettingsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** Baca setting mentah (apa yang diisi admin), belum dicampur env. */
async function readAssistantSettings(sql) {
  await ensureSettingsTable(sql);
  const rows = await sql`SELECT value, updated_at AS "updatedAt" FROM codexa_settings WHERE key = ${ASSISTANT_KEY} LIMIT 1`;
  const stored = (rows.length && rows[0].value) || {};
  const parsed = typeof stored === "string" ? safeParse(stored) : stored;
  return {
    ...DEFAULTS,
    ...parsed,
    updatedAt: rows.length ? rows[0].updatedAt : null,
  };
}

async function writeAssistantSettings(sql, patch) {
  const current = await readAssistantSettings(sql);
  const { updatedAt, ...base } = current;
  const next = { ...base, ...patch };
  await sql`
    INSERT INTO codexa_settings (key, value, updated_at)
    VALUES (${ASSISTANT_KEY}, ${JSON.stringify(next)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(next)}::jsonb, updated_at = NOW()
  `;
  return next;
}

/**
 * Konfigurasi efektif Assisten: setting panel dulu, lalu env var, lalu default.
 * Selalu dipakai oleh /api/assistant dan otak assisten.
 */
async function assistantConfig(sql) {
  let saved = { ...DEFAULTS };
  try {
    saved = await readAssistantSettings(sql);
  } catch (_) {
    // database belum siap → tetap jalan pakai env
  }
  const apiKey = trim(saved.apiKey) || trim(process.env.QWEN_API_KEY);
  const maxSteps = clampInt(saved.maxSteps, 1, 10, 6);
  return {
    enabled: saved.enabled !== false,
    apiKey,
    hasKey: Boolean(apiKey),
    keySource: trim(saved.apiKey) ? "panel" : trim(process.env.QWEN_API_KEY) ? "env" : "none",
    baseUrl: (trim(saved.baseUrl) || trim(process.env.QWEN_BASE_URL) || DEFAULT_BASE).replace(/\/+$/, ""),
    modelAdmin: trim(saved.modelAdmin) || trim(process.env.QWEN_MODEL) || DEFAULT_MODEL_ADMIN,
    modelUser:
      trim(saved.modelUser) || trim(process.env.QWEN_MODEL_USER) || trim(process.env.QWEN_MODEL) || DEFAULT_MODEL_USER,
    maxSteps,
    temperature: clampNum(saved.temperature, 0, 2, 0.3),
    extraPrompt: trim(saved.extraPrompt).slice(0, 2000),
    updatedAt: saved.updatedAt || null,
  };
}

/** Bentuk aman untuk dikirim ke browser: key tidak pernah dikirim utuh. */
function publicAssistantConfig(cfg) {
  return {
    enabled: cfg.enabled,
    hasKey: cfg.hasKey,
    keySource: cfg.keySource,
    keyPreview: maskKey(cfg.apiKey),
    baseUrl: cfg.baseUrl,
    modelAdmin: cfg.modelAdmin,
    modelUser: cfg.modelUser,
    maxSteps: cfg.maxSteps,
    temperature: cfg.temperature,
    extraPrompt: cfg.extraPrompt,
    updatedAt: cfg.updatedAt,
  };
}

function maskKey(key) {
  const value = trim(key);
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}••••`;
  return `${value.slice(0, 5)}••••${value.slice(-4)}`;
}

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}
function safeParse(value) {
  try {
    return JSON.parse(value) || {};
  } catch (_) {
    return {};
  }
}
function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function clampNum(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

module.exports = {
  DEFAULT_BASE,
  DEFAULT_MODEL_ADMIN,
  DEFAULT_MODEL_USER,
  ensureSettingsTable,
  readAssistantSettings,
  writeAssistantSettings,
  assistantConfig,
  publicAssistantConfig,
  maskKey,
  clampInt,
  clampNum,
};
