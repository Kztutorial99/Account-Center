import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./styles.css";

const readyProducts = [
  {
    id: "ready-01",
    type: "Akun siap",
    title: "Akun Nimbus Pro",
    description: "Hiburan sinematik tanpa batas, siap dipakai hari ini.",
    price: 89000,
    oldPrice: 119000,
    stock: 12,
    badge: "Paling dicari",
    accent: "violet",
    initials: "NP",
    features: ["Profil pribadi", "Kualitas 4K Ultra HD", "Garansi 30 hari"],
  },
  {
    id: "ready-02",
    type: "Akun siap",
    title: "Akun Orbit Studio",
    description: "Suara jernih dan playlist tanpa jeda untuk harimu.",
    price: 129000,
    oldPrice: 169000,
    stock: 7,
    badge: "Best value",
    accent: "blue",
    initials: "OS",
    features: ["Akun privat", "Tanpa iklan", "Garansi 30 hari"],
  },
  {
    id: "ready-03",
    type: "Akun siap",
    title: "Akun Lumen Basic",
    description: "Pilihan ringkas untuk mulai menikmati konten favorit.",
    price: 49000,
    oldPrice: null,
    stock: 19,
    badge: "Baru",
    accent: "mint",
    initials: "LB",
    features: ["Akses instan", "Kualitas Full HD", "Garansi 14 hari"],
  },
];

const customProducts = [
  {
    id: "custom-01",
    type: "Akun custom",
    title: "Bikin akun sesuai namamu",
    description: "Pilih nama akun yang kamu mau, kami siapkan dan kirim setelah selesai.",
    price: 149000,
    oldPrice: 189000,
    stock: "Open",
    badge: "Bisa request nama",
    accent: "coral",
    initials: "Aa",
    features: ["Request nama unik", "Proses 1–3 jam", "Garansi 7 hari"],
  },
  {
    id: "custom-02",
    type: "Akun custom",
    title: "Custom Plus",
    description: "Nama custom plus preferensi format dan paket premium pilihanmu.",
    price: 199000,
    oldPrice: null,
    stock: "Open",
    badge: "Premium",
    accent: "gold",
    initials: "C+",
    features: ["Request nama unik", "Pilih format email", "Prioritas pengerjaan"],
  },
];

const orderSeed = [
  { id: "#CX-2048", buyer: "Raka P.", product: "Akun Nimbus Pro", status: "Selesai", total: 89000, date: "Baru saja" },
  { id: "#CX-2047", buyer: "Nadia K.", product: "Custom Plus", status: "Diproses", total: 199000, date: "12 menit lalu" },
  { id: "#CX-2046", buyer: "Fajar R.", product: "Akun Orbit Studio", status: "Selesai", total: 129000, date: "1 jam lalu" },
];

