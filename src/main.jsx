import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Headphones,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

const formatPrice = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function App() {
  const [activePage, setActivePage] = useState("store");
  const [search, setSearch] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({
    products: [],
    orders: [],
    customerCount: 0,
    loading: true,
    error: "",
  });

  useEffect(() => {
    fetch("/api/data")
      .then(async (result) => {
        const payload = await result.json();
        if (!result.ok) throw new Error(payload.error || "Data tidak tersedia");
        return payload;
      })
      .then((payload) =>
        setData({
          products: Array.isArray(payload.products) ? payload.products : [],
          orders: Array.isArray(payload.orders) ? payload.orders : [],
          customerCount: Number(payload.customerCount) || 0,
          loading: false,
          error: "",
        }),
      )
      .catch((error) =>
        setData((current) => ({
          ...current,
          loading: false,
          error: error.message,
        })),
      );
  }, []);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.products;
    return data.products.filter((product) =>
      `${product.title || ""} ${product.description || ""}`.toLowerCase().includes(query),
    );
  }, [data.products, search]);

  const navigate = (page) => {
    setActivePage(page);
    setShowMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="brand" onClick={() => navigate("store")} aria-label="Kembali ke toko">
            <span className="brand-mark">&lt;/&gt;</span>
            <span>Code<span className="brand-dot">Xa</span></span>
          </button>
          <nav className={`main-nav ${showMobileMenu ? "is-open" : ""}`}>
            <button className={activePage === "store" ? "active" : ""} onClick={() => navigate("store")}>Store</button>
            <button className={activePage === "orders" ? "active" : ""} onClick={() => navigate("orders")}>Pesanan</button>
            <button className={activePage === "help" ? "active" : ""} onClick={() => navigate("help")}>Bantuan</button>
          </nav>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={17} /></button>
            <button className="avatar-button" onClick={() => navigate("admin")} aria-label="Buka panel admin">CX</button>
            <button className="mobile-menu-button" onClick={() => setShowMobileMenu((open) => !open)} aria-label="Buka menu"><Menu size={20} /></button>
          </div>
        </div>
      </header>

      {activePage === "store" && (
        <main>
          <section className="hero container">
            <div className="hero-copy">
              <p className="section-kicker">CODEXA ACCESS</p>
              <h1>Akun digital,<br /><em>tanpa drama.</em></h1>
              <p className="hero-lede">Katalog ini terhubung ke data akun nyata. Tidak ada akun contoh atau stok palsu yang ditampilkan.</p>
              <button className="primary-button" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
                Lihat katalog <ArrowRight size={15} />
              </button>
            </div>
            <div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><span className="hero-star">✦</span><div className="hero-card"><span>LIVE DATA</span><strong>NEON DB</strong><small>NO MOCK ACCOUNTS</small></div></div>
          </section>

          <section className="container catalog-section" id="catalog">
            <div className="section-heading">
              <div><p className="section-kicker">CATALOG</p><h2>Akun yang tersedia.</h2></div>
              <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari akun..." /></label>
            </div>
            {data.loading ? <DataState message="Mengambil data dari Neon..." /> : data.error ? <DataState message={data.error} error /> : products.length ? (
              <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={() => showNotice("Checkout tersedia setelah alur pembayaran akun diaktifkan.")} />)}</div>
            ) : (
              <div className="empty-state"><Package size={24} /><h3>Belum ada akun tersedia</h3><p>Belum ada produk nyata di database. Panel tidak menampilkan akun contoh.</p></div>
            )}
          </section>
        </main>
      )}

      {activePage === "orders" && <OrdersPage orders={data.orders} loading={data.loading} onBack={() => navigate("store")} />}
      {activePage === "help" && <HelpPage onBack={() => navigate("store")} />}
      {activePage === "admin" && <AdminPage data={data} onBack={() => navigate("store")} />}

      <footer className="footer">
        <div className="container footer-inner">
          <div className="brand footer-brand"><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></div>
          <p>Data akun terhubung ke Neon Database.</p>
          <div className="footer-links"><button onClick={() => navigate("help")}>Bantuan</button><button onClick={() => navigate("orders")}>Pesanan</button></div>
        </div>
      </footer>
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
      <button className="admin-shortcut" onClick={() => navigate("admin")}><LayoutDashboard size={14} /> Panel</button>
    </div>
  );
}

