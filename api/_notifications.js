const crypto = require("crypto");

/**
 * Notifikasi in-app untuk user CodeXa.
 * Dipakai oleh: top up (diajukan / disetujui / ditolak) dan checkout akun.
 */

async function ensureNotificationTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES codexa_users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS codexa_notifications_user_idx ON codexa_notifications (user_id, created_at DESC)`;
}

const clamp = (value, max) => String(value == null ? "" : value).slice(0, max);

/**
 * Simpan satu notifikasi. Dibuat tahan gagal: kegagalan menulis notifikasi
 * tidak boleh membatalkan transaksi utama (top up / checkout).
 */
async function createNotification(sql, { userId, type, title, body, link } = {}) {
  if (!userId || !title) return null;
  try {
    await ensureNotificationTables(sql);
    const [row] = await sql`
      INSERT INTO codexa_notifications (id, user_id, type, title, body, link)
      VALUES (${crypto.randomUUID()}, ${userId}, ${clamp(type || "info", 30)},
              ${clamp(title, 160)}, ${clamp(body, 600)}, ${clamp(link, 60)})
      RETURNING id
    `;
    return row || null;
  } catch (error) {
    console.error("Notification write failure", error && error.message);
    return null;
  }
}

module.exports = { ensureNotificationTables, createNotification };
