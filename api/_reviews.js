/* ── Admin: kelola ulasan & rating produk (lihat, inject, hapus) ─────────────
   Dipakai lewat /api/admin/products?resource=reviews supaya jumlah serverless
   function di Vercel tidak bertambah. */
const crypto = require("crypto");

/* Kolom author_name + source ditambahkan idempotent: ulasan hasil inject tidak
   punya baris di codexa_users, jadi nama penulisnya disimpan langsung. */
async function ensureReviewTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_listing_reviews (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS codexa_listing_reviews_uniq ON codexa_listing_reviews (listing_id, user_id)`;
  await sql`ALTER TABLE codexa_listing_reviews ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE codexa_listing_reviews ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE codexa_listing_reviews ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'`;
}

/* ── Bahan ulasan supaya terasa ditulis pembeli asli ── */
const FIRST_NAMES = [
  "Rizky", "Dimas", "Bagus", "Andre", "Fajar", "Yoga", "Ilham", "Reza", "Arif", "Wahyu",
  "Galih", "Hendra", "Rendi", "Adit", "Bayu", "Farhan", "Gilang", "Iqbal", "Nanda", "Teguh",
  "Sari", "Dewi", "Putri", "Anisa", "Rina", "Maya", "Intan", "Nabila", "Fitri", "Salsa",
  "Citra", "Laras", "Ayu", "Tiara", "Vina", "Zahra", "Mega", "Nur", "Rani", "Lia",
];
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Nugroho", "Ramadhan", "Setiawan", "Hidayat", "Firmansyah",
  "Maulana", "Kurniawan", "Anggara", "Putra", "Santoso", "Wibowo", "Halim", "Permana",
  "Lestari", "Anggraini", "Safitri", "Maharani", "Wulandari", "Puspita", "Ananda", "Utami",
];
const USERNAMES = [
  "rzkystore", "dimsgaming", "arf_id", "ryn.official", "nabss", "yog4_", "putrii.a",
  "bagusprtm", "kiky_id", "mayaa.dw", "ilhm.ar", "adit_prj", "vnnzhr", "gilanggg",
];

/* Pola komentar per level rating, ditulis dengan gaya bahasa pembeli Indonesia. */
const COMMENTS = {
  5: [
    "Akun langsung masuk, prosesnya cepat banget. Mantap!",
    "Baru bayar sebentar detail akun udah muncul di menu pesanan. Aman.",
    "Sesuai deskripsi, login lancar tanpa kendala. Recommended.",
    "Udah beli ketiga kali di sini, selalu aman dan gak pernah bermasalah.",
    "Pelayanan cepat, harga masih masuk kantong. Lanjut langganan.",
    "Login pertama langsung bisa ganti data. Puas banget.",
    "Adminnya responsif, akunnya normal semua. Terima kasih!",
    "Prosesnya otomatis, gak perlu nunggu lama. Top!",
    "Kualitas akun bagus, gak ada tanda-tanda kena limit.",
    "Worth it banget buat harganya, akun sehat.",
  ],
  4: [
    "Akun oke, cuma sempat bingung di awal langkah pembayaran.",
    "Bagus, sesuai deskripsi. Semoga stoknya lebih banyak lagi.",
    "Aman dipakai, prosesnya cepat walau sempat delay sedikit.",
    "Lancar sih, tapi saya harap keterangan produknya lebih detail.",
    "Puas dengan akunnya. Minus sedikit karena harus verifikasi ulang.",
    "Sesuai ekspektasi. Kalau ada promo lagi saya beli lagi.",
    "Login normal, cuma perlu waktu buat setting awal.",
    "Overall bagus, pengiriman detail akun cukup cepat.",
  ],
  3: [
    "Akunnya jalan, tapi proses awalnya agak lama dari perkiraan.",
    "Cukup oke buat harga segini, ada beberapa hal yang perlu diatur manual.",
    "Standar. Berfungsi normal tapi belum ada yang bikin wow.",
    "Bisa dipakai, sempat perlu tanya admin dulu buat langkahnya.",
    "Lumayan, semoga next stoknya lebih stabil.",
  ],
  2: [
    "Akun akhirnya bisa dipakai, tapi sempat gagal login beberapa kali.",
    "Butuh bantuan admin dulu baru beres. Agak repot.",
    "Kurang sesuai harapan, keterangannya perlu diperjelas.",
  ],
  1: [
    "Awalnya gak bisa login, untung dibantu admin sampai selesai.",
    "Prosesnya bikin bingung, informasinya kurang jelas.",
  ],
};

