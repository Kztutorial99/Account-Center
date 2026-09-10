/* Sistem harga "Aged": harga akun naik otomatis sesuai umur akun.
   Admin hanya mengisi tanggal pembuatan akun (createdAt / accountCreatedAt),
   sisanya dihitung server tiap kali harga dibaca.

   Sejak versi ini, tingkatan (tier) bonus umur bisa diatur admin dari
   panel (Menu "Harga Aged"). Nilainya disimpan di tabel codexa_settings
   dengan key "aged"; kalau belum pernah diatur dipakai nilai default. */

const { ensureSettingsTable } = require("./_settings");

const AGED_TIERS = [
  { maxDays: 7, bonus: 0, label: "Fresh (0-7 hari)" },
  { maxDays: 30, bonus: 2000, label: "Aged 8-30 hari" },
  { maxDays: 90, bonus: 5000, label: "Aged 1-3 bulan" },
  { maxDays: 180, bonus: 10000, label: "Aged 3-6 bulan" },
  { maxDays: 365, bonus: 18000, label: "Aged 6-12 bulan" },
];
const AGED_YEAR_BONUS = 30000; // 1 tahun+
const AGED_EXTRA_PER_YEAR = 10000; // tiap tahun tambahan

const AGED_KEY = "aged";
const DEFAULT_AGED_CONFIG = {
  enabled: true,
  tiers: AGED_TIERS,
  yearBonus: AGED_YEAR_BONUS,
  extraPerYear: AGED_EXTRA_PER_YEAR,
};

function int(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Bersihkan konfigurasi apa pun jadi bentuk yang aman dipakai & disimpan. */
function normalizeAgedConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(src.tiers) && src.tiers.length ? src.tiers : DEFAULT_AGED_CONFIG.tiers;
  const tiers = list
    .slice(0, 12)
    .map((t) => ({
      maxDays: int(t && t.maxDays, 7, 1, 36500),
      bonus: int(t && t.bonus, 0, 0, 100000000),
      label: typeof (t && t.label) === "string" ? t.label.trim().slice(0, 60) : "",
    }))
    .sort((a, b) => a.maxDays - b.maxDays)
    .map((t) => ({ ...t, label: t.label || `Aged s/d ${t.maxDays} hari` }));
  return {
    enabled: src.enabled !== false,
    tiers,
    yearBonus: int(src.yearBonus, AGED_YEAR_BONUS, 0, 100000000),
    extraPerYear: int(src.extraPerYear, AGED_EXTRA_PER_YEAR, 0, 100000000),
  };
}

/* Cache singkat supaya tiap request tidak selalu query settings. */
let cache = { value: null, at: 0 };
const CACHE_MS = 20000;

async function readAgedConfig(sql, { fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  let stored = null;
  try {
    await ensureSettingsTable(sql);
    const rows = await sql`SELECT value FROM codexa_settings WHERE key = ${AGED_KEY} LIMIT 1`;
    stored = rows.length ? rows[0].value : null;
    if (typeof stored === "string") { try { stored = JSON.parse(stored); } catch (_) { stored = null; } }
  } catch (_) {
    /* database belum siap → pakai default */
  }
  const config = normalizeAgedConfig(stored || DEFAULT_AGED_CONFIG);
  cache = { value: config, at: Date.now() };
  return config;
}

async function writeAgedConfig(sql, patch) {
  const current = await readAgedConfig(sql, { fresh: true });
  const next = normalizeAgedConfig({ ...current, ...(patch || {}) });
  await ensureSettingsTable(sql);
  await sql`
    INSERT INTO codexa_settings (key, value, updated_at)
    VALUES (${AGED_KEY}, ${JSON.stringify(next)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(next)}::jsonb, updated_at = NOW()
  `;
  cache = { value: next, at: Date.now() };
  return next;
}

function agedDays(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  return days < 0 ? 0 : days;
}

function agedInfo(value, config) {
  const cfg = config ? normalizeAgedConfig(config) : DEFAULT_AGED_CONFIG;
  const days = agedDays(value);
  if (days === null) return { days: null, bonus: 0, label: "" };
  if (cfg.enabled === false) return { days, bonus: 0, label: "Harga tetap" };
  for (const tier of cfg.tiers) {
    if (days <= tier.maxDays) return { days, bonus: tier.bonus, label: tier.label };
  }
  const last = cfg.tiers[cfg.tiers.length - 1] || { maxDays: 365 };
  const extraYears = Math.max(0, Math.floor((days - last.maxDays) / 365));
  const years = 1 + extraYears;
  return {
    days,
    bonus: cfg.yearBonus + extraYears * cfg.extraPerYear,
    label: `Aged ${years} tahun+`,
  };
}

function agedBonus(value, enabled, config) {
  if (enabled === false) return 0;
  return agedInfo(value, config).bonus;
}

/* Harga efektif satu akun = harga dasar (per akun / default listing) + bonus umur */
function effectiveAccountPrice(account, basePrice, agedEnabled, config) {
  const fallback = Math.max(0, Math.round(Number(basePrice) || 0));
  const n = Number(account && account.price);
  const base = Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  return base + agedBonus(account && (account.createdAt || account.accountCreatedAt), agedEnabled, config);
}

module.exports = {
  AGED_TIERS,
  AGED_YEAR_BONUS,
  AGED_EXTRA_PER_YEAR,
  DEFAULT_AGED_CONFIG,
  normalizeAgedConfig,
  readAgedConfig,
  writeAgedConfig,
  agedDays,
  agedInfo,
  agedBonus,
  effectiveAccountPrice,
};
