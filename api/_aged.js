/* Sistem harga "Aged": harga akun naik otomatis sesuai umur akun.
   Admin hanya mengisi tanggal pembuatan akun (createdAt / accountCreatedAt),
   sisanya dihitung server tiap kali harga dibaca. */

const AGED_TIERS = [
  { maxDays: 7, bonus: 0, label: "Fresh (0-7 hari)" },
  { maxDays: 30, bonus: 2000, label: "Aged 8-30 hari" },
  { maxDays: 90, bonus: 5000, label: "Aged 1-3 bulan" },
  { maxDays: 180, bonus: 10000, label: "Aged 3-6 bulan" },
  { maxDays: 365, bonus: 18000, label: "Aged 6-12 bulan" },
];
const AGED_YEAR_BONUS = 30000; // 1 tahun+
const AGED_EXTRA_PER_YEAR = 10000; // tiap tahun tambahan

function agedDays(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  return days < 0 ? 0 : days;
}

function agedInfo(value) {
  const days = agedDays(value);
  if (days === null) return { days: null, bonus: 0, label: "" };
  for (const tier of AGED_TIERS) {
    if (days <= tier.maxDays) return { days, bonus: tier.bonus, label: tier.label };
  }
  const extraYears = Math.floor((days - 365) / 365);
  const years = 1 + extraYears;
  return {
    days,
    bonus: AGED_YEAR_BONUS + extraYears * AGED_EXTRA_PER_YEAR,
    label: `Aged ${years} tahun+`,
  };
}

function agedBonus(value, enabled) {
  if (enabled === false) return 0;
  return agedInfo(value).bonus;
}

/* Harga efektif satu akun = harga dasar (per akun / default listing) + bonus umur */
function effectiveAccountPrice(account, basePrice, agedEnabled) {
  const fallback = Math.max(0, Math.round(Number(basePrice) || 0));
  const n = Number(account && account.price);
  const base = Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  return base + agedBonus(account && (account.createdAt || account.accountCreatedAt), agedEnabled);
}

module.exports = { AGED_TIERS, AGED_YEAR_BONUS, AGED_EXTRA_PER_YEAR, agedDays, agedInfo, agedBonus, effectiveAccountPrice };