const formatPrice = (value) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function App() {
  const [activePage, setActivePage] = useState("store");
  const [category, setCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customName, setCustomName] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [orders, setOrders] = useState(orderSeed);

  const products = [...readyProducts, ...customProducts];
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = category === "Semua" || product.type === category;
      const query = search.toLowerCase();
      const matchesSearch = `${product.title} ${product.description}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const pushNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const addToCart = (product, requestedName = "") => {
    setCart((current) => [
      ...current,
      { ...product, cartId: `${product.id}-${Date.now()}`, requestedName },
    ]);
    setSelectedProduct(null);
    setCustomName("");
    pushNotice(`${product.title} masuk ke keranjang ✓`);
  };

  const removeFromCart = (cartId) => setCart((current) => current.filter((item) => item.cartId !== cartId));

  const completeCheckout = () => {
    if (!cart.length) return;
    const total = cartTotal;
    setOrders((current) => [
      {
        id: `#CX-${2050 + current.length}`,
        buyer: "Guest checkout",
        product: cart.map((item) => item.title).join(", "),
        status: "Menunggu pembayaran",
        total,
        date: "Baru saja",
      },
      ...current,
    ]);
    setCart([]);
    setShowCart(false);
    setActivePage("orders");
    pushNotice("Pesanan dibuat. Lanjutkan pembayaran untuk mengaktifkan akses.");
  };

  const navigate = (page) => {
    setActivePage(page);
    setShowMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      {/* ── TOPBAR ── */}
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
            <button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={17} /><span /></button>
            <button className="cart-button" onClick={() => setShowCart(true)}>
              <ShoppingBag size={16} />
              <span>Keranjang</span>
              {cart.length > 0 && <b>{cart.length}</b>}
            </button>
            <button className="profile-button" aria-label="Profil"><span className="avatar">RP</span><ChevronDown size={14} /></button>
            <button className="mobile-menu-button" onClick={() => setShowMobileMenu((v) => !v)} aria-label="Buka menu">
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── STORE PAGE ── */}
      {activePage === "store" && (
        <main>
          {/* Hero */}
          <section className="hero">
            <div className="container hero-grid">
              <div className="hero-copy obsidian-rise">
                <div className="eyebrow"><span className="eyebrow-line" /> Digital, made simple</div>
                <h1>Akses digital,<br /><em>tanpa drama.</em></h1>
                <p>Akun digital pilihanmu. Pilih layanan yang pas, bayar sekali, dan langsung siap digunakan.</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
                    Lihat koleksi <ArrowRight size={16} />
                  </button>
                  <button className="text-button" onClick={() => setCategory("Akun custom")}>
                    Akun custom <ChevronRight size={15} />
                  </button>
                </div>
                <div className="hero-trust">
                  <div className="trust-avatars"><span>AN</span><span>RK</span><span>DS</span><span>+</span></div>
                  <span><strong>2.4k+</strong> orang sudah mulai</span>
                </div>
              </div>

              <div className="hero-art" aria-label="Ilustrasi akun digital">
                <div className="art-glow" />
                <div className="floating-pill pill-top"><Zap size={14} fill="currentColor" /> Instant delivery</div>
                <div className="account-card">
                  <div className="account-card-top"><span>CX / ACCESS PASS</span><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 10px rgba(6,182,212,.9)", display: "inline-block" }} /></div>
                  <div className="account-symbol">CX<span>✦</span></div>
                  <div className="account-card-bottom"><span>CODEXA STORE</span><span>2024—∞</span></div>
                </div>
                <div className="floating-pill pill-bottom"><BadgeCheck size={14} /> Verified access</div>
                <span className="art-spark spark-one">✦</span>
                <span className="art-spark spark-two">✧</span>
              </div>
            </div>
          </section>

          {/* Quick benefits */}
          <section className="container quick-benefits">
            <div><span className="benefit-icon"><Zap size={17} /></span><span><strong>Aktif instan</strong><small>Setelah pembayaran</small></span></div>
            <div><span className="benefit-icon"><LockKeyhole size={17} /></span><span><strong>Aman & terverifikasi</strong><small>Data terkirim privat</small></span></div>
            <div><span className="benefit-icon"><Headphones size={17} /></span><span><strong>Support manusia</strong><small>Siap bantu kapan saja</small></span></div>
          </section>

          {/* Catalog */}
          <section className="container catalog-section" id="catalog">
            <div className="section-heading">
              <div><p className="section-kicker">CURATED ACCESS</p><h2>Pilih yang kamu butuhkan.</h2></div>
              <p className="section-note">Tidak yakin mulai dari mana? <button onClick={() => navigate("help")}>Tanya kami <ArrowRight size={14} /></button></p>
            </div>
            <div className="catalog-toolbar">
              <div className="category-tabs">
                {["Semua", "Akun siap", "Akun custom"].map((item) => (
                  <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                    {item}{item !== "Semua" && <span>{products.filter((p) => p.type === item).length}</span>}
                  </button>
                ))}
              </div>
              <div className="search-field">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari akun..." />
                <button aria-label="Filter"><Filter size={15} /></button>
              </div>
            </div>
            {filteredProducts.length > 0
              ? <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={() => setSelectedProduct(product)} onAdd={() => addToCart(product)} />)}</div>
              : <div className="empty-state"><Search size={24} /><h3>Akun tidak ditemukan</h3><p>Coba kata kunci atau kategori lain.</p><button className="secondary-button" onClick={() => { setSearch(""); setCategory("Semua"); }}>Reset pencarian</button></div>
            }
          </section>

          {/* Custom banner */}
          <section className="container custom-banner">
            <div className="custom-banner-content">
              <span className="banner-icon"><Pencil size={17} /></span>
              <div>
                <p className="section-kicker">PUNYA REQUEST SPESIAL?</p>
                <h2>Namamu, caramu.</h2>
                <p>Custom akun dengan nama yang kamu inginkan. Sampaikan request, kami yang siapkan.</p>
              </div>
              <button className="light-button" onClick={() => { setCategory("Akun custom"); document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); }}>
                Mulai custom <ArrowRight size={15} />
              </button>
            </div>
            <div className="banner-orbit orbit-a" /><div className="banner-orbit orbit-b" /><span className="banner-star">✦</span>
          </section>

          {/* How it works */}
          <section className="container how-section">
            <div className="section-heading">
              <div><p className="section-kicker">SEMUDAH ITU</p><h2>Dari pilih sampai siap.</h2></div>
              <span className="step-count">01 — 03</span>
            </div>
            <div className="steps">
              <div className="step"><span>01</span><div><h3>Pilih akun</h3><p>Ambil yang siap pakai atau pilih paket custom sesuai kebutuhanmu.</p></div></div>
              <div className="step"><span>02</span><div><h3>Bayar sekali</h3><p>Checkout aman dengan berbagai metode pembayaran lokal.</p></div></div>
              <div className="step"><span>03</span><div><h3>Langsung mulai</h3><p>Kredensial langsung dikirim otomatis ke kamu dalam hitungan menit.</p></div></div>
            </div>
          </section>
        </main>
      )}

      {activePage === "orders" && <OrdersPage orders={orders} onBack={() => navigate("store")} onNotice={pushNotice} showPassword={showPassword} setShowPassword={setShowPassword} />}
      {activePage === "help"   && <HelpPage onBack={() => navigate("store")} />}
      {activePage === "admin"  && <AdminPage orders={orders} onBack={() => navigate("store")} />}

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="brand footer-brand"><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></div>
          <p>Akun digital pilihanmu.</p>
          <div className="footer-links">
            <button onClick={() => navigate("help")}>Bantuan</button>
            <button onClick={() => navigate("orders")}>Pesanan</button>
            <button>Ketentuan</button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          customName={customName}
          setCustomName={setCustomName}
          onClose={() => { setSelectedProduct(null); setCustomName(""); }}
          onAdd={() => {
            if (selectedProduct.type === "Akun custom" && !customName.trim()) { pushNotice("Isi nama custom terlebih dahulu"); return; }
            addToCart(selectedProduct, customName.trim());
          }}
        />
      )}
      {showCart && <CartDrawer cart={cart} total={cartTotal} onClose={() => setShowCart(false)} onRemove={removeFromCart} onCheckout={completeCheckout} />}
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
      <button className="admin-shortcut" onClick={() => navigate("admin")}><LayoutDashboard size={14} /> Admin preview</button>
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd }) {
  return (
    <article className={`product-card ${product.accent}`}>
      <div className="product-visual">
        <div className="visual-label">{product.type}</div>
        <div className="visual-monogram">{product.initials}</div>
        <span className="visual-orbit" />
        <span className="visual-star">✦</span>
        <span className="visual-small">CODEXA<br /><b>ACCESS</b></span>
        <span className="product-badge">{product.badge}</span>
      </div>
      <div className="product-content">
        <div className="product-meta">
          <span className="product-type">{product.type}</span>
          <span className="stock-dot"><i />{typeof product.stock === "number" ? `${product.stock} tersisa` : "Terima request"}</span>
        </div>
        <h3>{product.title}</h3>
        <p>{product.description}</p>
        <div className="product-bottom">
          <div>
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <button className="round-add" onClick={onAdd} aria-label={`Tambah ${product.title}`}><Plus size={18} /></button>
        </div>
        <button className="detail-link" onClick={onOpen}>Lihat detail <ArrowRight size={13} /></button>
      </div>
    </article>
  );
}

