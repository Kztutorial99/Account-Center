/* ═══════════════════════════════════════════════════
   HALAMAN KATEGORI PRODUK (SEO landing per kategori)
   /produk/gmail-fresh, /produk/custom-gmail, /produk/gmail-aged,
   /produk/akun-game, /produk/akun-social-media
════════════════════════════════════════════════════ */
import React from "react";
import { ShoppingBag, ArrowRight, CircleHelp, ShieldCheck } from "lucide-react";

export const CATEGORY_PAGES = {
  "produk/gmail-fresh": {
    cta: { label: "Lihat Gmail Fresh", query: "fresh" },

    label: "Gmail Fresh",
    badge: "Gmail Fresh",
    h1: "Jual Akun Gmail Fresh (No-PVA) Murah",
    lead: "Akun Gmail baru dibuat, belum pernah dipakai, dan belum terikat nomor telepon. Jumlah akun yang kamu terima sesuai jumlah yang dibeli, dikirim instan setelah pembayaran.",
    intro: [
      "Akun Gmail fresh cocok untuk kebutuhan pendaftaran layanan, uji coba aplikasi, pengelolaan banyak profil, dan otomasi ringan. Karena statusnya masih baru, riwayat akun benar-benar bersih.",
      "Setiap akun dikirim dalam format email dan password. Setelah menerima detail login, segera ganti password dan tambahkan data pemulihan milikmu sendiri.",
    ],
    points: [
      ["Status fresh", "Akun baru dibuat, belum pernah digunakan pembeli lain."],
      ["Tipe No-PVA", "Belum diverifikasi nomor telepon, sehingga bebas kamu atur ulang."],
      ["Format kiriman", "email + password per akun, tampil otomatis di menu Pesanan."],
      ["Recovery kosong", "Email pemulihan masih kosong dan bisa kamu isi sendiri."],
      ["Harga bertingkat", "Semakin banyak jumlah pembelian, harga per akun makin murah."],
      ["Garansi login", "Akun yang gagal login saat pengecekan pertama diganti sesuai kebijakan refund."],
    ],
    faq: [
      ["Apa arti Gmail fresh dan No-PVA?", "Fresh berarti akun baru dibuat dan belum pernah dipakai. No-PVA berarti akun belum diverifikasi dengan nomor telepon, jadi kamu bisa menambahkan nomor sendiri bila diperlukan."],
      ["Berapa akun yang saya dapat?", "Sesuai jumlah yang kamu beli. Beli 5 akun berarti menerima 5 akun berbeda, tidak ada hitungan bonus atau potongan."],
      ["Apakah akun bisa dipakai jangka panjang?", "Bisa, asal langsung diamankan: ganti password, tambahkan email atau nomor pemulihan, dan hindari aktivitas yang melanggar kebijakan Google."],
    ],
  },
  "produk/custom-gmail": {
    cta: { label: "Pesan Custom Gmail", page: "custom-email" },

    label: "Custom Gmail",
    badge: "Custom Gmail",
    h1: "Custom Gmail Sesuai Nama Sendiri",
    lead: "Pesan akun Gmail dengan nama atau username pilihanmu. Cek ketersediaan nama otomatis, lalu akun dibuat manual oleh tim kami.",
    intro: [
      "Custom Gmail cocok untuk nama brand, nama pribadi, atau format username khusus yang ingin kamu pakai jangka panjang. Ketersediaan nama dicek langsung sebelum pesanan diproses.",
      "Karena dibuat manual satu per satu, harga custom Gmail sedikit lebih tinggi dari Gmail fresh biasa.",
    ],
    points: [
      ["Nama sesuai request", "Kamu menentukan sendiri alamat email yang diinginkan."],
      ["Cek ketersediaan", "Sistem memeriksa nama sebelum pesanan diproses supaya tidak gagal."],
      ["Dibuat manual", "Tim kami membuat akun, memastikan bisa login, lalu mengirim detailnya."],
      ["Bisa fresh atau PVA", "Pilih akun biasa atau yang sudah diverifikasi nomor."],
      ["Cocok untuk brand", "Alamat email profesional untuk toko, jasa, atau proyek pribadi."],
      ["Garansi login", "Detail login diverifikasi sebelum dikirim ke kamu."],
    ],
    faq: [
      ["Bagaimana cara pesan custom Gmail?", "Buka halaman Custom Email, ketik nama yang diinginkan, cek ketersediaannya, lalu kirim pesanan. Tim kami membuat akunnya dan mengirim detail login ke menu Pesanan."],
      ["Berapa lama prosesnya?", "Karena dibuat manual, umumnya lebih lama dari akun siap pakai. Kamu akan mendapat notifikasi begitu akun selesai."],
      ["Kalau nama sudah dipakai orang lain?", "Sistem akan memberi tahu saat pengecekan dan kamu bisa langsung mencoba variasi nama lain."],
    ],
  },
  "produk/gmail-aged": {
    cta: { label: "Lihat Gmail Aged", query: "aged" },

    label: "Gmail Aged",
    badge: "Gmail Aged",
    h1: "Jual Akun Gmail Aged (Akun Lama / Tua)",
    lead: "Akun Gmail yang sudah berumur, dengan harga otomatis menyesuaikan usia akun. Semakin lama umur akun, semakin tinggi nilainya.",
    intro: [
      "Akun aged umumnya lebih stabil karena sudah melewati masa awal pembuatan. Banyak dipakai untuk kebutuhan yang menuntut akun dengan riwayat lebih panjang.",
      "Harga dihitung otomatis dari tanggal pembuatan akun, jadi harga yang kamu lihat selalu sesuai umur akun terkini.",
    ],
    points: [
      ["Umur transparan", "Umur akun ditampilkan apa adanya, dihitung dari tanggal pembuatan."],
      ["Harga otomatis", "Bonus umur ditambahkan otomatis sesuai tingkatan usia akun."],
      ["Lebih stabil", "Akun yang sudah berumur cenderung tidak semudah terkena pembatasan awal."],
      ["Format kiriman", "email + password per akun, langsung tersedia di menu Pesanan."],
      ["Stok real-time", "Ketersediaan akun aged mengikuti stok yang ada di database."],
      ["Garansi login", "Gagal login pada pengecekan pertama diganti sesuai kebijakan refund."],
    ],
    faq: [
      ["Apa itu akun Gmail aged?", "Akun Gmail yang sudah dibuat sejak beberapa waktu lalu, bukan akun baru. Umurnya dihitung dari tanggal pembuatan akun."],
      ["Kenapa harganya berbeda-beda?", "Harga akun aged mengikuti umurnya. Semakin lama umur akun, bonus harga yang ditambahkan semakin besar."],
      ["Apakah harga bisa berubah sendiri?", "Ya, harga naik otomatis mengikuti pertambahan umur akun tanpa perlu diubah manual."],
    ],
  },
  "produk/akun-game": {
    cta: { label: "Lihat Akun Game", query: "game" },

    label: "Akun Game",
    badge: "Akun Game",
    h1: "Jual Akun Game Murah & Aman",
    lead: "Akun game siap pakai dengan detail login yang dikirim instan setelah pembayaran terverifikasi.",
    intro: [
      "Ketersediaan akun game mengikuti stok real-time di katalog. Setiap listing mencantumkan keterangan akun agar kamu tahu isi dan kondisinya sebelum membeli.",
      "Setelah menerima akun, segera amankan dengan mengganti password dan mengaitkan email milikmu sendiri bila didukung game tersebut.",
    ],
    points: [
      ["Stok real-time", "Jumlah akun tersedia mengikuti database, bukan perkiraan."],
      ["Detail jelas", "Keterangan akun ditulis pada setiap listing sebelum kamu beli."],
      ["Pengiriman instan", "Detail login terbuka otomatis di menu Pesanan setelah bayar."],
      ["Harga transparan", "Tanpa biaya tersembunyi, harga sesuai yang tertera."],
      ["Bayar mudah", "QRIS, e-wallet, atau transfer bank lewat saldo Akun Instan."],
      ["Garansi login", "Klaim bisa diajukan sesuai kebijakan refund kalau akun tidak bisa masuk."],
    ],
    faq: [
      ["Akun game apa saja yang tersedia?", "Ketersediaan mengikuti stok terbaru di katalog. Silakan cek katalog untuk melihat daftar akun yang sedang tersedia."],
      ["Apakah akun bisa diikat ke email saya?", "Tergantung game-nya. Kalau game mendukung penggantian email dan password, sebaiknya segera lakukan setelah menerima akun."],
      ["Bagaimana kalau akun tidak bisa login?", "Ajukan klaim lewat halaman Bantuan sesuai kebijakan refund dan sertakan bukti pengecekan."],
    ],
  },
  "produk/akun-social-media": {
    cta: { label: "Lihat Akun Social Media", query: "social" },

    label: "Akun Social Media",
    badge: "Social Media",
    h1: "Jual Akun Social Media Siap Pakai",
    lead: "Akun social media siap pakai untuk kebutuhan promosi, pengelolaan konten, atau pendaftaran layanan. Dikirim instan setelah pembayaran.",
    intro: [
      "Setiap listing menampilkan keterangan akun, kondisi, dan format kiriman sehingga kamu tahu apa yang diterima sebelum membeli.",
      "Disarankan mengganti password dan mengaitkan data pemulihan milikmu sendiri setelah akun diterima.",
    ],
    points: [
      ["Beragam platform", "Ketersediaan mengikuti stok terbaru pada katalog."],
      ["Format kiriman jelas", "Username atau email beserta password, sesuai keterangan listing."],
      ["Pengiriman instan", "Detail akun tersedia otomatis di menu Pesanan."],
      ["Harga transparan", "Harga per akun tertera jelas, tanpa biaya tambahan."],
      ["Bayar fleksibel", "QRIS, e-wallet, atau transfer bank lewat saldo."],
      ["Garansi login", "Akun gagal login diganti sesuai ketentuan refund."],
    ],
    faq: [
      ["Akun social media apa yang dijual?", "Sesuai stok yang tersedia di katalog saat ini. Daftar bisa berubah setiap hari."],
      ["Apakah akun aman dipakai promosi?", "Amankan dulu akunnya: ganti password, isi data pemulihan, dan hindari aktivitas yang melanggar aturan platform."],
      ["Bisa beli banyak sekaligus?", "Bisa, selama stok mencukupi. Jumlah akun yang diterima sesuai jumlah yang dibeli."],
    ],
  },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_PAGES);

