const { db, ensureTables, currentUser } = require("./_users");

function normalize(value) {
  const raw = String(value == null ? "" : value).trim().toLowerCase().slice(0, 80);
  if (!raw) return { ok: false, error: "Isi dulu nama email/username" };
  if (raw.includes("@")) {
    if (!/^[a-z0-9._%+-]{3,}@[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return { ok: false, error: "Format email tidak valid" };
    return { ok: true, value: raw };
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(raw)) return { ok: false, error: "Gunakan 3-40 karakter: huruf, angka, titik, garis bawah, atau strip" };
  return { ok: true, value: raw };
}

async function ensureCustomEmailTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_custom_emails (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES codexa_users(id) ON DELETE CASCADE,
      order_id TEXT,
      requested TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS codexa_custom_emails_unique ON codexa_custom_emails (lower(requested))`;
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return response.status(405).json({ error: "Method not allowed" });
    }
    const sql = db();
    await ensureTables(sql);
    const user = await currentUser(sql, request);
    if (!user) return response.status(401).json({ error: "Silakan masuk terlebih dahulu" });

    const check = normalize((request.query && (request.query.value || request.query.email || request.query.username)) || "");
    if (!check.ok) return response.status(200).json({ available: false, normalized: "", reason: check.error });

    await ensureCustomEmailTable(sql);
    const [row] = await sql`SELECT id FROM codexa_custom_emails WHERE lower(requested) = ${check.value} LIMIT 1`;
    const taken = Boolean(row);
    return response.status(200).json({
      available: !taken,
      normalized: check.value,
      reason: taken ? "Sudah dipakai pembeli lain, coba nama lain" : "",
    });
  } catch (error) {
    console.error("Custom email check failure", error && error.message);
    return response.status(500).json({ error: "Pengecekan custom email gagal" });
  }
};