function DataState({ message, error = false }) {
  return <div className="empty-state"><CircleHelp size={24} /><h3>{error ? "Data belum bisa dimuat" : "Memuat data nyata"}</h3><p>{message}</p></div>;
}

function ProductCard({ product, onAdd }) {
  return (
    <article className={`product-card ${product.accent || "violet"}`}>
      <div className="product-visual"><div className="visual-label">{product.type || "Akun"}</div><div className="visual-monogram">{product.initials || "CX"}</div><span className="visual-small">CODEXA<br /><b>ACCESS</b></span></div>
      <div className="product-content">
        <div className="product-meta"><span className="product-type">{product.type || "Akun"}</span><span className="stock-dot"><i />{product.stock ?? 0} tersisa</span></div>
        <h3>{product.title}</h3><p>{product.description || "Akun nyata dari katalog CodeXa."}</p>
        <div className="product-bottom"><strong>{formatPrice(Number(product.price) || 0)}</strong><button className="round-add" onClick={onAdd} aria-label={`Pilih ${product.title}`}><ShoppingBag size={17} /></button></div>
      </div>
    </article>
  );
}

function OrdersPage({ orders, loading, onBack }) {
  return (
    <main className="page-container container"><div className="page-top"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">AREA PEMBELI</p><h1>Pesanan saya.</h1><p className="page-lede">Riwayat pesanan dari database nyata.</p></div>
      <div className="orders-layout"><div className="orders-list"><div className="subheading"><h2>Riwayat pesanan</h2><span>{loading ? "..." : `${orders.length} pesanan`}</span></div>{orders.length ? orders.map((order) => <div className="order-row" key={order.id}><div className="order-icon"><Package size={17} /></div><div className="order-info"><div><strong>{order.product}</strong><span className="status pending">{order.status}</span></div><p>{order.id} · {order.date}</p><b>{formatPrice(Number(order.total) || 0)}</b></div><ChevronRight size={16} /></div>) : <div className="empty-state"><Package size={24} /><h3>Belum ada pesanan</h3><p>Riwayat akan muncul setelah ada transaksi nyata.</p></div>}</div></div>
    </main>
  );
}

function HelpPage({ onBack }) {
  return <main className="page-container container"><div className="page-top"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">SUPPORT</p><h1>Kami siap bantu.</h1><p className="page-lede">Hubungi support jika ada pertanyaan soal akun atau pesanan.</p></div><div className="help-grid"><div className="help-card dark"><Headphones size={24} /><h3>Butuh bantuan?</h3><p>Tim support akan membantu setelah ada kanal kontak yang dikonfigurasi.</p></div></div></main>;
}

function AdminPage({ data, onBack }) {
  return <main className="page-container container"><div className="page-top"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">DATA PANEL</p><h1>Panel nyata.</h1><p className="page-lede">Angka di bawah berasal dari Neon Database. Tidak ada data demo.</p></div><div className="admin-stats"><StatCard label="Pelanggan terdaftar" value={data.loading ? "..." : data.customerCount} change="Akun nyata" icon={Users} color="violet" /><StatCard label="Produk nyata" value={data.loading ? "..." : data.products.length} change="Dari database" icon={BadgeCheck} color="mint" /><StatCard label="Pesanan nyata" value={data.loading ? "..." : data.orders.length} change="Dari database" icon={BarChart3} color="coral" /></div><section className="admin-panel"><div className="panel-heading"><div><h2>Data toko</h2><p>Belum ada tabel produk/pesanan di Neon.</p></div></div><div className="empty-state"><Package size={24} /><h3>Tidak ada data dummy</h3><p>Tambahkan produk dan pesanan nyata ke database untuk menampilkannya di panel.</p></div></section></main>;
}

function StatCard({ label, value, change, icon: Icon, color }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={16} /></div><span>{label}</span><strong>{value}</strong><small>{change}</small></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);