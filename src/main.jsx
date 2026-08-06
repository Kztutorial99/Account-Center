import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, BadgeCheck, Bell, Check,
  CircleHelp, Command, Copy, CreditCard, Eye, EyeOff, ChevronDown,
  FileText, LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu,
  MoreHorizontal, Package, PanelLeft, Pencil, Plus, RefreshCw,
  Search, Settings, ShieldCheck, ShoppingBag, Trash2, X,
  User, Wallet, Mail, Phone, Clock,
} from "lucide-react";
import "./styles.css";

/* ─── helpers ─── */
const formatPrice = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const formatDate  = (v) => v ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(v)) : "-";
const LOGIN_TYPES  = ["Google", "Facebook", "Email/password", "Apple", "Microsoft", "Lainnya"];
const emptyListing = { title: "", description: "", loginType: "Google", price: "", status: "available", accounts: [{ email: "", password: "", price: "" }], deliveryDetails: "" };
const accountPriceOf = (account, product) => {
  const n = Number(account && account.price);
  if (Number.isFinite(n) && n > 0) return n;
  return Number(product && product.price) || 0;
};
const sumSelected = (product, selected) =>
  (product.accounts || [])
    .filter((a) => selected.includes(a.index))
    .reduce((total, a) => total + accountPriceOf(a, product), 0);
const ACCENT_COLORS = ["#e36d78", "#7bc48b", "#6c83da", "#a983de", "#67b6a1", "#dba66a"];

/* ─── provider icons (icons8) ─── */
const PROVIDER_ICONS = {
  "google": "https://img.icons8.com/color/48/google-logo.png",
  "facebook": "https://img.icons8.com/color/48/facebook-new.png",
  "email/password": "https://img.icons8.com/color/48/new-post.png",
  "apple": "https://img.icons8.com/ios-filled/50/mac-os.png",
  "microsoft": "https://img.icons8.com/color/48/microsoft.png",
  "lainnya": "https://img.icons8.com/color/48/key-security.png",
};
const providerIconUrl = (t) =>
  PROVIDER_ICONS[String(t || "").trim().toLowerCase()] || PROVIDER_ICONS["lainnya"];

