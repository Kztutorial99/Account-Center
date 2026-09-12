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

/* ── Generator komentar: disusun dari banyak potongan kalimat + variasi gaya
   ketik, supaya kombinasinya ribuan dan tidak pernah kembar. ── */
const OPEN = {
  5: ["akunnya aman", "prosesnya cepet", "mantap sih", "puas banget", "lancar jaya",
      "sesuai deskripsi", "gercep banget", "recommended", "top deh", "worth it",
      "alhamdulillah aman", "pelayanan cepet", "mulus tanpa kendala", "sip banget",
      "beneran instan", "amanah sellernya", "kualitas oke", "gak nyesel beli",
      "bagus banget sih ini", "fast banget prosesnya", "murah tapi bener",
      "akhirnya nemu yang jujur", "pengiriman kilat", "keren lah"],
  4: ["lumayan cepet", "oke sih", "akunnya normal", "bagus", "sesuai ekspektasi",
      "aman kok", "cukup memuaskan", "so far oke", "nggak mengecewakan",
      "pelayanan ramah", "prosesnya wajar", "hasilnya memuaskan kok",
      "lumayan puas sih", "sesuai gambar"],
  3: ["standar aja", "lumayan", "bisa dipakai", "ya cukup lah", "biasa aja sih",
      "not bad", "sesuai harga", "cukup oke", "ya gitu deh", "masih wajar"],
  2: ["agak lama sih", "sempet kendala", "kurang sesuai ekspektasi", "prosesnya bertele",
      "agak kecewa", "nunggunya lumayan"],
  1: ["awalnya bermasalah", "sempet gagal login", "sempet deg2an gak masuk", "banyak kendala"],
};
const BODY = {
  5: ["langsung bisa login", "detail akun langsung muncul di pesanan", "gak nunggu lama",
      "adminnya fast respon", "harganya masuk akal", "udah beli beberapa kali di sini",
      "ga ada kendala sama sekali", "settingnya gampang", "langsung ganti password aman",
      "prosesnya cuma hitungan menit", "adminnya sabar jawab pertanyaan",
      "stoknya selalu ada", "datanya valid semua", "cocok buat yang butuh cepet",
      "gampang banget pakainya", "nggak ribet verifikasi"],
  4: ["cuma nunggu bentar", "tinggal verifikasi dikit", "infonya bisa lebih lengkap lagi",
      "loginnya normal", "stoknya semoga nambah", "adminnya responsif kok",
      "cuma perlu baca panduan dikit", "prosesnya lancar walau nggak instan banget"],
  3: ["perlu setting manual dikit", "harus tanya admin dulu", "prosesnya agak lama dari perkiraan",
      "panduannya kurang detail", "loginnya harus verif dulu"],
  2: ["harus chat admin dulu baru beres", "sempet bingung langkahnya", "balesannya agak lama"],
  1: ["untung dibantu admin sampai kelar", "infonya kurang jelas buat pemula",
      "harus bolak balik chat dulu"],
};
const CLOSE = {
  5: ["makasih", "lanjut langganan", "bakal beli lagi", "sukses terus", "recommended seller",
      "makasih bang", "semoga stok terus ada", "", "", "", "", ""],
  4: ["overall oke", "makasih", "semoga makin bagus", "", "", "", ""],
  3: ["semoga next lebih cepet", "semoga ditingkatkan", "", "", ""],
  2: ["semoga diperbaiki", "next semoga lebih rapi", "", ""],
  1: ["tolong diperbaiki ya", "semoga next lebih baik", ""],
};
const TYPOS = [
  [/\bakunnya\b/, "akun nya"],
  [/\bcepet\b/, "cepat"],
  [/\bgak\b/, "ga"],
  [/\bbanget\b/, "bgt"],
  [/\bsudah\b/, "udh"],
  [/\byang\b/, "yg"],
  [/\btapi\b/, "tp"],
  [/\bdengan\b/, "dgn"],
  [/\bmakasih\b/, "mksh"],
  [/\bnggak\b/, "ngga"],
];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function chance(p) {
  return Math.random() < p;
}

