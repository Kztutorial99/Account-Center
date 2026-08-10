/* ═══════════════════════════════════════════════════
   SEO — meta tag dinamis per halaman (SPA)
   Dipakai oleh App: useEffect(() => applySeo(activePage), [activePage])
════════════════════════════════════════════════════ */
export const SITE_URL = "https://accounter.my.id";
export const SITE_NAME = "CodeXa Store";

const PAGE_SEO = {
  store: {
    path: "/",
    title: "CodeXa Store — Jual Akun Google, Gmail & Akun Digital Terpercaya",
    description:
      "Jual akun Google & Gmail fresh, custom email sesuai nama, serta akun digital lain (game & social media). Proses cepat, harga murah, garansi login.",
    keywords:
      "jual akun google, jual akun gmail, beli akun gmail, custom email, akun digital murah, jual akun game, jual akun social media",
  },
  katalog: {
    path: "/katalog",
    title: "Katalog Akun Digital — Google, Gmail, Game & Social Media | CodeXa",
    description:
      "Lihat katalog lengkap akun digital CodeXa: akun Google/Gmail siap pakai, akun game, dan akun social media. Stok real-time, harga transparan.",
    keywords:
      "katalog akun digital, jual akun gmail, jual akun game, jual akun social media, harga akun google",
  },
  "custom-email": {
    path: "/custom-email",
    title: "Custom Email Gmail Sesuai Nama Sendiri — Cek Ketersediaan | CodeXa",
    description:
      "Pesan akun Gmail dengan nama pilihanmu sendiri. Cek ketersediaan nama otomatis, pembuatan dibantu tim CodeXa, aktif dan siap dipakai.",
    keywords:
      "custom email gmail, buat akun gmail sesuai nama, jasa buat akun google, pesan gmail custom",
  },
  topup: {
    path: "/topup",
    title: "Top Up Saldo CodeXa — QRIS, E-Wallet & Transfer Bank",
    description:
      "Isi saldo CodeXa lewat QRIS, e-wallet (DANA, OVO, GoPay, ShopeePay) atau transfer bank. Saldo langsung bisa dipakai untuk membeli akun digital.",
    keywords: "top up saldo codexa, bayar qris, e-wallet, transfer bank",
  },
  help: {
    path: "/help",
    title: "Bantuan & FAQ CodeXa — Cara Beli Akun Digital",
    description:
      "Panduan lengkap cara membeli akun Google/Gmail dan akun digital lain di CodeXa, metode pembayaran, garansi, dan cara klaim bantuan.",
    keywords: "cara beli akun gmail, faq codexa, bantuan akun digital",
  },
  terms: { path: "/terms", title: "Syarat & Ketentuan | CodeXa Store", description: "Syarat dan ketentuan penggunaan layanan CodeXa Store." },
  privacy: { path: "/privacy", title: "Kebijakan Privasi | CodeXa Store", description: "Kebijakan privasi dan perlindungan data pengguna CodeXa Store." },
  refund: { path: "/refund", title: "Kebijakan Refund | CodeXa Store", description: "Ketentuan pengembalian dana dan garansi produk akun digital CodeXa." },
  disclaimer: { path: "/disclaimer", title: "Disclaimer | CodeXa Store", description: "Disclaimer layanan CodeXa Store." },
  orders: { path: "/orders", title: "Pesanan Saya | CodeXa Store", description: "Riwayat pesanan akun digital kamu di CodeXa.", noindex: true },
  account: { path: "/account", title: "Akun Saya | CodeXa Store", description: "Kelola profil dan saldo akun CodeXa kamu.", noindex: true },
  admin: { path: "/admin", title: "Admin | CodeXa Store", description: "Panel admin CodeXa.", noindex: true },
};

const setMeta = (attr, key, content) => {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setLink = (rel, href) => {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

const setJsonLd = (id, data) => {
  if (typeof document === "undefined") return;
  let el = document.getElementById(id);
  if (!data) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

export function applySeo(page) {
  const seo = PAGE_SEO[page] || PAGE_SEO.store;
  const url = `${SITE_URL}${seo.path}`;
  const image = `${SITE_URL}/favicon.svg`;

  document.title = seo.title;
  setMeta("name", "description", seo.description);
  if (seo.keywords) setMeta("name", "keywords", seo.keywords);
  setMeta("name", "robots", seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
  setLink("canonical", url);

  setMeta("property", "og:type", page === "store" ? "website" : "article");
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:title", seo.title);
  setMeta("property", "og:description", seo.description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:image", image);
  setMeta("property", "og:locale", "id_ID");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", seo.title);
  setMeta("name", "twitter:description", seo.description);
  setMeta("name", "twitter:image", image);

  setJsonLd(
    "ld-breadcrumb",
    page === "store"
      ? null
      : {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Beranda", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: seo.title.split("—")[0].trim(), item: url },
          ],
        },
  );
}

/* Katalog produk → ItemList schema, dipanggil setelah data produk siap. */
export function applyProductSchema(products) {
  const list = Array.isArray(products) ? products.filter(Boolean).slice(0, 30) : [];
  if (!list.length) { setJsonLd("ld-products", null); return; }
  setJsonLd("ld-products", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Katalog akun digital CodeXa",
    itemListElement: list.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.title || "Akun digital",
        description: p.description || "Akun digital siap pakai dari CodeXa.",
        offers: {
          "@type": "Offer",
          price: Number(p.price) || 0,
          priceCurrency: "IDR",
          availability:
            (Number(p.stock) || (Array.isArray(p.accounts) ? p.accounts.length : 0)) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/katalog`,
        },
      },
    })),
  });
}