function ProviderIcon({ type, size = 16, className = "" }) {
  return (
    <img
      src={providerIconUrl(type)}
      alt={type || "Provider"}
      title={type || "Provider"}
      width={size}
      height={size}
      loading="lazy"
      className={`cx-provider-icon ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}

async function jsonRequest(url, opts = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p.error || "Permintaan gagal diproses");
  return p;
}

/* ─── small UI atoms ─── */
function IconBtn({ children, label, onClick, style }) {
  return <button aria-label={label} onClick={onClick} className="cx-icon-btn" style={style}>{children}</button>;
}
function Field({ label, children, hint, error }) {
  return (
    <div className="cx-field">
      <label>{label}</label>
      {children}
      {error && <small className="cx-field-error">{error}</small>}
      {!error && hint && <small>{hint}</small>}
    </div>
  );
}
function InputWrap({ icon: Icon, children }) {
  return <div className="cx-input-wrap">{Icon && <Icon size={13} />}{children}</div>;
}

/* ═══════════════════════════════════════════════════
   APP ROOT
════════════════════════════════════════════════════ */
function App() {
  const [activePage, setActivePage] = useState(() =>
    window.location.pathname === "/admin" ? "admin"
    : window.location.pathname === "/orders" ? "orders"
    : window.location.pathname === "/help" ? "help"
    : window.location.pathname === "/account" ? "account"
    : window.location.pathname === "/topup" ? "topup"
    : "store"
  );
  const [search, setSearch]   = useState("");
  const [notice, setNotice]   = useState("");
  const [cart, setCart]       = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [buyItem, setBuyItem]   = useState(null);
  const [buySel, setBuySel]     = useState([]);
  const [data, setData]         = useState({ products: [], loading: true, error: "" });
  const [auth, setAuth]         = useState({ user: null, loading: true });
  const [menuOpen, setMenuOpen] = useState(false);

  const loadSession = () =>
    fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((p) => setAuth({ user: p.user || null, loading: false }))
      .catch(() => setAuth({ user: null, loading: false }));

  const logout = async () => {
    try { await jsonRequest("/api/auth", { method: "DELETE" }); } catch (_) {}
    setAuth({ user: null, loading: false });
    setMenuOpen(false);
    setCart([]);
  };

  const loadCatalog = () => {
    setData((x) => ({ ...x, loading: true, error: "" }));
    fetch("/api/data")
      .then(async (r) => { const p = await r.json(); if (!r.ok) throw new Error(p.error || "Data tidak tersedia"); return p; })
      .then((p) => setData({ products: p.products || [], loading: false, error: "" }))
      .catch((e) => setData((x) => ({ ...x, loading: false, error: e.message })));
  };

  useEffect(() => {
    const pop = () => setActivePage(
      window.location.pathname === "/admin"  ? "admin"
      : window.location.pathname === "/orders" ? "orders"
      : window.location.pathname === "/help"   ? "help"
      : window.location.pathname === "/account" ? "account"
      : window.location.pathname === "/topup" ? "topup" : "store"
    );
    window.addEventListener("popstate", pop);
    loadSession();
    loadCatalog();
    return () => window.removeEventListener("popstate", pop);
  }, []);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.products.filter((p) => `${p.title} ${p.description} ${p.loginType}`.toLowerCase().includes(q)) : data.products;
  }, [data.products, search]);

  const navigate = (page) => {
    window.history.pushState({}, "", page === "store" ? "/" : `/${page}`);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const showNotice = (msg) => { setNotice(msg); window.setTimeout(() => setNotice(""), 2800); };
  const addToCart  = (product, selected) => {
    const picks = (product.accounts || []).filter((a) => selected.includes(a.index));
    const total = sumSelected(product, selected);
    setCart((c) => [...c, { ...product, selectedAccounts: picks, qty: picks.length || 1, price: total || Number(product.price) || 0 }]);
    showNotice(`${product.title} (${picks.length || 1} akun) ditambahkan`);
    setBuyItem(null);
  };
  const removeFromCart = (i) => setCart((c) => c.filter((_, idx) => idx !== i));

  /* ── admin page ── */
  if (activePage === "admin") {
    return <AdminPage onBack={() => navigate("store")} onNotice={showNotice} />;
  }

  /* ── auth gate: wajib login sebelum akses CodeXa ── */
  if (auth.loading) return (
    <div className="cx-login-wrap"><div style={{ color: "var(--muted)", fontSize: 12 }}>Memeriksa sesi...</div></div>
  );
  if (!auth.user) return (
    <AuthPage onAuthenticated={(user) => { setAuth({ user, loading: false }); navigate("store"); }} />
  );

  const topbar = (
    <StoreTopbar
      activePage={activePage} navigate={navigate} cart={cart}
      onCartOpen={() => setCartOpen(true)}
      user={auth.user} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onLogout={logout}
    />
  );

  if (activePage === "account") return (
    <div className="cx-app">
      {topbar}
      <ProfilePage user={auth.user} onBack={() => navigate("store")} onTopup={() => navigate("topup")} />
      <StoreFooter navigate={navigate} />
    </div>
  );

  if (activePage === "topup") return (
    <div className="cx-app">
      {topbar}
      <TopUpPage user={auth.user} onBack={() => navigate("store")} onNotice={showNotice} onRefresh={loadSession} />
      <StoreFooter navigate={navigate} />
    </div>
  );

  /* ── simple pages ── */
  if (activePage === "orders") return (
    <div className="cx-app">
      {topbar}
      <div className="cx-simple-page cx-container">
        <button className="cx-back-link" onClick={() => navigate("store")}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali</button>
        <Package size={28} color="#818cf8" style={{ marginBottom: 12 }} />
        <p style={{ color: "var(--faint)", fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>CODEXA</p>
        <h1>Pesanan Saya</h1>
        <p>Setelah pembayaran berhasil, detail akun dikirim ke kontak yang kamu daftarkan. Hubungi admin jika ada kendala.</p>
      </div>
      <StoreFooter navigate={navigate} />
    </div>
  );

  if (activePage === "help") return (
    <div className="cx-app">
      {topbar}
      <div className="cx-simple-page cx-container">
        <button className="cx-back-link" onClick={() => navigate("store")}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali</button>
        <CircleHelp size={28} color="#818cf8" style={{ marginBottom: 12 }} />
        <p style={{ color: "var(--faint)", fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>CODEXA</p>
        <h1>Bantuan</h1>
        <p>Untuk pertanyaan seputar produk, pembayaran, atau pengiriman akun — hubungi kami via WhatsApp atau DM Instagram. Respon dalam 1×24 jam.</p>
      </div>
      <StoreFooter navigate={navigate} />
    </div>
  );

  /* ── store page ── */
  return (
    <div className="cx-app">
      {topbar}

      {/* Hero */}
      <section className="cx-hero">
        <div className="cx-container cx-hero-inner">
          <div className="cx-kicker">CODEXA ACCESS</div>
          <h1>Akun digital,<br /><em>tanpa drama.</em></h1>
          <p className="cx-hero-sub">Akun siap pakai dari katalog nyata. Detail login hanya dikirim setelah pembelian berhasil.</p>
          <div className="cx-hero-actions">
            <button className="cx-btn cx-btn-primary" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
              Lihat katalog <ArrowRight size={13} />
            </button>
            <button className="cx-btn cx-btn-ghost" onClick={() => navigate("help")}>
              Cara beli
            </button>
          </div>
        </div>

        {/* Benefits bar */}
        <div className="cx-container" style={{ marginTop: 32 }}>
          <div className="cx-benefits">
            {[
              [BadgeCheck, "Live Inventory", "Stok real-time dari database"],
              [ShieldCheck, "Credentials Protected", "Detail akun aman sampai setelah bayar"],
              [Package, "Instant Delivery", "Akun dikirim otomatis setelah verifikasi"],
            ].map(([Icon, title, desc]) => (
              <div key={title} className="cx-benefit">
                <Icon size={14} />
                <div><strong>{title}</strong>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog */}
      <main className="cx-container" id="catalog" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className="cx-section-header cx-section-header-stack">
          <div>
            <h2>Akun yang tersedia.</h2>
            <p className="cx-section-sub">{data.loading ? "Memuat..." : `${products.length} produk ditemukan`}</p>
          </div>
          <div className="cx-search">
            <Search size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari akun atau tipe login..." />
          </div>
        </div>

        {data.loading && (
          <div className="cx-grid">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} style={{ border: "1px solid var(--b1)", borderRadius: 4, overflow: "hidden" }}>
                <div className="cx-skeleton" style={{ height: 110 }} />
                <div style={{ padding: 14 }}>
                  <div className="cx-skeleton" style={{ height: 10, width: "60%", marginBottom: 8 }} />
                  <div className="cx-skeleton" style={{ height: 13, marginBottom: 6 }} />
                  <div className="cx-skeleton" style={{ height: 11, width: "80%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {data.error && (
          <div className="cx-empty">
            <CircleHelp size={28} />
            <h3>Data belum bisa dimuat</h3>
            <p>{data.error}</p>
            <button className="cx-btn cx-btn-secondary" onClick={loadCatalog}><RefreshCw size={13} /> Coba lagi</button>
          </div>
        )}

        {!data.loading && !data.error && products.length === 0 && (
          <div className="cx-empty">
            <Package size={28} />
            <h3>Belum ada akun tersedia</h3>
            <p>{search ? "Tidak ada produk yang cocok dengan pencarian." : "Belum ada listing nyata di database. Panel tidak menampilkan akun contoh."}</p>
          </div>
        )}

        {!data.loading && products.length > 0 && (
          <div className="cx-grid">
            {products.map((p, i) => (
              <ProductCard key={p.id || i} product={p} colorIdx={i} onBuy={(sel) => { setBuyItem(p); setBuySel(Array.isArray(sel) ? sel : []); }} />
            ))}
          </div>
        )}
      </main>

      <StoreFooter navigate={navigate} />

      {/* Buy modal */}
      {buyItem && (
        <div className="cx-modal-backdrop" onClick={() => setBuyItem(null)}>
          <div className="cx-modal cx-buy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cx-buy-visual" style={{ background: `${ACCENT_COLORS[products.indexOf(buyItem) % ACCENT_COLORS.length]}11` }}>
              <div className="cx-buy-visual-mono">DIGITAL ACCOUNT · {buyItem.loginType}</div>
              <div className="cx-buy-symbol">
                <ProviderIcon type={buyItem.loginType} size={64} />
              </div>
              <div className="cx-buy-visual-mono">{buyItem.stock} STOK TERSEDIA</div>
            </div>
            <div className="cx-buy-body">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="cx-icon-btn" onClick={() => setBuyItem(null)}><X size={14} /></button>
              </div>
              <p style={{ color: "var(--faint)", fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: ".1em", textTransform: "uppercase", margin: "4px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                <ProviderIcon type={buyItem.loginType} size={14} />
                {buyItem.loginType}
              </p>
              <h2 style={{ margin: "0 0 8px", font: "600 20px Inter", letterSpacing: "-.03em" }}>{buyItem.title}</h2>
              <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.65, margin: "0 0 16px" }}>
                {buyItem.description || "Akun digital siap digunakan. Detail dikirim setelah pembayaran."}
              </p>
              <ul className="cx-feature-list">
                <li><Check size={13} /><span>Login type: <strong style={{ color: "var(--ink2)" }}>{buyItem.loginType}</strong></span></li>
                <li><Check size={13} /><span>Stok tersisa: <strong style={{ color: "var(--ink2)" }}>{buyItem.stock}</strong></span></li>
                <li><Check size={13} /><span>Detail akun dikirim otomatis setelah verifikasi</span></li>
                <li><Check size={13} /><span>Garansi penggantian jika akun bermasalah</span></li>
              </ul>
              {Array.isArray(buyItem.accounts) && buyItem.accounts.length > 0 && (
                <div className="cx-cred-preview cx-cred-preview-lg">
                  <div className="cx-cred-head">Pilih akun yang mau dibeli ({buySel.length}/{buyItem.accounts.length} dipilih)</div>
                  {buyItem.accounts.map((account) => {
                    const checked = buySel.includes(account.index);
                    return (
                      <label className={`cx-cred-item cx-cred-pick${checked ? " is-picked" : ""}`} key={account.index}>
                        <input
                          type="checkbox"
                          className="cx-cred-check"
                          checked={checked}
                          onChange={() => setBuySel((prev) => prev.includes(account.index) ? prev.filter((i) => i !== account.index) : [...prev, account.index])}
                        />
                        <span className="cx-cred-no">#{account.index}</span>
                        <div className="cx-cred-pair">
                          <div className="cx-cred-row"><span>Email</span><code>{account.maskedEmail || "—"}</code></div>
                          <div className="cx-cred-row"><span>Password</span><code>{account.maskedPassword || "—"}</code></div>
                        </div>
                        <span className="cx-cred-price">{formatPrice(accountPriceOf(account, buyItem))}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <label style={{ fontSize: 11, color: "var(--ink2)", fontWeight: 600 }}>Jumlah akun dipilih: {buySel.length}</label>
                <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setBuySel((buyItem.accounts || []).map((a) => a.index))}>Pilih semua</button>
                <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setBuySel([])}>Kosongkan</button>
              </div>
              <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="cx-buy-price">
                  <small>Total harga</small>
                  <strong>{formatPrice(sumSelected(buyItem, buySel))}</strong>
                </div>
                <button className="cx-btn cx-btn-primary" disabled={buySel.length === 0} onClick={() => addToCart(buyItem, buySel)}>
                  <ShoppingBag size={13} /> Tambah ke keranjang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="cx-drawer-backdrop" onClick={() => setCartOpen(false)}>
          <div className="cx-cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cx-drawer-header">
              <div>
                <h2>Keranjang</h2>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>{cart.length} item</p>
              </div>
              <button className="cx-icon-btn" onClick={() => setCartOpen(false)}><X size={14} /></button>
            </div>
            {cart.length === 0
              ? <div className="cx-empty" style={{ paddingTop: 24 }}><Package size={24} /><h3>Keranjang kosong</h3><p>Tambahkan akun dari katalog.</p></div>
              : <div style={{ flex: 1, overflowY: "auto" }}>
                  {cart.map((item, i) => (
                    <div key={i} className="cx-cart-item">
                      <div className="cx-cart-thumb cx-cart-thumb-icon">
                        <ProviderIcon type={item.loginType} size={20} />
                      </div>
                      <div className="cx-cart-item-copy">
                        <strong>{item.title}</strong>
                        <small>{item.qty ? `${item.qty} akun · ` : ""}{formatPrice(item.price)}</small>
                      </div>
                      <button className="cx-icon-btn" onClick={() => removeFromCart(i)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
            }
            {cart.length > 0 && (
              <div className="cx-cart-summary">
                <div><span>Subtotal ({cart.reduce((a, c) => a + (Number(c.qty) || 1), 0)} akun)</span><strong>{formatPrice(cart.reduce((a, c) => a + (Number(c.price) || 0), 0))}</strong></div>
                <p className="cx-checkout-note"><ShieldCheck size={11} /> Detail akun dikirim setelah pembayaran terverifikasi</p>
                <button className="cx-btn cx-btn-primary cx-btn-full" onClick={() => showNotice("Fitur checkout segera hadir!")}>
                  Lanjut ke pembayaran <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {notice && <div className="cx-toast"><Check size={14} />{notice}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STORE TOPBAR
════════════════════════════════════════════════════ */
function StoreTopbar({ activePage, navigate, cart, onCartOpen, user, menuOpen, setMenuOpen, onLogout }) {
  const initials = String(user && user.name || "CX").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "CX";
  return (
    <header className="cx-topbar">
      <div className="cx-container cx-topbar-inner">
        <button className="cx-brand" onClick={() => navigate("store")}>
          <span className="cx-brand-mark">&lt;/&gt;</span>
          <span>Code<span className="cx-brand-dot">Xa</span></span>
        </button>
        <nav className="cx-nav">
          {[["store","Store"],["orders","Pesanan"],["help","Bantuan"]].map(([page, label]) => (
            <button key={page} className={activePage === page ? "active" : ""} onClick={() => navigate(page)}>{label}</button>
          ))}
        </nav>
        <div className="cx-topbar-actions">
          <IconBtn label="Notifikasi" onClick={() => {}}><Bell size={13} /></IconBtn>
          <button className="cx-cart-btn" onClick={onCartOpen}>
            <ShoppingBag size={13} />
            {cart.length > 0 && <b>{cart.length}</b>}
            <span className="cx-cart-label">Keranjang</span>
          </button>
          <div className="cx-account-menu">
            <button className="cx-account-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Akun saya">
              <div className="cx-avatar">{initials}</div>
              <div className="cx-account-trigger-copy">
                <strong>{user ? user.name : "Akun"}</strong>
                <small>{formatPrice(user ? user.balance : 0)}</small>
              </div>
              <ChevronDown size={12} />
            </button>
            {menuOpen && (
              <>
                <div className="cx-account-overlay" onClick={() => setMenuOpen(false)} />
                <div className="cx-account-dropdown">
                  <div className="cx-account-head">
                    <div className="cx-avatar cx-avatar-lg">{initials}</div>
                    <div>
                      <strong>{user && user.name}</strong>
                      <small>{user && user.email}</small>
                    </div>
                  </div>
                  <div className="cx-account-balance">
                    <span><Wallet size={12} /> Saldo</span>
                    <strong>{formatPrice(user ? user.balance : 0)}</strong>
                  </div>
                  <button className="cx-account-item" onClick={() => { setMenuOpen(false); navigate("account"); }}>
                    <User size={13} /> Profil saya
                  </button>
                  <button className="cx-account-item" onClick={() => { setMenuOpen(false); navigate("topup"); }}>
                    <CreditCard size={13} /> Top up saldo
                  </button>
                  <button className="cx-account-item" onClick={() => { setMenuOpen(false); navigate("orders"); }}>
                    <Package size={13} /> Pesanan saya
                  </button>
                  <button className="cx-account-item cx-account-item-danger" onClick={onLogout}>
                    <LogOut size={13} /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════
   STORE FOOTER
════════════════════════════════════════════════════ */
function StoreFooter({ navigate }) {
  return (
    <footer className="cx-footer">
      <div className="cx-container cx-footer-inner">
        <button className="cx-brand" onClick={() => navigate("store")} style={{ fontSize: 13 }}>
          <span className="cx-brand-mark" style={{ width: 20, height: 20, fontSize: 10 }}>&lt;/&gt;</span>
          Code<span className="cx-brand-dot">Xa</span>
        </button>
        <p>Stok dan katalog terhubung ke Neon Database.</p>
        <div className="cx-footer-links">
          <button onClick={() => navigate("help")}>Bantuan</button>
          <button onClick={() => navigate("orders")}>Pesanan</button>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   PRODUCT CARD
════════════════════════════════════════════════════ */
function ProductCard({ product, colorIdx, onBuy }) {
  const color = ACCENT_COLORS[colorIdx % ACCENT_COLORS.length];
  const accounts = Array.isArray(product.accounts) ? product.accounts : [];
  const [selected, setSelected] = useState([]);
  const toggle = (index) =>
    setSelected((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  const total = selected.length ? sumSelected(product, selected) : 0;
  return (
    <article className="cx-product-card">
      <div className="cx-product-body">
        <div className="cx-product-head">
          <p className="cx-product-type" style={{ color, display: "flex", alignItems: "center", gap: 6 }}>
            <ProviderIcon type={product.loginType} size={15} />
            {product.loginType}
          </p>
          <span className="cx-product-badge">{product.stock} stok</span>
        </div>
        <h3 className="cx-product-title">{product.title}</h3>
        <p className="cx-product-desc">{product.description || "Akun digital siap digunakan. Detail dikirim setelah pembayaran."}</p>
        {accounts.length > 0 && (
          <div className="cx-cred-preview">
            <div className="cx-cred-head">Ceklis akun yang mau dibeli ({selected.length}/{accounts.length})</div>
            {accounts.map((account) => {
              const checked = selected.includes(account.index);
              return (
                <label className={`cx-cred-item cx-cred-pick${checked ? " is-picked" : ""}`} key={account.index}>
                  <input type="checkbox" className="cx-cred-check" checked={checked} onChange={() => toggle(account.index)} />
                  <span className="cx-cred-no">#{account.index}</span>
                  <div className="cx-cred-pair">
                    <div className="cx-cred-row"><span>Email</span><code>{account.maskedEmail || "—"}</code></div>
                    <div className="cx-cred-row"><span>Password</span><code>{account.maskedPassword || "—"}</code></div>
                  </div>
                  <span className="cx-cred-price">{formatPrice(accountPriceOf(account, product))}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="cx-product-bottom">
          <span className="cx-product-price">
            {formatPrice(total)}
            <small className="cx-product-price-note">{selected.length ? `${selected.length} akun dipilih` : "pilih akun dulu"}</small>
          </span>
          <button className="cx-product-buy" disabled={selected.length === 0} onClick={() => onBuy(selected)} aria-label={`Beli ${product.title}`}><ArrowRight size={13} /></button>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════
   ADMIN PAGE  —  LinearPro sidebar layout
════════════════════════════════════════════════════ */
function AdminPage({ onBack, onNotice }) {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword]           = useState("");
  const [loginError, setLoginError]       = useState("");
  const [listings, setListings]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [apiError, setApiError]           = useState("");
  const [form, setForm]                   = useState(null);
  const [saving, setSaving]               = useState(false);
  const [revealed, setRevealed]           = useState(false);
  const [search, setSearch]               = useState("");
  const [activeNav, setActiveNav]         = useState("Dashboard");
  const [topups, setTopups]               = useState([]);
  const [users, setUsers]                 = useState([]);
  const [userQuery, setUserQuery]         = useState("");
  const [userForm, setUserForm]           = useState(null);
  const [savingUser, setSavingUser]       = useState(false);

  const loadUsersData = () => {
    jsonRequest("/api/admin/topups", { method: "GET" })
      .then((p) => setTopups(p.topups || []))
      .catch(() => {});
    return jsonRequest("/api/admin/users", { method: "GET" })
      .then((p) => setUsers(p.users || []))
      .catch(() => {});
  };

  const openUserForm = (u) => {
    setApiError("");
    setUserForm({
      id: u.id, name: u.name || "", email: u.email || "", phone: u.phone || "",
      balance: String(u.balance ?? 0), status: u.status || "active",
      note: u.note || "", password: "",
      createdAt: u.createdAt, topupTotal: u.topupTotal || 0,
    });
  };
  const updateUserForm = (key, val) => setUserForm((f) => ({ ...f, [key]: val }));

  const saveUser = async () => {
    setSavingUser(true); setApiError("");
    try {
      await jsonRequest("/api/admin/users", { method: "PATCH", body: JSON.stringify(userForm) });
      setUserForm(null); loadUsersData(); onNotice("Data user diperbarui");
    } catch (e) { setApiError(e.message); }
    finally { setSavingUser(false); }
  };

  const setUserStatus = async (id, action) => {
    try {
      await jsonRequest("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, action }) });
      loadUsersData();
      onNotice(action === "activate" ? "Akun diaktifkan" : action === "suspend" ? "Akun ditangguhkan" : "Akun diblokir");
    } catch (e) { setApiError(e.message); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Hapus akun ${u.email}? Semua riwayat top up ikut terhapus.`)) return;
    try {
      await jsonRequest("/api/admin/users", { method: "DELETE", body: JSON.stringify({ id: u.id }) });
      loadUsersData(); onNotice("User dihapus");
    } catch (e) { setApiError(e.message); }
  };

  const reviewTopup = async (id, action) => {
    try {
      await jsonRequest("/api/admin/topups", { method: "PATCH", body: JSON.stringify({ id, action }) });
      onNotice(action === "approve" ? "Top up disetujui, saldo user bertambah" : "Top up ditolak");
      loadUsersData();
    } catch (e) { setApiError(e.message); }
  };

  const checkAuth = () =>
    jsonRequest("/api/admin/login", { method: "GET" })
      .then((p) => { setAuthenticated(p.authenticated); if (p.authenticated) { loadListings(); loadUsersData(); } })
      .catch(() => setAuthenticated(false));

  useEffect(() => { checkAuth(); }, []);

  const loadListings = () => {
    setLoading(true); setApiError("");
    jsonRequest("/api/admin/products", { method: "GET" })
      .then((p) => setListings(p.products || []))
      .catch((e) => setApiError(e.message))
      .finally(() => setLoading(false));
  };

  const login = async (e) => {
    e.preventDefault(); setLoginError("");
    try { await jsonRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); setAuthenticated(true); setPassword(""); loadListings(); loadUsersData(); }
    catch (e) { setLoginError(e.message); }
  };

  const logout = async () => { await jsonRequest("/api/admin/login", { method: "DELETE" }); setAuthenticated(false); setListings([]); };

  const openForm = (listing = null) => {
    setApiError(""); setRevealed(false);
    setForm(listing
      ? {
          ...emptyListing,
          ...listing,
          price: String(listing.price ?? ""),
          accounts: Array.isArray(listing.accounts) && listing.accounts.length
            ? listing.accounts.map((a) => ({ email: a.email || a.username || "", password: a.password || "", price: String(a.price ?? listing.price ?? "") }))
            : [{ email: "", password: "", price: String(listing.price ?? "") }],
        }
      : { ...emptyListing, accounts: [{ email: "", password: "", price: "" }] });
  };

  const updateForm = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const updateAccount = (index, key, val) =>
    setForm((f) => ({ ...f, accounts: (f.accounts || []).map((a, i) => (i === index ? { ...a, [key]: val } : a)) }));
  const addAccount = () => setForm((f) => ({ ...f, accounts: [...(f.accounts || []), { email: "", password: "", price: String(f.price || "") }] }));
  const removeAccount = (index) =>
    setForm((f) => {
      const next = (f.accounts || []).filter((_, i) => i !== index);
      return { ...f, accounts: next.length ? next : [{ email: "", password: "", price: String(f.price || "") }] };
    });

  const save = async () => {
    setSaving(true); setApiError("");
    try {
      const basePrice = Number(form.price) || 0;
      const accounts = (form.accounts || [])
        .map((a) => ({ email: (a.email || "").trim(), password: (a.password || "").trim(), price: Number(a.price) > 0 ? Number(a.price) : basePrice }))
        .filter((a) => a.email || a.password);
      const price = accounts.length ? Math.min(...accounts.map((a) => a.price)) : basePrice;
      const body = { ...form, accounts, price, stock: accounts.length };
      if (form.id) await jsonRequest("/api/admin/products", { method: "PATCH", body: JSON.stringify(body) });
      else await jsonRequest("/api/admin/products", { method: "POST", body: JSON.stringify(body) });
      setForm(null); loadListings(); onNotice(form.id ? "Produk diperbarui" : "Produk ditambahkan");
    } catch (e) { setApiError(e.message); }
    finally { setSaving(false); }
  };

  const deleteListing = async (id) => {
    if (!window.confirm("Hapus produk ini?")) return;
    try { await jsonRequest("/api/admin/products", { method: "DELETE", body: JSON.stringify({ id }) }); loadListings(); onNotice("Produk dihapus"); }
    catch (e) { setApiError(e.message); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? listings.filter((l) => `${l.title} ${l.loginType}`.toLowerCase().includes(q)) : listings;
  }, [listings, search]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return q ? users.filter((u) => `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)) : users;
  }, [users, userQuery]);

  /* stats */
  const totalProducts = listings.length;
  const totalSold     = listings.filter((l) => l.status === "sold").length;
  const revenue       = listings.filter((l) => l.status === "sold").reduce((a, l) => a + (Number(l.price) || 0), 0);
  const lowStock      = listings.filter((l) => Number(l.stock) <= 3 && l.status !== "sold").length;

  /* login screen */
  if (authenticated === null) return (
    <div className="cx-login-wrap">
      <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Memeriksa sesi...</div>
    </div>
  );

  if (!authenticated) return (
    <div className="cx-login-wrap">
      <div className="cx-login-box">
        <div className="cx-login-mark">&lt;/&gt;</div>
        <h1>CodeXa Admin</h1>
        <p>Masuk untuk mengelola produk dan pesanan.</p>
        <form onSubmit={login}>
          <Field label="Password Admin">
            <InputWrap icon={LockKeyhole}>
              <input type={revealed ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password..." autoFocus />
              <button type="button" onClick={() => setRevealed((v) => !v)} style={{ color: "var(--muted)", background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </InputWrap>
          </Field>
          {loginError && <p className="cx-form-error">{loginError}</p>}
          <button type="submit" className="cx-btn cx-btn-primary cx-btn-full" style={{ marginTop: 6 }}>
            <LogIn size={13} /> Masuk
          </button>
        </form>
        <button className="cx-back-link" style={{ marginTop: 20 }} onClick={onBack}>
          <ArrowRight size={12} style={{ transform: "rotate(180deg)" }} /> Kembali ke Store
        </button>
      </div>
    </div>
  );

  const NAV_ITEMS = [
    { label: "Dashboard",   shortcut: "⌘D", icon: LayoutDashboard },
    { label: "Produk",      shortcut: "⌘P", icon: Package,        dot: true },
    { label: "Pesanan",     shortcut: "⌘O", icon: ShoppingBag,    dot: listings.length > 0 },
    { label: "Pengguna",    shortcut: "⌘U", icon: User,           dot: users.some((u) => u.status !== "active") },
    { label: "Pengaturan",  shortcut: "⌘,", icon: Settings },
  ];

  return (
    <div className="cx-admin-shell">
      {/* ── Sidebar ── */}
      <aside className="cx-sidebar">
        <div className="cx-sidebar-brand">
          <span className="cx-brand-mark" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 4 }}>&lt;/&gt;</span>
          <span>CodeXa Store</span>
          <ChevronDown size={12} color="var(--faint)" />
        </div>
        <div className="cx-sidebar-section">Workspace</div>
        <nav>
          {NAV_ITEMS.map(({ label, shortcut, icon: NavIcon, dot }) => (
            <button key={label} className={`cx-sidebar-item ${activeNav === label ? "active" : ""}`} onClick={() => setActiveNav(label)}>
              <NavIcon size={14} strokeWidth={1.7} />
              <span>{label}</span>
              {dot && <span className="cx-sidebar-dot" />}
              <span className="cx-sidebar-shortcut">{shortcut}</span>
            </button>
          ))}
        </nav>
        <div className="cx-sidebar-footer">
          <button className="cx-sidebar-item" onClick={logout} style={{ width: "100%" }}>
            <LogOut size={14} strokeWidth={1.7} /><span>Keluar</span>
            <span className="cx-sidebar-shortcut">⇧⌘Q</span>
          </button>
          <div className="cx-sidebar-user">
            <div className="cx-avatar">AR</div>
            <div className="cx-sidebar-user-info">
              <strong>Admin</strong>
              <small>Owner</small>
            </div>
            <MoreHorizontal size={13} color="var(--faint)" style={{ marginLeft: "auto" }} />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="cx-admin-main">
        {/* Header */}
        <header className="cx-admin-header">
          <div className="cx-breadcrumb">
            <PanelLeft size={13} color="var(--faint)" />
            <span>Workspace</span>
            <span style={{ color: "var(--b3)" }}>/</span>
            <span className="active">{activeNav}</span>
          </div>
          <div className="cx-search" style={{ maxWidth: 420, flex: 1 }}>
            <Search size={12} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk, pesanan..." />
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace,monospace", fontSize: 10, color: "var(--faint)", border: "1px solid var(--b3)", borderRadius: 3, padding: "1px 5px" }}>⌘K</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <IconBtn label="Bantuan"><CircleHelp size={13} /></IconBtn>
            <IconBtn label="Notifikasi" style={{ position: "relative" }}><Bell size={13} /></IconBtn>
            <div className="cx-avatar">AR</div>
          </div>
        </header>

        {/* Command bar */}
        <div className="cx-cmd-bar">
          <Command size={11} />
          <span>Press <kbd>⌘K</kbd> for commands</span>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace,monospace", color: "var(--faint)", fontSize: 10 }}>v2.4.1</span>
        </div>

        {/* Content */}
        <div className="cx-admin-content">
          <div className="cx-admin-top">
            <div>
              <div className="cx-admin-date">{new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
              <h1>Ringkasan</h1>
            </div>
            <div className="cx-admin-actions">
              <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={loadListings}><RefreshCw size={11} /> Refresh</button>
              <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => openForm()}><Plus size={11} /> Tambah Produk</button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="cx-stat-grid">
            {[
              { label: "Total Produk", value: totalProducts, delta: `${listings.length} listing`, up: true },
              { label: "Terjual",      value: totalSold,     delta: "dari total listing", up: totalSold > 0 },
              { label: "Revenue",      value: formatPrice(revenue), delta: "akumulasi terjual", up: revenue > 0 },
              { label: "Stok Rendah",  value: lowStock,      delta: "perlu restock", up: false },
            ].map(({ label, value, delta, up }) => (
              <div key={label} className="cx-stat-card">
                <div className="cx-stat-label">{label}</div>
                <div className="cx-stat-value">{value}</div>
                <div className={`cx-stat-delta ${up ? "up" : "down"}`}>
                  {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  <span style={{ marginLeft: 2 }}>{delta}</span>
                </div>
              </div>
            ))}
          </div>

          {apiError && (
            <div style={{ border: "1px solid rgba(201,121,128,.3)", background: "rgba(201,121,128,.08)", color: "var(--red)", padding: "10px 14px", borderRadius: 4, fontSize: 11, marginBottom: 18 }}>
              {apiError}
            </div>
          )}

          {/* Top Up requests */}
          <div className="cx-panel" style={{ marginBottom: 18 }}>
            <div className="cx-panel-header">
              <h3>Permintaan Top Up</h3>
              <span className="cx-panel-sub">{topups.filter((t) => t.status === "pending").length} menunggu · {users.length} user terdaftar</span>
              <button className="cx-icon-btn" style={{ marginLeft: "auto" }} onClick={loadUsersData} aria-label="Muat ulang"><RefreshCw size={13} /></button>
            </div>
            {topups.length === 0
              ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11 }}>Belum ada permintaan top up.</div>
              : topups.slice(0, 15).map((t) => (
                <div key={t.id} className="cx-topup-row">
                  <div>
                    <strong>{formatPrice(t.amount)}</strong>
                    <small>{t.userName} · {t.userEmail} · {t.method}{t.reference ? ` · ID trx: ${t.reference}` : ""}{t.note ? ` · catatan: ${t.note}` : ""}</small>
                  </div>
                  <span className="cx-topup-date">{formatDate(t.createdAt)}</span>
                  {t.status === "pending"
                    ? <div style={{ display: "flex", gap: 6 }}>
                        <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => reviewTopup(t.id, "approve")}><Check size={11} /> Setujui</button>
                        <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => reviewTopup(t.id, "reject")}><X size={11} /> Tolak</button>
                      </div>
                    : <span className={`cx-topup-badge ${t.status === "approved" ? "ok" : "bad"}`}>
                        {t.status === "approved" ? <BadgeCheck size={11} /> : <X size={11} />}
                        {t.status === "approved" ? " Disetujui" : " Ditolak"}
                      </span>}
                </div>
              ))}
          </div>

          {/* Manajemen User */}
          <div className="cx-panel" style={{ marginBottom: 18 }}>
            <div className="cx-panel-header">
              <h3>Pengguna</h3>
              <span className="cx-panel-sub">{filteredUsers.length} dari {users.length} akun</span>
              <div className="cx-search" style={{ marginLeft: "auto", maxWidth: 240 }}>
                <Search size={12} />
                <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Cari nama / email / no. HP" />
              </div>
              <button className="cx-icon-btn" onClick={loadUsersData} aria-label="Muat ulang user"><RefreshCw size={13} /></button>
            </div>
            <div className="cx-user-head">
              <span>USER</span><span>SALDO</span><span>TOP UP</span><span>STATUS</span><span>BERGABUNG</span><span />
            </div>
            {filteredUsers.length === 0
              ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11 }}>Belum ada user terdaftar.</div>
              : filteredUsers.map((u) => (
                <div key={u.id} className="cx-user-row">
                  <div className="cx-user-ident">
                    <div className="cx-avatar">{String(u.name || "U").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <strong>{u.name}</strong>
                      <small>{u.email}{u.phone ? ` · ${u.phone}` : ""}</small>
                    </div>
                  </div>
                  <span className="cx-mono">{formatPrice(u.balance)}</span>
                  <span className="cx-mono" style={{ color: "var(--muted)" }}>
                    {formatPrice(u.topupTotal)}{u.pendingCount ? ` · ${u.pendingCount} pending` : ""}
                  </span>
                  <span className={`cx-status ${u.status === "active" ? "cx-status-ok" : u.status === "suspended" ? "cx-status-low" : "cx-status-out"}`}>
                    {u.status === "active" ? "Aktif" : u.status === "suspended" ? "Ditangguhkan" : "Diblokir"}
                  </span>
                  <span className="cx-user-date">{formatDate(u.createdAt)}</span>
                  <div className="cx-row-actions">
                    {u.status === "active"
                      ? <button className="cx-row-btn" onClick={() => setUserStatus(u.id, "suspend")} aria-label="Tangguhkan"><LockKeyhole size={11} /></button>
                      : <button className="cx-row-btn" onClick={() => setUserStatus(u.id, "activate")} aria-label="Aktifkan"><BadgeCheck size={11} /></button>}
                    <button className="cx-row-btn" onClick={() => openUserForm(u)} aria-label="Edit user"><Pencil size={11} /></button>
                    <button className="cx-row-btn danger" onClick={() => deleteUser(u)} aria-label="Hapus user"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
          </div>

          {/* Two-col: Activity + Inventory */}
          <div className="cx-two-col">
            {/* Activity */}
            <div className="cx-panel">
              <div className="cx-panel-header">
                <h3>Aktivitas Terbaru</h3>
                <span style={{ marginLeft: "auto", color: "var(--indigo2)", fontSize: 10, cursor: "pointer" }}>Lihat semua</span>
              </div>
              {listings.slice(0, 5).length === 0
                ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11 }}>Belum ada aktivitas.</div>
                : listings.slice(0, 5).map((l) => (
                  <div key={l.id} className="cx-activity-item">
                    <div className="cx-activity-icon" style={{ color: ACCENT_COLORS[listings.indexOf(l) % ACCENT_COLORS.length] }}>
                      <ProviderIcon type={l.loginType} size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cx-activity-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
                      <div className="cx-activity-desc">{l.loginType} · Stok: {l.stock}</div>
                    </div>
                    <span className="cx-activity-time">{l.status === "sold" ? "Terjual" : "Tersedia"}</span>
                  </div>
                ))
              }
            </div>

            {/* Inventory Table */}
            <div className="cx-panel">
              <div className="cx-panel-header">
                <h3>Produk</h3>
                <span className="cx-panel-sub">{filtered.length} dari {listings.length}</span>
                <button className="cx-icon-btn" style={{ marginLeft: "auto" }} onClick={() => openForm()} aria-label="Tambah produk">
                  <Plus size={13} />
                </button>
              </div>

              {loading
                ? <div style={{ padding: "20px 14px", color: "var(--muted)", fontSize: 11 }}>Memuat produk...</div>
                : <>
                  <div className="cx-table-head">
                    <span>PRODUK</span>
                    <span>HARGA</span>
                    <span>STOK</span>
                    <span>STATUS</span>
                    <span />
                  </div>
                  {filtered.length === 0
                    ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11, textAlign: "center" }}>Tidak ada produk ditemukan.</div>
                    : filtered.map((l) => {
                      const statusClass = l.status === "available" ? "cx-status-ok" : "cx-status-out";
                      return (
                        <div key={l.id} className="cx-table-row">
                          <div className="cx-product-name">
                            <strong>{l.title}</strong>
                            <small style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <ProviderIcon type={l.loginType} size={13} />
                              {l.loginType}
                            </small>
                          </div>
                          <span className="cx-mono">{(() => {
                            const prices = (l.accounts || []).map((a) => Number(a.price) || Number(l.price) || 0);
                            const min = prices.length ? Math.min(...prices) : Number(l.price) || 0;
                            const max = prices.length ? Math.max(...prices) : min;
                            return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
                          })()}</span>
                          <span className="cx-mono" style={{ color: Number(l.stock) === 0 ? "var(--red)" : Number(l.stock) <= 3 ? "var(--amber)" : "var(--ink2)" }}>{l.stock}</span>
                          <span className={`cx-status ${l.status === "available" ? "cx-status-ok" : Number(l.stock) <= 3 ? "cx-status-low" : "cx-status-out"}`}>
                            {l.status === "available" ? "Aktif" : "Habis"}
                          </span>
                          <div className="cx-row-actions">
                            <button className="cx-row-btn" onClick={() => openForm(l)} aria-label="Edit"><Pencil size={11} /></button>
                            <button className="cx-row-btn danger" onClick={() => deleteListing(l.id)} aria-label="Hapus"><Trash2 size={11} /></button>
                          </div>
                        </div>
                      );
                    })
                  }
                </>
              }
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="cx-status-bar">
          <span className="cx-status-dot" />
          Last sync: baru saja
          <span style={{ marginLeft: "auto" }}>Jakarta · UTC+7</span>
        </div>
      </main>

      {/* User modal */}
      {userForm && (
        <div className="cx-modal-backdrop" onClick={() => setUserForm(null)}>
          <div className="cx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cx-modal-header">
              <h2>Edit Akun User</h2>
              <button className="cx-icon-btn" onClick={() => setUserForm(null)}><X size={14} /></button>
            </div>
            <div className="cx-modal-body">
              <div className="cx-form-grid">
                <Field label="Nama">
                  <InputWrap><input value={userForm.name} onChange={(e) => updateUserForm("name", e.target.value)} /></InputWrap>
                </Field>
                <Field label="Email">
                  <InputWrap><input value={userForm.email} onChange={(e) => updateUserForm("email", e.target.value)} /></InputWrap>
                </Field>
                <Field label="Nomor WhatsApp">
                  <InputWrap><input value={userForm.phone} onChange={(e) => updateUserForm("phone", e.target.value)} placeholder="0812xxxx" /></InputWrap>
                </Field>
                <Field label="Saldo (IDR)" hint="Ubah manual bila perlu koreksi">
                  <InputWrap><input type="number" value={userForm.balance} onChange={(e) => updateUserForm("balance", e.target.value)} /></InputWrap>
                </Field>
                <Field label="Status Akun">
                  <InputWrap>
                    <select value={userForm.status} onChange={(e) => updateUserForm("status", e.target.value)}>
                      <option value="active">Aktif</option>
                      <option value="suspended">Ditangguhkan</option>
                      <option value="banned">Diblokir</option>
                    </select>
                  </InputWrap>
                </Field>
                <Field label="Reset Password" hint="Kosongkan bila tidak diubah">
                  <InputWrap><input type="text" value={userForm.password} onChange={(e) => updateUserForm("password", e.target.value)} placeholder="min. 6 karakter" /></InputWrap>
                </Field>
                <div className="cx-full-span">
                  <Field label="Catatan Admin">
                    <InputWrap><textarea value={userForm.note} onChange={(e) => updateUserForm("note", e.target.value)} placeholder="Catatan internal tentang user ini..." /></InputWrap>
                  </Field>
                </div>
              </div>
              <div className="cx-form-divider">RINGKASAN <small>bergabung {formatDate(userForm.createdAt)} · total top up {formatPrice(userForm.topupTotal)}</small></div>
              {apiError && <p className="cx-form-error">{apiError}</p>}
            </div>
            <div className="cx-modal-footer">
              <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setUserForm(null)}>Batal</button>
              <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={saveUser} disabled={savingUser}>
                {savingUser ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {form && (
        <div className="cx-modal-backdrop" onClick={() => setForm(null)}>
          <div className="cx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cx-modal-header">
              <h2>{form.id ? "Edit Produk" : "Tambah Produk Baru"}</h2>
              <button className="cx-icon-btn" onClick={() => setForm(null)}><X size={14} /></button>
            </div>
            <div className="cx-modal-body">
              <div className="cx-form-grid">
                <div className="cx-full-span">
                  <Field label="Judul Produk">
                    <InputWrap><input value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="cth. Netflix Premium 1 Bulan" /></InputWrap>
                  </Field>
                </div>
                <div className="cx-full-span">
                  <Field label="Deskripsi">
                    <InputWrap><textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Deskripsi singkat produk..." /></InputWrap>
                  </Field>
                </div>
                <Field label="Tipe Login">
                  <InputWrap>
                    <select value={form.loginType} onChange={(e) => updateForm("loginType", e.target.value)}>
                      {LOGIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </InputWrap>
                </Field>
                <Field label="Harga default per akun (IDR)" hint="Dipakai untuk akun yang harganya dikosongkan">
                  <InputWrap><input type="number" value={form.price} onChange={(e) => updateForm("price", e.target.value)} placeholder="35000" /></InputWrap>
                </Field>
                <Field label="Stok (otomatis dari jumlah akun)">
                  <InputWrap><input value={(form.accounts || []).filter((a) => a.email || a.password).length} readOnly /></InputWrap>
                </Field>
                <Field label="Status">
                  <InputWrap>
                    <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                      <option value="available">Tersedia</option>
                      <option value="sold">Habis</option>
                    </select>
                  </InputWrap>
                </Field>
              </div>
              <div className="cx-form-divider">DATA AKUN <small>1 baris = 1 stok · harga bisa diatur per akun</small></div>
              <div className="cx-account-editor">
                {(form.accounts || []).map((account, index) => (
                  <div className="cx-account-row" key={index}>
                    <span className="cx-account-no">#{index + 1}</span>
                    <InputWrap>
                      <input
                        value={account.email}
                        onChange={(e) => updateAccount(index, "email", e.target.value)}
                        placeholder="user@email.com"
                      />
                    </InputWrap>
                    <InputWrap>
                      <input
                        type={revealed ? "text" : "password"}
                        value={account.password}
                        onChange={(e) => updateAccount(index, "password", e.target.value)}
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setRevealed((v) => !v)} style={{ color: "var(--muted)", background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                        {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </InputWrap>
                    <InputWrap>
                      <input
                        type="number"
                        value={account.price ?? ""}
                        onChange={(e) => updateAccount(index, "price", e.target.value)}
                        placeholder={String(form.price || "Harga")}
                      />
                    </InputWrap>
                    <button
                      type="button"
                      className="cx-icon-btn"
                      onClick={() => removeAccount(index)}
                      disabled={(form.accounts || []).length <= 1}
                      aria-label={`Hapus akun #${index + 1}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={addAccount}>
                  <Plus size={11} /> Tambah data akun
                </button>
              </div>
              <div className="cx-form-grid" style={{ marginTop: 12 }}>
                <div className="cx-full-span">
                  <Field label="Detail Pengiriman">
                    <InputWrap><textarea value={form.deliveryDetails || ""} onChange={(e) => updateForm("deliveryDetails", e.target.value)} placeholder="Info tambahan yang dikirim ke pembeli setelah bayar..." /></InputWrap>
                  </Field>
                </div>
              </div>
              {apiError && <p style={{ color: "var(--red)", fontSize: 11, marginTop: 8 }}>{apiError}</p>}
            </div>
            <div className="cx-modal-footer">
              <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setForm(null)}>Batal</button>
              <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={save} disabled={saving}>
                {saving ? <><RefreshCw size={11} /> Menyimpan...</> : <><Check size={11} /> {form.id ? "Simpan Perubahan" : "Tambah Produk"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AUTH PAGE (daftar / masuk)
════════════════════════════════════════════════════ */
function AuthPage({ onAuthenticated }) {
  const [mode, setMode]         = useState("login");
  const [form, setForm]         = useState({ name: "", email: "", phone: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const payload = mode === "register"
        ? { action: "register", name: form.name, email: form.email, phone: form.phone, password: form.password }
        : { action: "login", email: form.email, password: form.password };
      const res = await jsonRequest("/api/auth", { method: "POST", body: JSON.stringify(payload) });
      onAuthenticated(res.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="cx-login-wrap">
      <div className="cx-login-box cx-auth-box">
        <div className="cx-login-mark">&lt;/&gt;</div>
        <h1>{mode === "register" ? "Daftar CodeXa" : "Masuk ke CodeXa"}</h1>
        <p>{mode === "register" ? "Buat akun untuk mulai belanja dan isi saldo." : "Masuk dulu untuk mengakses katalog dan saldo kamu."}</p>

        <div className="cx-auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Masuk</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Daftar</button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <Field label="Nama lengkap">
                <InputWrap icon={User}>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama kamu" required />
                </InputWrap>
              </Field>
              <Field label="Nomor WhatsApp" hint="Opsional, dipakai admin untuk konfirmasi top up.">
                <InputWrap icon={Phone}>
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxxxx" />
                </InputWrap>
              </Field>
            </>
          )}
          <Field label="Email">
            <InputWrap icon={Mail}>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="nama@email.com" required />
            </InputWrap>
          </Field>
          <Field label="Password" hint={mode === "register" ? "Minimal 6 karakter." : ""}>
            <InputWrap icon={LockKeyhole}>
              <input type={showPass ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••" required />
              <button type="button" onClick={() => setShowPass((v) => !v)} style={{ color: "var(--muted)", background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </InputWrap>
          </Field>
          {error && <p className="cx-form-error">{error}</p>}
          <button type="submit" className="cx-btn cx-btn-primary cx-btn-full" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? <><RefreshCw size={13} /> Memproses...</> : <><LogIn size={13} /> {mode === "register" ? "Daftar sekarang" : "Masuk"}</>}
          </button>
        </form>
        <p className="cx-auth-switch">
          {mode === "register" ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>
            {mode === "register" ? "Masuk di sini" : "Daftar gratis"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PROFIL & TOP UP (halaman terpisah)
════════════════════════════════════════════════════ */
const QRIS_APPS = [
  { id: "DANA",                    short: "DANA",  icon: "/wallets/dana.svg",          color: "#118EEA", tint: "rgba(17,142,234,.14)" },
  { id: "GoPay",                   short: "gopay", icon: "/wallets/gopay.svg",         color: "#00AA13", tint: "rgba(0,170,19,.14)" },
  { id: "OVO",                     short: "OVO",   icon: "/wallets/ovo.svg",           color: "#4C3494", tint: "rgba(76,52,148,.16)" },
  { id: "ShopeePay",               short: "SPay",  icon: "/wallets/shopee-pay.svg",    color: "#EE4D2D", tint: "rgba(238,77,45,.14)" },
  { id: "LinkAja",                 short: "Link",  icon: "/wallets/linkaja.svg",       color: "#E22B2B", tint: "rgba(226,43,43,.14)" },
  { id: "QRIS BCA mobile / myBCA", short: "BCA",   icon: "/wallets/bca-mobile.svg",    color: "#0066AE", tint: "rgba(0,102,174,.14)" },
  { id: "QRIS BRImo",              short: "BRI",   icon: "/wallets/brimo.svg",         color: "#00529C", tint: "rgba(0,82,156,.14)" },
  { id: "QRIS Livin\' by Mandiri",  short: "Livin", icon: "/wallets/mandiri-livin.svg", color: "#003D79", tint: "rgba(0,61,121,.14)" },
  { id: "QRIS SeaBank",            short: "Sea",   icon: "/wallets/seabank.svg",       color: "#F26F21", tint: "rgba(242,111,33,.14)" },
  { id: "Lainnya",                 short: "\u2022\u2022\u2022",   icon: null,                         color: "#6366F1", tint: "rgba(99,102,241,.14)" },
];
const appMeta = (id) => QRIS_APPS.find((a) => a.id === id) || QRIS_APPS[QRIS_APPS.length - 1];

function AppLogo({ app, size = 34 }) {
  const m = appMeta(app);
  return (
    <span className="cx-applogo" style={{ width: size * 1.55, height: size, background: m.tint, color: m.color, borderColor: m.color }}>
      {m.icon
        ? <img src={m.icon} alt={m.id} className="cx-applogo-img" loading="lazy" />
        : m.short}
    </span>
  );
}

const IconWhatsApp = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.21-8.24 8.21z"/>
  </svg>
);
const IconTelegram = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#229ED9" aria-hidden="true">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.64 6.8-1.6 7.56c-.12.54-.44.67-.89.42l-2.46-1.81-1.19 1.14c-.13.13-.24.24-.5.24l.18-2.53 4.6-4.16c.2-.18-.04-.28-.31-.1l-5.69 3.58-2.45-.77c-.53-.17-.54-.53.11-.79l9.58-3.69c.44-.16.83.1.62.91z"/>
  </svg>
);

const QRIS_IMAGE   = "/qris-kztutorial.png";
const QRIS_NAME    = "KZ.TUTORIAL";
const QRIS_NMID    = "ID1026476486182";
const WA_NUMBER    = "62895325844493";
const TG_USERNAME  = "Kztutorial";
const TOPUP_PRESETS = [25000, 50000, 100000, 250000, 500000];


const topupStatusBadge = (status) =>
  status === "approved" ? <span className="cx-topup-badge ok"><BadgeCheck size={11} /> Disetujui</span>
  : status === "rejected" ? <span className="cx-topup-badge bad"><X size={11} /> Ditolak</span>
  : <span className="cx-topup-badge wait"><Clock size={11} /> Menunggu</span>;

function useTopupData(user) {
  const [state, setState] = useState({ balance: user.balance, topups: [], loading: true, error: "" });
  const load = () => {
    setState((x) => ({ ...x, loading: true, error: "" }));
    jsonRequest("/api/topup", { method: "GET" })
      .then((p) => setState({ balance: Number(p.balance) || 0, topups: p.topups || [], loading: false, error: "" }))
      .catch((e) => setState((x) => ({ ...x, loading: false, error: e.message })));
  };
  useEffect(() => { load(); }, []);
  return [state, load];
}

/* ─── Halaman Profil (tanpa form top up) ─── */
function ProfilePage({ user, onBack, onTopup }) {
  const [state] = useTopupData(user);
  const initials = String(user.name || "CX").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const pendingTotal = state.topups.filter((t) => t.status === "pending").reduce((a, t) => a + t.amount, 0);

  return (
    <div className="cx-container cx-account-page">
      <button className="cx-back-link" onClick={onBack}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali ke store</button>

      <div className="cx-account-grid">
        <div className="cx-panel cx-profile-card">
          <div className="cx-profile-head">
            <div className="cx-avatar cx-avatar-xl">{initials}</div>
            <div>
              <h2>{user.name}</h2>
              <p>Member CodeXa sejak {formatDate(user.createdAt)}</p>
            </div>
          </div>
          <ul className="cx-profile-list">
            <li><Mail size={13} /><span>Email</span><strong>{user.email}</strong></li>
            <li><Phone size={13} /><span>WhatsApp</span><strong>{user.phone || "-"}</strong></li>
            <li><BadgeCheck size={13} /><span>ID Akun</span><strong className="cx-mono">{String(user.id).slice(0, 8)}</strong></li>
            <li><ShieldCheck size={13} /><span>Status</span><strong>Terverifikasi</strong></li>
          </ul>

          <div className="cx-balance-card">
            <span><Wallet size={13} /> Saldo tersedia</span>
            <strong>{formatPrice(state.balance)}</strong>
            {pendingTotal > 0 && <small>{formatPrice(pendingTotal)} menunggu verifikasi</small>}
          </div>

          <button className="cx-btn cx-btn-primary cx-btn-full" style={{ marginTop: 12 }} onClick={onTopup}>
            <CreditCard size={13} /> Top up saldo
          </button>
        </div>

        <div className="cx-panel">
          <div className="cx-panel-header">
            <h3>Aktivitas Top Up Terakhir</h3>
            <span className="cx-panel-sub">ringkasan 5 permintaan terbaru</span>
          </div>
          {state.loading ? <div className="cx-topup-empty">Memuat riwayat...</div>
            : state.error ? <div className="cx-topup-empty">{state.error}</div>
            : state.topups.length === 0 ? <div className="cx-topup-empty">Belum ada permintaan top up.</div>
            : state.topups.slice(0, 5).map((t) => (
              <div key={t.id} className="cx-topup-row">
                <div>
                  <strong>{formatPrice(t.amount)}</strong>
                  <small>{t.method}{t.reference ? ` · ID ${t.reference}` : ""}</small>
                </div>
                <span className="cx-topup-date">{formatDate(t.createdAt)}</span>
                {topupStatusBadge(t.status)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Halaman Top Up (berdiri sendiri) ─── */
function TopUpPage({ user, onBack, onNotice, onRefresh }) {
  const [state, load] = useTopupData(user);
  const [amount, setAmount]     = useState("");
  const [app, setApp]           = useState(QRIS_APPS[0].id);
  const [otherApp, setOtherApp] = useState("");
  const [trxId, setTrxId]       = useState("");
  const [note, setNote]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [formError, setFormError] = useState("");
  const [step, setStep]         = useState("form");
  const [agreed, setAgreed]     = useState(false);
  const [orderId, setOrderId]   = useState("");
  const trxIdRef = useRef(null);
  const [showTrxRequired, setShowTrxRequired] = useState(false);

  const amountNumber = Math.round(Number(amount) || 0);
  const isOther  = app === "Lainnya";
  const appLabel = (isOther ? otherApp.trim() : app) || "Lainnya";
  const methodLabel = `QRIS · ${appLabel}`;
  const pendingTotal = state.topups.filter((t) => t.status === "pending").reduce((a, t) => a + t.amount, 0);
  const dataReady = trxId.trim().length >= 4 && (!isOther || otherApp.trim());

  const goConfirm = (e) => {
    e.preventDefault(); setFormError("");
    if (!Number.isFinite(amountNumber) || amountNumber < 10000) {
      setFormError("Minimal top up Rp10.000."); return;
    }
    if (isOther && !otherApp.trim()) {
      setFormError("Tulis nama aplikasi pembayaran yang kamu pakai."); return;
    }
    setOrderId("CX" + Date.now().toString().slice(-6));
    setAgreed(false); setStep("confirm");
  };

  const fullNote = () => {
    const parts = [];
    if (isOther) parts.push(`Aplikasi: ${otherApp.trim()}`);
    if (note.trim()) parts.push(note.trim());
    parts.push(`Order ID: ${orderId}`);
    return parts.join(" | ").slice(0, 300);
  };

  const proofMessage = () =>
    encodeURIComponent(
      `Halo ${QRIS_NAME}, saya mau konfirmasi pembayaran top up CodeXa.\n\n` +
      `Order ID: ${orderId}\n` +
      `Nama: ${user.name}\n` +
      `Email: ${user.email}\n` +
      `Nominal: ${formatPrice(amountNumber)}\n` +
      `Bayar QRIS via: ${appLabel}\n` +
      `No. ID Transaksi: ${trxId.trim() || "-"}\n` +
      `Catatan: ${note.trim() || "-"}\n\n` +
      `(bukti transfer saya lampirkan di chat ini)`
    );

  const handleProofClick = (e) => {
    e.preventDefault();
    setShowTrxRequired(true);
    setFormError("* wajib masukan id transaksi");
    trxIdRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => trxIdRef.current?.focus(), 350);
  };

  const submitTopup = async (e) => {
    e.preventDefault(); setFormError(""); setShowTrxRequired(false);
    if (!trxId.trim()) { setFormError("Nomor ID transaksi wajib diisi."); setShowTrxRequired(true); return; }
    setBusy(true);

    try {
      await jsonRequest("/api/topup", {
        method: "POST",
        body: JSON.stringify({ amount: amountNumber, method: methodLabel, reference: trxId.trim(), note: fullNote() }),
      });
      setAmount(""); setTrxId(""); setNote(""); setOtherApp(""); setApp(QRIS_APPS[0].id);
      setStep("form"); setAgreed(false);
      onNotice("Permintaan top up dikirim, menunggu verifikasi admin");
      load(); onRefresh();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  };

  const summaryRows = [
    ["Order ID", orderId],
    ["Nominal", formatPrice(amountNumber)],
    ["Bayar via", appLabel],
    ["Nama", user.name],
    ["Email", user.email],
  ];

  return (
    <div className="cx-container cx-account-page">
      <button className="cx-back-link" onClick={onBack}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali ke store</button>

      <div className="cx-account-grid">
        <div className="cx-panel">
          <div className="cx-panel-header">
            <h3>Top Up Saldo</h3>
            <span className="cx-panel-sub">QRIS statis · verifikasi manual admin</span>
          </div>

          <div className="cx-steps-bar">
            {["Nominal", "Konfirmasi", "Bayar & bukti"].map((s, i) => {
              const idx = step === "form" ? 0 : step === "confirm" ? 1 : 2;
              return (
                <span key={s} className={`cx-step${i === idx ? " active" : ""}${i < idx ? " done" : ""}`}>
                  <b>{i + 1}</b>{s}
                </span>
              );
            })}
          </div>

          {step === "form" ? (
          <form className="cx-topup-form" onSubmit={goConfirm}>
            <div className="cx-topup-presets">
              {TOPUP_PRESETS.map((v) => (
                <button type="button" key={v} className={`cx-chip${Number(amount) === v ? " active" : ""}`} onClick={() => setAmount(String(v))}>
                  {formatPrice(v)}
                </button>
              ))}
            </div>
            <Field label="Nominal top up" hint="Minimal Rp10.000.">
              <InputWrap icon={CreditCard}>
                <input type="number" min="10000" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" required />
              </InputWrap>
            </Field>

            <div className="cx-field-label">Bayar QRIS pakai aplikasi apa?</div>
            <div className="cx-app-grid">
              {QRIS_APPS.map((a) => (
                <button type="button" key={a.id}
                  className={`cx-app-tile${app === a.id ? " active" : ""}`}
                  style={app === a.id ? { borderColor: a.color, background: a.tint } : undefined}
                  onClick={() => setApp(a.id)}>
                  <AppLogo app={a.id} size={30} />
                  <span>{a.id.replace("QRIS ", "")}</span>
                </button>
              ))}
            </div>
            <p className="cx-field-hint">Tidak ada di daftar? Pilih <strong>•••  Lainnya</strong> lalu tulis nama aplikasinya.</p>

            {isOther && (
              <Field label="Tulis nama aplikasinya" hint="Akan dikirim ke admin lewat catatan.">
                <InputWrap icon={FileText}>
                  <input value={otherApp} onChange={(e) => setOtherApp(e.target.value)} placeholder="Contoh: Jenius, Blu, Astrapay" required />
                </InputWrap>
              </Field>
            )}
            {formError && <p className="cx-form-error">{formError}</p>}
            <button type="submit" className="cx-btn cx-btn-primary cx-btn-full">
              Cek &amp; konfirmasi nominal <ArrowRight size={13} />
            </button>
          </form>
          ) : step === "confirm" ? (
          <div className="cx-topup-form">
            <div className="cx-confirm-hero">
              <span className="cx-confirm-cap">Cek &amp; konfirmasi nominal</span>
              <strong className="cx-confirm-amount">{formatPrice(amountNumber)}</strong>
              <div className="cx-confirm-app">
                <AppLogo app={app} size={26} />
                <span>{appLabel}</span>
              </div>
            </div>

            <ul className="cx-summary-list">
              {summaryRows.map(([k, v]) => (
                <li key={k}><span>{k}</span><strong>{v}</strong></li>
              ))}
            </ul>

            <label className="cx-confirm-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>Saya sudah memeriksa, nominal <strong>{formatPrice(amountNumber)}</strong> sudah benar.</span>
            </label>
            <div className="cx-confirm-actions">
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setStep("form")}>Ubah nominal</button>
              <button type="button" className="cx-btn cx-btn-primary" disabled={!agreed} onClick={() => setStep("pay")}>
                Lanjut bayar <ArrowRight size={13} />
              </button>
            </div>
          </div>
          ) : (
          <form className="cx-topup-form" onSubmit={submitTopup}>
            <div className="cx-confirm-hero">
              <span className="cx-confirm-cap">Bayar tepat sejumlah</span>
              <strong className="cx-confirm-amount">{formatPrice(amountNumber)}</strong>
              <div className="cx-confirm-app">
                <AppLogo app={app} size={26} />
                <span>{appLabel} · {orderId}</span>
              </div>
            </div>
            <div className="cx-qris-wrap">
              <img src={QRIS_IMAGE} alt={`QRIS statis ${QRIS_NAME}`} loading="lazy" />
            </div>
            <p className="cx-qris-meta">{QRIS_NAME} · NMID {QRIS_NMID}</p>
            <ol className="cx-qris-steps">
              <li>Buka aplikasi <strong>{appLabel}</strong>, pilih menu QRIS / Scan.</li>
              <li>Scan QR di atas, masukkan nominal <strong>{formatPrice(amountNumber)}</strong>.</li>
              <li>Selesaikan pembayaran, catat <strong>nomor ID transaksi</strong> pada struk.</li>
              <li>Lengkapi data di bawah, baru kirim bukti ke admin.</li>
            </ol>

            <Field label="Nomor ID transaksi" hint="Wajib. Nomor referensi / transaction ID dari struk pembayaran." error={showTrxRequired ? "* wajib masukan id transaksi" : ""}>
              <InputWrap icon={FileText}>
                <input ref={trxIdRef} value={trxId} onChange={(e) => { setTrxId(e.target.value); if (showTrxRequired) setShowTrxRequired(false); }} placeholder="Contoh: TRX-2408061234567" required />
              </InputWrap>
            </Field>
            <Field label="Catatan untuk admin (opsional)" hint="Tulis di sini kalau aplikasi pembayaranmu tidak ada di daftar.">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: bayar QRIS dari Jenius a/n ..." />
            </Field>

            <ul className="cx-summary-list">
              <li><span>Metode</span><strong>{methodLabel}</strong></li>
              <li><span>ID transaksi</span><strong>{trxId.trim() || "-"}</strong></li>
              <li><span>Order ID</span><strong>{orderId}</strong></li>
              <li><span>Catatan</span><strong>{note.trim() || "-"}</strong></li>
            </ul>

            {formError && <p className="cx-form-error">{formError}</p>}

            <div className="cx-proof-block">
              <div className="cx-proof-title">
                {dataReady ? "Kirim bukti transfer ke admin" : "Lengkapi data di atas dulu untuk kirim bukti"}
              </div>
              <div className="cx-proof-actions">
                {dataReady ? (
                  <>
                    <a className="cx-btn cx-btn-ghost cx-proof-wa" href={`https://wa.me/${WA_NUMBER}?text=${proofMessage()}`} target="_blank" rel="noreferrer">
                      <IconWhatsApp size={16} /> Bukti via WhatsApp
                    </a>
                    <a className="cx-btn cx-btn-ghost cx-proof-tg" href={`https://t.me/${TG_USERNAME}?text=${proofMessage()}`} target="_blank" rel="noreferrer">
                      <IconTelegram size={16} /> Bukti via Telegram
                    </a>
                  </>
                ) : (
                  <>
                    <button type="button" className="cx-btn cx-btn-ghost cx-proof-wa" onClick={handleProofClick}><IconWhatsApp size={16} /> Bukti via WhatsApp</button>
                    <button type="button" className="cx-btn cx-btn-ghost cx-proof-tg" onClick={handleProofClick}><IconTelegram size={16} /> Bukti via Telegram</button>
                  </>
                )}
              </div>
            </div>

            <div className="cx-confirm-actions">
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setStep("confirm")}>Kembali</button>
              <button type="submit" className="cx-btn cx-btn-primary" disabled={busy || !dataReady}>
                {busy ? <><RefreshCw size={13} /> Mengirim...</> : <><Plus size={13} /> Saya sudah bayar</>}
              </button>
            </div>
          </form>
          )}
        </div>

        <div className="cx-panel">
          <div className="cx-panel-header">
            <h3>Riwayat Top Up</h3>
            <button className="cx-icon-btn" style={{ marginLeft: "auto" }} onClick={load} aria-label="Muat ulang"><RefreshCw size={13} /></button>
          </div>
          <div className="cx-balance-card" style={{ margin: "0 14px 12px" }}>
            <span><Wallet size={13} /> Saldo tersedia</span>
            <strong>{formatPrice(state.balance)}</strong>
            {pendingTotal > 0 && <small>{formatPrice(pendingTotal)} menunggu verifikasi</small>}
          </div>
          {state.loading ? <div className="cx-topup-empty">Memuat riwayat...</div>
            : state.error ? <div className="cx-topup-empty">{state.error}</div>
            : state.topups.length === 0 ? <div className="cx-topup-empty">Belum ada permintaan top up.</div>
            : state.topups.map((t) => (
              <div key={t.id} className="cx-topup-row">
                <div>
                  <strong>{formatPrice(t.amount)}</strong>
                  <small>{t.method}{t.reference ? ` · ID ${t.reference}` : ""}{t.note ? ` · ${t.note}` : ""}</small>
                </div>
                <span className="cx-topup-date">{formatDate(t.createdAt)}</span>
                {topupStatusBadge(t.status)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ─── mount ─── */
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
