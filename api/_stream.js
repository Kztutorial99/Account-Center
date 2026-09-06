const { ensureNotificationTables } = require("./_notifications");

/**
 * Saluran dorong real-time (Server-Sent Events).
 *
 * Browser membuka satu koneksi panjang ke sini, lalu server yang mendorong
 * sinyal "berubah" begitu ada notifikasi baru / saldo berubah / status top up
 * berganti. Deteksi perubahan dilakukan di sisi server tiap 250 ms dengan satu
 * query ringan, jadi jauh lebih cepat dan jauh lebih hemat dibanding browser
 * menembak /api/notifications tiap detik.
 *
 * Catatan platform: fungsi serverless punya batas durasi, jadi koneksi ditutup
 * rapi sebelum batas dan EventSource menyambung ulang sendiri.
 */

const POLL_MS = 250;
const HEARTBEAT_MS = 15000;
const MAX_LIFETIME_MS = 50000;

async function snapshot(sql, userId) {
  const [notif] = await sql`
    SELECT COUNT(*)::int AS unread,
           COALESCE(MAX(EXTRACT(EPOCH FROM created_at))::bigint, 0) AS last
    FROM codexa_notifications WHERE user_id = ${userId}
  `;
  const [account] = await sql`
    SELECT balance::bigint AS balance FROM codexa_users WHERE id = ${userId} LIMIT 1
  `;
  const [topup] = await sql`
    SELECT COALESCE(MAX(EXTRACT(EPOCH FROM COALESCE(reviewed_at, paid_at, created_at)))::bigint, 0) AS last,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
    FROM codexa_topups WHERE user_id = ${userId}
  `;
  return {
    unread: Number(notif && notif.unread) || 0,
    lastNotification: Number(notif && notif.last) || 0,
    balance: Number(account && account.balance) || 0,
    lastTopup: Number(topup && topup.last) || 0,
    pendingTopup: Number(topup && topup.pending) || 0,
  };
}

const fingerprint = (s) =>
  `${s.unread}:${s.lastNotification}:${s.balance}:${s.lastTopup}:${s.pendingTopup}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handleStream(sql, user, request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  await ensureNotificationTables(sql);

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-cache, no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let alive = true;
  const stop = () => { alive = false; };
  request.on("close", stop);
  request.on("aborted", stop);

  const send = (event, data) => {
    if (!alive) return;
    try {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) { alive = false; }
  };

  // retry: browser menyambung ulang cepat kalau koneksi putus.
  try { response.write("retry: 1000\n\n"); } catch (_) { alive = false; }

  const started = Date.now();
  let last = "";
  let beat = Date.now();
  let failures = 0;

  try {
    const first = await snapshot(sql, user.id);
    last = fingerprint(first);
    send("sync", { ...first, reason: "init", at: Date.now() });
  } catch (error) {
    console.error("Stream init failure", error && error.message);
  }

  while (alive && Date.now() - started < MAX_LIFETIME_MS) {
    await sleep(POLL_MS * (failures ? Math.min(failures, 8) : 1));
    if (!alive) break;
    try {
      const current = await snapshot(sql, user.id);
      const mark = fingerprint(current);
      failures = 0;
      if (mark !== last) {
        last = mark;
        send("sync", { ...current, reason: "change", at: Date.now() });
      }
    } catch (error) {
      failures = Math.min(failures + 1, 8);
    }
    if (alive && Date.now() - beat >= HEARTBEAT_MS) {
      beat = Date.now();
      send("ping", { at: beat });
    }
  }

  if (alive) send("bye", { at: Date.now() });
  try { response.end(); } catch (_) { /* koneksi sudah tertutup */ }
  return undefined;
}

module.exports = { handleStream };