const SUFFIX = ["", "", "", "", " 👍", " 🔥", " Makasih ya!", " Semoga stok terus ada."];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomName() {
  const roll = Math.random();
  if (roll < 0.18) return pick(USERNAMES);
  if (roll < 0.4) return pick(FIRST_NAMES);
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

/* Distribusi rating: mayoritas 4-5 bintang seperti marketplace normal. */
function randomRating(min, max) {
  const weights = { 5: 55, 4: 27, 3: 11, 2: 5, 1: 2 };
  const pool = [];
  for (let star = min; star <= max; star += 1) {
    for (let i = 0; i < (weights[star] || 1); i += 1) pool.push(star);
  }
  return pool.length ? pick(pool) : max;
}

function randomComment(rating) {
  const base = pick(COMMENTS[rating] || COMMENTS[4]);
  return `${base}${pick(SUFFIX)}`.trim().slice(0, 600);
}

/* Sebar tanggal ulasan ke belakang supaya tidak semuanya muncul di jam yang sama. */
function randomDate(spreadDays) {
  const days = Math.max(1, Math.min(365, Number(spreadDays) || 60));
  const ms = randInt(1, days * 24 * 60) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/* Daftar lengkap ulasan untuk panel admin (asli + hasil inject). */
async function listReviews(sql, limit = 400) {
  const rows = await sql`
    SELECT r.id, r.listing_id AS "listingId", r.rating, r.comment, r.source,
           r.created_at AS "createdAt", r.updated_at AS "updatedAt",
           COALESCE(NULLIF(r.author_name, ''), u.name, u.email, 'Pengguna') AS "author",
           u.email AS "userEmail",
           l.title AS "listingTitle"
    FROM codexa_listing_reviews r
    LEFT JOIN codexa_users u ON u.id = r.user_id
    LEFT JOIN codexa_account_listings l ON l.id = r.listing_id
    ORDER BY r.updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle || "(produk terhapus)",
    rating: Number(row.rating) || 0,
    comment: String(row.comment || ""),
    author: String(row.author || "Pengguna"),
    userEmail: row.userEmail || "",
    source: row.source === "injected" ? "injected" : "user",
    createdAt: row.createdAt,
  }));
}

async function reviewSummary(sql) {
  const [row] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE source = 'injected')::int AS injected,
           COALESCE(AVG(rating), 0)::float AS avg
    FROM codexa_listing_reviews
  `;
  return {
    total: Number(row && row.total) || 0,
    injected: Number(row && row.injected) || 0,
    user: (Number(row && row.total) || 0) - (Number(row && row.injected) || 0),
    ratingAvg: Math.round(((row && Number(row.avg)) || 0) * 10) / 10,
  };
}

/* Tambahkan ulasan + rating buatan ke satu produk atau ke semua produk. */
async function injectReviews(sql, options) {
  const count = Math.max(1, Math.min(200, Math.round(Number(options.count) || 0)));
  const minRating = Math.max(1, Math.min(5, Math.round(Number(options.minRating) || 4)));
  const maxRating = Math.max(minRating, Math.min(5, Math.round(Number(options.maxRating) || 5)));
  const spreadDays = Math.max(1, Math.min(365, Math.round(Number(options.spreadDays) || 60)));
  const listingId = String(options.listingId || "").trim();

  let targets = [];
  if (!listingId || listingId === "all") {
    const rows = await sql`SELECT id FROM codexa_account_listings ORDER BY created_at DESC`;
    targets = rows.map((r) => r.id);
  } else {
    const [row] = await sql`SELECT id FROM codexa_account_listings WHERE id = ${listingId} LIMIT 1`;
    if (!row) return { error: "Produk tidak ditemukan" };
    targets = [row.id];
  }
  if (!targets.length) return { error: "Belum ada produk untuk diberi ulasan" };

  let inserted = 0;
  for (const target of targets) {
    for (let i = 0; i < count; i += 1) {
      const rating = randomRating(minRating, maxRating);
      await sql`
        INSERT INTO codexa_listing_reviews (id, listing_id, user_id, rating, comment, author_name, source, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${target}, ${`inject:${crypto.randomUUID()}`}, ${rating},
                ${randomComment(rating)}, ${randomName()}, 'injected', ${randomDate(spreadDays)}, ${randomDate(spreadDays)})
      `;
      inserted += 1;
    }
  }
  return { inserted, listings: targets.length };
}

async function deleteReviews(sql, body) {
  const id = String((body && body.id) || "").trim();
  const scope = String((body && body.scope) || "").trim();
  const listingId = String((body && body.listingId) || "").trim();

  if (scope === "injected") {
    const rows = listingId && listingId !== "all"
      ? await sql`DELETE FROM codexa_listing_reviews WHERE source = 'injected' AND listing_id = ${listingId} RETURNING id`
      : await sql`DELETE FROM codexa_listing_reviews WHERE source = 'injected' RETURNING id`;
    return { deleted: rows.length };
  }
  if (!id) return { error: "id ulasan wajib diisi" };
  const rows = await sql`DELETE FROM codexa_listing_reviews WHERE id = ${id} RETURNING id`;
  if (!rows.length) return { error: "Ulasan tidak ditemukan" };
  return { deleted: 1 };
}

/* Handler resource=reviews yang dipanggil dari api/admin/products.js */
async function handleReviewRequest(sql, request, response) {
  await ensureReviewTables(sql);

  if (request.method === "GET") {
    const [reviews, summary] = await Promise.all([listReviews(sql), reviewSummary(sql)]);
    const products = await sql`SELECT id, title FROM codexa_account_listings ORDER BY created_at DESC`;
    return response.status(200).json({ reviews, summary, products });
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});

  if (request.method === "POST") {
    const result = await injectReviews(sql, body);
    if (result.error) return response.status(400).json({ error: result.error });
    const [reviews, summary] = await Promise.all([listReviews(sql), reviewSummary(sql)]);
    return response.status(201).json({ ...result, reviews, summary });
  }

  if (request.method === "DELETE") {
    const result = await deleteReviews(sql, body);
    if (result.error) return response.status(result.error === "Ulasan tidak ditemukan" ? 404 : 400).json({ error: result.error });
    const [reviews, summary] = await Promise.all([listReviews(sql), reviewSummary(sql)]);
    return response.status(200).json({ ...result, reviews, summary });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed" });
}

module.exports = { handleReviewRequest, ensureReviewTables };
