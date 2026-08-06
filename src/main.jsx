import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, BadgeCheck, Bell, Check,
  CircleHelp, Command, Copy, CreditCard, Eye, EyeOff, ChevronDown,
  FileText, LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu,
  MoreHorizontal, Package, PanelLeft, Pencil, Plus, RefreshCw,
  Search, Settings, ShieldCheck, ShoppingBag, Trash2, X,
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
function Field({ label, children, hint }) {
  return (
    <div className="cx-field">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
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
    : "store"
  );
  const [search, setSearch]   = useState("");
  const [notice, setNotice]   = useState("");
  const [cart, setCart]       = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [buyItem, setBuyItem]   = useState(null);
  const [buySel, setBuySel]     = useState([]);
  const [data, setData]         = useState({ products: [], loading: true, error: "" });

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
      : window.location.pathname === "/help"   ? "help" : "store"
    );
    window.addEventListener("popstate", pop);
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

  /* ── simple pages ── */
  if (activePage === "orders") return (
    <div className="cx-app">
      <StoreTopbar activePage={activePage} navigate={navigate} cart={cart} onCartOpen={() => setCartOpen(true)} />
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
      <StoreTopbar activePage={activePage} navigate={navigate} cart={cart} onCartOpen={() => setCartOpen(true)} />
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
      <StoreTopbar activePage={activePage} navigate={navigate} cart={cart} onCartOpen={() => setCartOpen(true)} />

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
              <ProductCard key={p.id || i} product={p} colorIdx={i} onBuy={(sel) => { setBuyItem(p); setBuySel(sel && sel.length ? sel : (p.accounts || []).slice(0, 1).map((a) => a.index)); }} />
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
              <div className="cx-buy-symbol" style={{ color: `${ACCENT_COLORS[products.indexOf(buyItem) % ACCENT_COLORS.length]}22` }}>
                {(buyItem.loginType || "A")[0].toUpperCase()}
              </div>
              <div className="cx-buy-visual-mono">{buyItem.stock} STOK TERSEDIA</div>
            </div>
            <div className="cx-buy-body">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="cx-icon-btn" onClick={() => setBuyItem(null)}><X size={14} /></button>
              </div>
              <p style={{ color: "var(--faint)", fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: ".1em", textTransform: "uppercase", margin: "4px 0 6px" }}>
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
                      <div className="cx-cart-thumb" style={{ background: ACCENT_COLORS[i % ACCENT_COLORS.length] }}>
                        {(item.loginType || "A")[0].toUpperCase()}
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
      <button className="cx-admin-shortcut" onClick={() => navigate("admin")}><LayoutDashboard size={13} /> Admin</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STORE TOPBAR
════════════════════════════════════════════════════ */
function StoreTopbar({ activePage, navigate, cart, onCartOpen }) {
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
          <div className="cx-avatar">CX</div>
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
  const [selected, setSelected] = useState(() => accounts.slice(0, 1).map((a) => a.index));
  const toggle = (index) =>
    setSelected((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  const total = selected.length ? sumSelected(product, selected) : Number(product.price) || 0;
  return (
    <article className="cx-product-card">
      <div className="cx-product-body">
        <div className="cx-product-head">
          <p className="cx-product-type" style={{ color }}>{product.loginType}</p>
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
            <small className="cx-product-price-note">{selected.length ? `${selected.length} akun dipilih` : "mulai dari"}</small>
          </span>
          <button className="cx-product-buy" onClick={() => onBuy(selected)} aria-label={`Beli ${product.title}`}><ArrowRight size={13} /></button>
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

  const checkAuth = () =>
    jsonRequest("/api/admin/login", { method: "GET" })
      .then((p) => { setAuthenticated(p.authenticated); if (p.authenticated) loadListings(); })
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
    try { await jsonRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); setAuthenticated(true); setPassword(""); loadListings(); }
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
                      <Package size={12} strokeWidth={1.7} />
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
                            <small>{l.loginType}</small>
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

/* ─── mount ─── */
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