export function CategoryPage({ slug, navigate, onOpenCatalog }) {
  const data = CATEGORY_PAGES[slug];
  if (!data) return null;
  const cta = data.cta || { label: "Lihat katalog" };
  // Tombol utama mengarah ke produk kategori ini (bukan katalog umum).
  const openCategory = () => {
    if (cta.page) { navigate(cta.page); return; }
    if (typeof onOpenCatalog === "function") { onOpenCatalog(cta.query || ""); return; }
    navigate("katalog");
  };
  const openAll = () => {
    if (typeof onOpenCatalog === "function") { onOpenCatalog(""); return; }
    navigate("katalog");
  };
  return (
    <main className="cx-help">
      <div className="cx-container">
        <section className="cx-help-hero">
          <span className="cx-help-badge"><ShoppingBag size={12} /> {data.badge}</span>
          <h1>{data.h1}</h1>
          <p>{data.lead}</p>
          <div className="cx-help-cta">
            <button className="cx-btn cx-btn-primary" onClick={openCategory}>
              <ShoppingBag size={13} /> {cta.label}
            </button>
            <button className="cx-btn cx-btn-ghost" onClick={openAll}>
              <ArrowRight size={13} /> Semua katalog
            </button>
          </div>
        </section>

        <section className="cx-help-section">
          <h2>Tentang {data.label}</h2>
          {data.intro.map((p) => <p key={p} className="cx-cat-text">{p}</p>)}
        </section>

        <section className="cx-help-section">
          <h2>Spesifikasi &amp; keunggulan</h2>
          <ol className="cx-help-steps">
            {data.points.map(([title, body], i) => (
              <li key={title}>
                <span className="cx-help-step-no">{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="cx-help-section">
          <h2>Pertanyaan umum</h2>
          <ol className="cx-help-steps">
            {data.faq.map(([q, a], i) => (
              <li key={q}>
                <span className="cx-help-step-no">{i + 1}</span>
                <div>
                  <strong>{q}</strong>
                  <p>{a}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="cx-help-section">
          <h2>Kategori lainnya</h2>
          <div className="cx-cat-links">
            {CATEGORY_SLUGS.filter((s) => s !== slug).map((s) => (
              <button key={s} className="cx-btn cx-btn-secondary cx-btn-sm" onClick={() => navigate(s)}>
                {CATEGORY_PAGES[s].label}
              </button>
            ))}
          </div>
        </section>

        <section className="cx-help-contact">
          <div>
            <strong>Siap beli {data.label}?</strong>
            <p>Stok diperbarui real-time. Pilih akun {data.label.toLowerCase()}, bayar, dan detail login langsung tersedia.</p>
          </div>
          <button className="cx-btn cx-btn-primary" onClick={openCategory}>
            <ShieldCheck size={13} /> {cta.label}
          </button>
        </section>

        <p className="cx-cat-note">
          <CircleHelp size={12} /> Masih ragu? Baca <button className="cx-cat-inline" onClick={() => navigate("faq")}>FAQ</button> atau hubungi admin lewat <button className="cx-cat-inline" onClick={() => navigate("help")}>halaman Bantuan</button>.
        </p>
      </div>
    </main>
  );
}