function ProductModal({ product, customName, setCustomName, onClose, onAdd }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        <div className={`modal-visual ${product.accent}`}>
          <span>{product.type}</span>
          <strong>{product.initials}</strong>
          <small>CODEXA ACCESS / VERIFIED</small>
        </div>
        <div className="modal-body">
          <p className="section-kicker">{product.type}</p>
          <h2>{product.title}</h2>
          <p className="modal-description">{product.description}</p>
          <div className="feature-list">
            {product.features.map((f) => <div key={f}><Check size={14} />{f}</div>)}
          </div>
          {product.type === "Akun custom" && (
            <label className="custom-input">
              <span>Nama yang kamu inginkan</span>
              <div>
                <UserRound size={16} />
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="contoh: alex.studio" />
                <span className="input-suffix">@</span>
              </div>
              <small>Gunakan 4–20 karakter, tanpa spasi.</small>
            </label>
          )}
          <div className="modal-purchase">
            <div><small>Total</small><strong>{formatPrice(product.price)}</strong></div>
            <button className="primary-button" onClick={onAdd}>Tambah ke keranjang <ShoppingBag size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ cart, total, onClose, onRemove, onCheckout }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="cart-drawer">
        <div className="drawer-header">
          <div><p className="section-kicker">KERANJANGMU</p><h2>{cart.length} item</h2></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {cart.length ? (
          <>
            <div className="drawer-items">
              {cart.map((item) => (
                <div className="drawer-item" key={item.cartId}>
                  <div className={`mini-product ${item.accent}`}>{item.initials}</div>
                  <div className="drawer-item-copy">
                    <strong>{item.title}</strong>
                    {item.requestedName && <small>Nama: {item.requestedName}</small>}
                    <span>{formatPrice(item.price)}</span>
                  </div>
                  <button onClick={() => onRemove(item.cartId)} aria-label="Hapus item"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="drawer-summary">
              <div><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
              <small><LockKeyhole size={12} /> Pembayaran aman dan terenkripsi</small>
              <button className="primary-button full-button" onClick={onCheckout}>Lanjut checkout <ArrowRight size={15} /></button>
            </div>
          </>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={26} />
            <h3>Keranjang masih kosong</h3>
            <p>Pilih akun yang cocok untuk mulai.</p>
            <button className="secondary-button" onClick={onClose}>Jelajahi store</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function OrdersPage({ orders, onBack, onNotice, showPassword, setShowPassword }) {
  return (
    <main className="page-container container">
      <div className="page-top">
        <button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button>
        <p className="section-kicker">AREA PEMBELI</p>
        <h1>Pesanan saya.</h1>
        <p className="page-lede">Lihat status pesanan dan akses yang sudah kamu beli.</p>
      </div>
      <div className="orders-layout">
        <div className="orders-list">
          <div className="subheading"><h2>Riwayat pesanan</h2><span>{orders.length} pesanan</span></div>
          {orders.map((order, i) => (
            <div className="order-row" key={`${order.id}-${i}`}>
              <div className="order-icon"><Package size={17} /></div>
              <div className="order-info">
                <div><strong>{order.product}</strong><span className={`status ${order.status.includes("Selesai") ? "success" : "pending"}`}>{order.status}</span></div>
                <p>{order.id} · {order.date}</p>
                <b>{formatPrice(order.total)}</b>
              </div>
              <button className="order-arrow"><ChevronRight size={16} /></button>
            </div>
          ))}
        </div>
        <div className="access-card">
          <div className="access-card-header">
            <span className="access-lock"><LockKeyhole size={16} /></span>
            <div><p className="section-kicker">AKSES TERBARU</p><h3>Akun Nimbus Pro</h3></div>
          </div>
          <p>Akses muncul setelah pembayaran berhasil dikonfirmasi.</p>
          <button className="secondary-button full-button" onClick={() => { setShowPassword(!showPassword); onNotice(showPassword ? "Akses disembunyikan" : "Akses ditampilkan secara privat"); }}>
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />} {showPassword ? "Sembunyikan akses" : "Tampilkan akses"}
          </button>
          {showPassword && (
            <div className="credential-box">
              <small>Email</small><strong>customer@codexa.id</strong>
              <small>Password</small><strong>•••••••••••• <button onClick={() => onNotice("Password disalin")}><Copy size={12} /></button></strong>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function HelpPage({ onBack }) {
  return (
    <main className="page-container container">
      <div className="page-top">
        <button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button>
        <p className="section-kicker">SUPPORT</p>
        <h1>Kami siap bantu.</h1>
        <p className="page-lede">Pertanyaan soal akun siap, custom nama, atau proses order? Mulai dari sini.</p>
      </div>
      <div className="help-grid">
        <div className="help-card dark">
          <Headphones size={24} />
          <p className="section-kicker">RESPON CEPAT</p>
          <h2>Ngobrol dengan kami.</h2>
          <p>Tim support CodeXa siap membantu setiap hari pukul 09.00–22.00.</p>
          <button className="light-button">Mulai chat <ArrowRight size={15} /></button>
        </div>
        <div className="faq-list">
          <h2>Pertanyaan umum</h2>
          {["Berapa lama akun custom selesai?", "Bagaimana cara menerima akses akun?", "Apakah ada garansi penggantian?", "Bisa request format email tertentu?"].map((item) => (
            <button key={item}><span>{item}</span><ChevronRight size={16} /></button>
          ))}
        </div>
      </div>
    </main>
  );
}

function AdminPage({ orders, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  return (
    <main className="admin-page">
      <div className="container admin-layout">
        <aside className="admin-sidebar">
          <button className="brand admin-brand" onClick={onBack}><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></button>
          <div className="admin-nav">
            <p>MENU UTAMA</p>
            {[["overview", LayoutDashboard, "Overview"], ["products", Package, "Produk & stok"], ["orders", ShoppingBag, "Pesanan"], ["customers", Users, "Customers"]].map(([id, Icon, label]) => (
              <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
                <Icon size={16} />{label}{id === "orders" && <span className="nav-count">3</span>}
              </button>
            ))}
          </div>
          <div className="admin-sidebar-bottom">
            <button><Settings size={16} /> Pengaturan</button>
            <button className="admin-user"><span className="avatar">RP</span><span><strong>Raka Putra</strong><small>Owner</small></span><ChevronDown size={13} /></button>
          </div>
        </aside>
        <div className="admin-content">
          <div className="admin-mobile-header">
            <button className="brand" onClick={onBack}><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></button>
            <button onClick={onBack}><X size={18} /></button>
          </div>
          <div className="admin-heading">
            <div>
              <p className="section-kicker">TUESDAY, 05 AUGUST 2026</p>
              <h1>Selamat pagi, Raka.</h1>
              <p>Pantau toko dan pesananmu hari ini.</p>
            </div>
            <button className="primary-button"><Plus size={15} /> Tambah produk</button>
          </div>
          <div className="admin-stats">
            <StatCard label="Total penjualan" value="Rp 12,8 jt" change="+18.4%" icon={BarChart3} color="coral" />
            <StatCard label="Pesanan aktif" value="28" change="+6 hari ini" icon={ShoppingBag} color="violet" />
            <StatCard label="Akun terjual" value="164" change="+12.5%" icon={BadgeCheck} color="mint" />
            <StatCard label="Custom request" value="7" change="Perlu dicek" icon={Pencil} color="gold" />
          </div>
          <div className="admin-main-grid">
            <section className="admin-panel">
              <div className="panel-heading">
                <div><h2>Pesanan terbaru</h2><p>Aktivitas penjualan terakhir</p></div>
                <button className="view-all">Lihat semua <ArrowRight size={13} /></button>
              </div>
              <div className="admin-orders-table">
                <div className="table-header"><span>ORDER ID</span><span>PEMBELI</span><span>PRODUK</span><span>STATUS</span><span>TOTAL</span></div>
                {orders.map((order, i) => (
                  <div className="table-row" key={`${order.id}-${i}`}>
                    <span data-label="Order ID"><strong>{order.id}</strong><small>{order.date}</small></span>
                    <span data-label="Pembeli">{order.buyer}</span>
                    <span data-label="Produk">{order.product}</span>
                    <span data-label="Status"><b className={`status ${order.status.includes("Selesai") ? "success" : "pending"}`}>{order.status}</b></span>
                    <span data-label="Total"><strong>{formatPrice(order.total)}</strong></span>
                  </div>
                ))}
              </div>
            </section>
            <section className="admin-panel stock-panel">
              <div className="panel-heading">
                <div><h2>Stok menipis</h2><p>Perlu perhatian</p></div>
                <button className="icon-button"><MoreDots /></button>
              </div>
              <div className="stock-list">
                {readyProducts.map((product) => (
                  <div key={product.id}>
                    <div className={`mini-product ${product.accent}`}>{product.initials}</div>
                    <span><strong>{product.title}</strong><small>{product.stock} unit tersisa</small></span>
                    <div className="stock-bar"><i style={{ width: `${Math.min(product.stock * 5, 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <button className="secondary-button full-button">Kelola semua stok <ArrowRight size={14} /></button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, change, icon: Icon, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}><Icon size={16} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={change.includes("cek") ? "warning-text" : ""}>{change}</small>
    </div>
  );
}

function MoreDots() {
  return <span className="more-dots"><i /><i /><i /></span>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