/* Susun komentar acak: panjang, tanda baca, dan gaya huruf ikut divariasikan. */
function randomComment(rating) {
  const level = OPEN[rating] ? rating : 4;
  const parts = [pick(OPEN[level])];
  if (chance(0.82)) parts.push(pick(BODY[level]));
  if (chance(0.3)) {
    const extra = pick(BODY[level]);
    if (!parts.includes(extra)) parts.push(extra);
  }
  if (chance(0.45)) {
    const close = pick(CLOSE[level]);
    if (close) parts.push(close);
  }
  let text = parts.join(chance(0.5) ? ", " : ". ");
  for (const [re, rep] of TYPOS) {
    if (chance(0.12)) text = text.replace(re, rep);
  }
  if (chance(0.55)) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (chance(0.6)) text += chance(0.25) ? "!" : ".";
  if (chance(0.06)) text = text.replace(/[.!]$/, "..");
  if (chance(0.08)) text += chance(0.5) ? " 👍" : " 🙏";
  return text.trim().slice(0, 600);
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

/* Sebar tanggal ulasan ke belakang supaya tidak semuanya muncul di jam yang sama. */
function randomDate(spreadDays) {
  const days = Math.max(1, Math.min(365, Number(spreadDays) || 60));
  const ms = randInt(1, days * 24 * 60) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/* Normalisasi teks untuk pengecekan duplikat (abaikan huruf besar & tanda baca). */
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

  /* Semua komentar & nama yang sudah ada di database dikumpulkan dulu supaya
     ulasan baru tidak pernah kembar dengan ulasan lama di produk mana pun. */
  const existing = await sql`SELECT comment, author_name AS "authorName" FROM codexa_listing_reviews`;
  const usedComments = new Set(existing.map((r) => normalizeText(r.comment)));
  const usedNames = new Set(existing.map((r) => normalizeText(r.authorName)));

  let inserted = 0;
  let skipped = 0;
  for (const target of targets) {
    for (let i = 0; i < count; i += 1) {
      const rating = randomRating(minRating, maxRating);
      let comment = "";
      for (let tries = 0; tries < 60; tries += 1) {
        comment = randomComment(rating);
        if (!usedComments.has(normalizeText(comment))) break;
        comment = "";
      }
      if (!comment) { skipped += 1; continue; }
      usedComments.add(normalizeText(comment));

      let author = "";
      for (let tries = 0; tries < 40; tries += 1) {
        author = randomName();
        if (!usedNames.has(normalizeText(author))) break;
        author = "";
      }
      if (!author) author = `${randomName()} ${String.fromCharCode(65 + randInt(0, 25))}.`;
      usedNames.add(normalizeText(author));

      /* created_at = updated_at supaya tidak terlihat pernah "diedit" sistem. */
      const at = randomDate(spreadDays);
      await sql`
        INSERT INTO codexa_listing_reviews (id, listing_id, user_id, rating, comment, author_name, source, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${target}, ${`inject:${crypto.randomUUID()}`}, ${rating},
                ${comment}, ${author}, 'injected', ${at}, ${at})
      `;
      inserted += 1;
    }
  }
  return { inserted, skipped, listings: targets.length };
}

/* ── Inject jumlah terjual per produk (tambah atau set nilai pasti) ── */
async function ensureSalesTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS codexa_listing_sales (
      listing_id TEXT PRIMARY KEY,
      sold_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function injectSold(sql, options) {
  await ensureSalesTable(sql);
  const listingId = String(options.listingId || "").trim();
  const mode = options.soldMode === "set" ? "set" : "add";
  const min = Math.max(0, Math.min(100000, Math.round(Number(options.soldMin) || 0)));
  const max = Math.max(min, Math.min(100000, Math.round(Number(options.soldMax) || min)));

  let targets = [];
  if (!listingId || listingId === "all") {
    const rows = await sql`SELECT id FROM codexa_account_listings ORDER BY created_at DESC`;
    targets = rows.map((r) => r.id);
  } else {
    const [row] = await sql`SELECT id FROM codexa_account_listings WHERE id = ${listingId} LIMIT 1`;
    if (!row) return { error: "Produk tidak ditemukan" };
    targets = [row.id];
  }
  if (!targets.length) return { error: "Belum ada produk" };

  let updated = 0;
  for (const target of targets) {
    const value = randInt(min, max);
    if (mode === "set") {
      await sql`
        INSERT INTO codexa_listing_sales (listing_id, sold_count) VALUES (${target}, ${value})
        ON CONFLICT (listing_id) DO UPDATE SET sold_count = ${value}, updated_at = NOW()
      `;
    } else {
      await sql`
        INSERT INTO codexa_listing_sales (listing_id, sold_count) VALUES (${target}, ${value})
        ON CONFLICT (listing_id)
        DO UPDATE SET sold_count = codexa_listing_sales.sold_count + ${value}, updated_at = NOW()
      `;
    }
    updated += 1;
  }
  return { updated, mode };
}

async function listSales(sql) {
  await ensureSalesTable(sql);
  const rows = await sql`SELECT listing_id AS "listingId", sold_count AS "soldCount" FROM codexa_listing_sales`;
  return rows.map((r) => ({ listingId: r.listingId, soldCount: Math.max(0, Number(r.soldCount) || 0) }));
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
    const [reviews, summary, sales] = await Promise.all([listReviews(sql), reviewSummary(sql), listSales(sql)]);
    const products = await sql`SELECT id, title FROM codexa_account_listings ORDER BY created_at DESC`;
    return response.status(200).json({ reviews, summary, products, sales });
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});

  if (request.method === "POST") {
    /* action=sold → inject jumlah terjual, selain itu inject ulasan. */
    if (String(body.action || "") === "sold") {
      const result = await injectSold(sql, body);
      if (result.error) return response.status(400).json({ error: result.error });
      const sales = await listSales(sql);
      return response.status(201).json({ ...result, sales });
    }
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
