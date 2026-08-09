import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, BadgeCheck, Bell, Check,
  CircleHelp, Command, Copy, CreditCard, Eye, EyeOff, ChevronDown,
  FileText, LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu,
  MoreHorizontal, Package, PanelLeft, Pencil, Plus, RefreshCw,
  Search, Settings, ShieldCheck, ShoppingBag, Trash2, X,
  User, Wallet, Mail, Phone, Clock, Sparkles, Send,
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

/* ─── Spinner kecil untuk state loading tombol ─── */
function Spinner({ size = 12 }) {
  return <RefreshCw size={size} className="cx-spin" aria-hidden="true" />;
}

/* ─── Tombol dengan loading state bawaan ───
   Selama busy: tombol otomatis disabled + spinner, jadi tidak ada aksi yang
   terlihat "diam" dan user tidak menekan berkali-kali. */
function ActionBtn({ busy, disabled, children, busyLabel, className = "cx-btn cx-btn-secondary cx-btn-sm", ...rest }) {
  return (
    <button {...rest} className={className} disabled={busy || disabled} aria-busy={busy ? "true" : undefined}>
      {busy ? <><Spinner /> {busyLabel || "Memproses..."}</> : children}
    </button>
  );
}

/* ─── Modal konfirmasi (pengganti window.confirm) ───
   Dipakai untuk semua aksi penting: hapus, setujui, tolak, bersihkan riwayat. */
function useConfirmDialog() {
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const confirm = (options) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setReq({
        title: "Konfirmasi tindakan",
        description: "",
        confirmText: "Konfirmasi",
        cancelText: "Batal",
        danger: false,
        ...options,
      });
    });

  const settle = (value) => {
    setReq(null); setBusy(false);
    if (resolver.current) { const r = resolver.current; resolver.current = null; r(value); }
  };

  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e) => { if (e.key === "Escape") settle(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  const element = req ? (
    <div className="cx-modal-backdrop cx-confirm-backdrop" onClick={() => !busy && settle(false)}>
      <div className={`cx-modal cx-confirm-modal${req.danger ? " is-danger" : ""}`} role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cx-confirm-icon">{req.danger ? <Trash2 size={18} /> : <ShieldCheck size={18} />}</div>
        <h3>{req.title}</h3>
        {req.description && <p>{req.description}</p>}
        {req.detail && <div className="cx-confirm-detail">{req.detail}</div>}
        <div className="cx-confirm-buttons">
          <button className="cx-btn cx-btn-ghost" onClick={() => settle(false)} disabled={busy}>{req.cancelText}</button>
          <button
            className={`cx-btn ${req.danger ? "cx-btn-danger" : "cx-btn-primary"}`}
            onClick={() => { setBusy(true); settle(true); }}
            disabled={busy}
            autoFocus
          >
            {busy ? <><Spinner /> Memproses...</> : req.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, element];
}

/* ─── Penanda aksi yang sedang berjalan (per-baris/per-tombol) ─── */
function usePendingActions() {
  const [pending, setPending] = useState({});
  const isPending = (key) => Boolean(pending[key]);
  const run = async (key, fn) => {
    if (pending[key]) return undefined;
    setPending((p) => ({ ...p, [key]: true }));
    try { return await fn(); }
    finally { setPending((p) => { const next = { ...p }; delete next[key]; return next; }); }
  };
  return [isPending, run];
}

/* ─── Teks panjang: tampil 3 baris dulu, sisanya lewat "Lihat selengkapnya" ─── */
function ExpandableText({ text: value, lines = 3, className = "", limit = 140 }) {
  const [open, setOpen] = useState(false);
  const raw = String(value == null ? "" : value);
  if (!raw.trim()) return null;
  const needsToggle = raw.length > limit || raw.split("\n").length > lines;
  return (
    <div className={`cx-expandable ${className}`.trim()}>
      <p className={open || !needsToggle ? "" : `cx-clamp cx-clamp-${lines}`}>{raw}</p>
      {needsToggle && (
        <button type="button" className="cx-expand-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Sembunyikan" : "Lihat selengkapnya"} <ChevronDown size={11} style={open ? { transform: "rotate(180deg)" } : undefined} />
        </button>
      )}
    </div>
  );
}

/* ─── Skeleton baris untuk state loading daftar ─── */
function RowSkeleton({ rows = 4 }) {
  return (
    <div className="cx-skeleton-list">
      {Array.from({ length: rows }).map((_, i) => <span key={i} className="cx-skeleton" />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APP ROOT
════════════════════════════════════════════════════ */
const PAGE_PATHS = ["admin", "orders", "help", "account", "topup", "custom-email", "terms", "privacy", "refund"];
const pageFromPath = (pathname) => {
  const slug = String(pathname || "/").replace(/^\/+|\/+$/g, "");
  return PAGE_PATHS.includes(slug) ? slug : "store";
};

function App() {
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const [search, setSearch]   = useState("");
  const [notice, setNotice]   = useState("");
  const [cart, setCart]       = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [buyItem, setBuyItem]   = useState(null);
  const [buySel, setBuySel]     = useState([]);
  const [data, setData]         = useState({ products: [], loading: true, error: "" });
  const [auth, setAuth]         = useState({ user: null, loading: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkout, setCheckout] = useState({ loading: false, error: "", order: null });
  const [customEmail, setCustomEmail] = useState("");
  const [emailCheck, setEmailCheck] = useState({ state: "idle", message: "" });
  const noticeTimer = useRef(null);

  /* Cek ketersediaan email/username kustom (debounce 500ms) supaya pembeli
     tahu lebih dulu apakah nama yang diminta masih bisa dipakai. */
  useEffect(() => {
    const value = customEmail.trim();
    if (!value) { setEmailCheck({ state: "idle", message: "" }); return undefined; }
    if (value.length < 3) { setEmailCheck({ state: "invalid", message: "Minimal 3 karakter" }); return undefined; }
    setEmailCheck({ state: "checking", message: "Mengecek ketersediaan..." });
    const timer = window.setTimeout(() => {
      jsonRequest(`/api/orders?resource=check-email&value=${encodeURIComponent(value)}`)
        .then((p) => setEmailCheck(p.available
          ? { state: "available", message: `${p.normalized} tersedia dan bisa dipakai` }
          : { state: "taken", message: p.reason || "Sudah dipakai pembeli lain, coba nama lain" }))
        .catch((e) => setEmailCheck({ state: "invalid", message: e.message }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [customEmail]);


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
    const pop = () => setActivePage(pageFromPath(window.location.pathname));
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
    // Pindah menu harus menutup semua panel yang sedang terbuka.
    setCartOpen(false);
    setBuyItem(null);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Timer lama dibersihkan dulu supaya notice baru tidak ikut terhapus.
  const showNotice = (msg) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = window.setTimeout(() => { setNotice(""); noticeTimer.current = null; }, 2800);
  };
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  const addToCart  = (product, selected) => {
    const picks = (product.accounts || []).filter((a) => selected.includes(a.index));
    const total = sumSelected(product, selected);
    setCart((c) => {
      // Gabungkan ke entri lama supaya satu listing tidak dobel di keranjang.
      const existing = c.find((item) => item.id === product.id);
      const entry = (list) => ({ ...product, selectedAccounts: list, qty: list.length || 1, price: sumSelected(product, list.map((a) => a.index)) || Number(product.price) || 0 });
      if (!existing) return [...c, entry(picks)];
      const seen = new Set((existing.selectedAccounts || []).map((a) => a.index));
      const mergedPicks = [...(existing.selectedAccounts || []), ...picks.filter((a) => !seen.has(a.index))]
        .sort((a, b) => a.index - b.index);
      return c.map((item) => (item.id === product.id ? entry(mergedPicks) : item));
    });
    showNotice(`${product.title} (${picks.length || 1} akun) ditambahkan`);
    setBuyItem(null);
  };
  const removeFromCart = (i) => setCart((c) => c.filter((_, idx) => idx !== i));

  /* ── checkout: bayar pakai saldo, akun langsung dikirim ── */
  const cartTotal = cart.reduce((a, c) => a + (Number(c.price) || 0), 0);
  const doCheckout = async () => {
    if (!cart.length || checkout.loading) return;
    const items = cart.map((item) => ({
      id: item.id,
      accounts: (item.selectedAccounts || []).map((a) => a.index),
    })).filter((item) => item.accounts.length);
    if (!items.length) { setCheckout({ loading: false, error: "Belum ada akun yang dipilih", order: null }); return; }
    setCheckout({ loading: true, error: "", order: null });
    try {
      const result = await jsonRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({ items, customEmail: customEmail.trim() }),
      });
      setCart([]);
      setCustomEmail("");
      setEmailCheck({ state: "idle", message: "" });
      setCartOpen(false);
      setCheckout({ loading: false, error: "", order: result.order });
      loadSession();
      loadCatalog();
      window.dispatchEvent(new Event("codexa:notify"));
      showNotice("Pembayaran berhasil, detail akun sudah terbuka");
    } catch (error) {
      setCheckout({ loading: false, error: error.message, order: null });
    }
  };


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

  const tabbar = (
    <MobileTabBar activePage={activePage} navigate={navigate} cart={cart} cartOpen={cartOpen} onCartOpen={() => setCartOpen(true)} />
  );

  /* Overlay global: dirender di SEMUA halaman supaya keranjang, modal beli,
     asisten, dan toast tetap bisa dibuka dari menu mana pun. */
  const overlays = (
    <>
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
              <div className="cx-buy-foot">
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
                <div><span>Subtotal ({cart.reduce((a, c) => a + (Number(c.qty) || 1), 0)} akun)</span><strong>{formatPrice(cartTotal)}</strong></div>
                <div><span>Saldo kamu</span><strong>{formatPrice(auth.user ? auth.user.balance : 0)}</strong></div>
                <div className="cx-custom-email">
                  <label htmlFor="cx-custom-email-input">
                    <Mail size={11} /> Email / username khusus <span>opsional</span>
                  </label>
                  <div className={`cx-input-wrap cx-custom-email-input is-${emailCheck.state}`}>
                    <input
                      id="cx-custom-email-input"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="mis. namaku99 atau namaku99@gmail.com"
                      maxLength={80}
                      autoComplete="off"
                    />
                    {emailCheck.state === "checking" && <Spinner />}
                    {emailCheck.state === "available" && <Check size={12} color="var(--green)" />}
                    {(emailCheck.state === "taken" || emailCheck.state === "invalid") && <X size={12} color="var(--red)" />}
                  </div>
                  <small className={`cx-custom-email-msg is-${emailCheck.state}`}>
                    {emailCheck.message || "Kosongkan kalau kamu tidak butuh nama akun tertentu."}
                  </small>
                </div>
                <p className="cx-checkout-note"><ShieldCheck size={11} /> Saldo dipotong otomatis, detail akun langsung terbuka</p>
                {checkout.error && <p className="cx-field-error" style={{ margin: "0 0 8px" }}>{checkout.error}</p>}
                <button
                  className="cx-btn cx-btn-primary cx-btn-full"
                  disabled={checkout.loading || emailCheck.state === "checking" || emailCheck.state === "taken"}
                  onClick={doCheckout}
                >
                  {checkout.loading ? <><Spinner size={13} /> Memproses pembayaran...</> : <>Bayar {formatPrice(cartTotal)} <ArrowRight size={13} /></>}
                </button>
                {auth.user && cartTotal > auth.user.balance && (
                  <button className="cx-btn cx-btn-ghost cx-btn-full" style={{ marginTop: 8 }} onClick={() => { setCartOpen(false); navigate("topup"); }}>
                    <CreditCard size={13} /> Top up saldo dulu
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      <AssistantWidget open={aiOpen} onOpenChange={setAiOpen} />

      {checkout.order && (
        <div className="cx-modal-backdrop" onClick={() => setCheckout({ loading: false, error: "", order: null })}>
          <div className="cx-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="cx-buy-body">
              <div className="cx-drawer-header" style={{ padding: 0, border: "none" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Pembayaran berhasil</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>
                    {formatPrice(checkout.order.total)} · {checkout.order.itemCount} akun
                  </p>
                </div>
                <button className="cx-icon-btn" onClick={() => setCheckout({ loading: false, error: "", order: null })}><X size={14} /></button>
              </div>
              <OrderItems items={checkout.order.items} onNotice={showNotice} />
              <button className="cx-btn cx-btn-ghost cx-btn-full" style={{ marginTop: 12 }} onClick={() => { setCheckout({ loading: false, error: "", order: null }); navigate("orders"); }}>
                <Package size={13} /> Lihat pesanan saya
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="cx-toast"><Check size={14} />{notice}</div>}
    </>
  );

  if (activePage === "terms" || activePage === "privacy" || activePage === "refund") return (
    <div className="cx-app">
      {topbar}
      <LegalPage kind={activePage} onBack={() => navigate("store")} navigate={navigate} />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  if (activePage === "account") return (
    <div className="cx-app">
      {topbar}
      <ProfilePage user={auth.user} onBack={() => navigate("store")} onTopup={() => navigate("topup")} />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  if (activePage === "topup") return (
    <div className="cx-app">
      {topbar}
      <TopUpPage user={auth.user} onBack={() => navigate("store")} onNotice={showNotice} onRefresh={loadSession} />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  /* ── simple pages ── */
  if (activePage === "orders") return (
    <div className="cx-app">
      {topbar}
      <OrdersPage onBack={() => navigate("store")} onNotice={showNotice} navigate={navigate} />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  if (activePage === "custom-email") return (
    <div className="cx-app">
      {topbar}
      <CustomEmailPage
        value={customEmail}
        setValue={setCustomEmail}
        check={emailCheck}
        onBack={() => navigate("store")}
        onUse={() => { showNotice("Nama disimpan, lanjut checkout di keranjang"); navigate("store"); }}
      />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  if (activePage === "help") return (
    <div className="cx-app">
      {topbar}
      <HelpPage navigate={navigate} onAskAssistant={() => setAiOpen(true)} />
      <StoreFooter navigate={navigate} />
      {tabbar}
      {overlays}
    </div>
  );

  /* ── store page ── */
  return (
    <div className="cx-app">
      {topbar}

      {/* Hero */}
      <section className="cx-hero cx-hero-modern">
        <div className="cx-hero-glow" aria-hidden="true" />
        <div className="cx-container cx-hero-inner">
          <div className="cx-hero-badge"><span className="cx-hero-pulse" /> Stok live · {data.loading ? "memuat" : `${data.products.length} listing`} siap kirim</div>
          <div className="cx-kicker">CODEXA ACCESS</div>
          <h1>Akun digital,<br /><em>tanpa drama.</em></h1>
          <p className="cx-hero-sub">Akun siap pakai dari katalog nyata. Detail login hanya dibuka setelah pembayaran berhasil — otomatis, tanpa nunggu admin.</p>
          <div className="cx-hero-actions">
            <button className="cx-btn cx-btn-primary" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
              Lihat katalog <ArrowRight size={13} />
            </button>
            <button className="cx-btn cx-btn-ghost" onClick={() => navigate("help")}>
              Cara beli
            </button>
          </div>
          <div className="cx-hero-metrics">
            <div><strong>{data.loading ? "—" : data.products.reduce((a, x) => a + (Number(x.stock) || 0), 0)}</strong><small>Akun tersedia</small></div>
            <div><strong>&lt; 1 mnt</strong><small>Rata-rata pengiriman</small></div>
            <div><strong>24/7</strong><small>Bantuan admin</small></div>
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
      {tabbar}
      {overlays}
    </div>
  );
}

/* ═══════════════════════════════════════════════════

   ORDER RESULT / PESANAN SAYA
════════════════════════════════════════════════════ */
function OrderItems({ items, onNotice }) {
  const [shown, setShown] = useState({});
  const copy = (value, label) => {
    if (navigator.clipboard) navigator.clipboard.writeText(value).then(() => onNotice(`${label} disalin`)).catch(() => {});
  };
  if (!Array.isArray(items) || !items.length) {
    return <p style={{ color: "var(--muted)", fontSize: 12 }}>Detail akun tidak tersedia.</p>;
  }
  return (
    <div className="cx-order-items">
      {items.map((item, i) => (
        <div key={`${item.listingId}-${i}`} className="cx-order-item">
          <div className="cx-order-item-head">
            <ProviderIcon type={item.loginType} size={16} />
            <strong>{item.title}</strong>
          </div>
          {(item.accounts || []).map((account, k) => {
            const id = `${i}-${k}`;
            const open = !!shown[id];
            return (
              <div key={id} className="cx-order-cred">
                <div className="cx-order-cred-row">
                  <span className="cx-order-cred-label">Email</span>
                  <code>{account.email}</code>
                  <button className="cx-icon-btn" aria-label="Salin email" onClick={() => copy(account.email, "Email")}><Copy size={12} /></button>
                </div>
                <div className="cx-order-cred-row">
                  <span className="cx-order-cred-label">Password</span>
                  <code>{open ? account.password : "•".repeat(Math.min(12, String(account.password || "").length) || 8)}</code>
                  <button className="cx-icon-btn" aria-label="Tampilkan password" onClick={() => setShown((s) => ({ ...s, [id]: !open }))}>
                    {open ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button className="cx-icon-btn" aria-label="Salin password" onClick={() => copy(account.password, "Password")}><Copy size={12} /></button>
                </div>
              </div>
            );
          })}
          {item.deliveryDetails && <ExpandableText className="cx-order-note" text={item.deliveryDetails} />}
        </div>
      ))}
    </div>
  );
}

function OrdersPage({ onBack, onNotice, navigate }) {
  const [state, setState] = useState({ orders: [], loading: true, error: "" });
  const [confirm, confirmDialog] = useConfirmDialog();
  const [isPending, runAction] = usePendingActions();
  const load = () => {
    setState((x) => ({ ...x, loading: true }));
    jsonRequest("/api/orders")
      .then((p) => setState({ orders: p.orders || [], loading: false, error: "" }))
      .catch((e) => setState({ orders: [], loading: false, error: e.message }));
  };
  useEffect(() => { load(); }, []);

  const deleteOrder = async (id) => {
    const ok = await confirm({
      title: "Hapus pesanan ini?",
      description: "Pesanan hilang dari riwayat dan detail akunnya tidak bisa dibuka lagi. Pastikan kamu sudah menyimpan email & password-nya.",
      confirmText: "Ya, hapus",
      danger: true,
    });
    if (!ok) return;
    await runAction(`order-${id}`, async () => {
      try {
        await jsonRequest("/api/orders", { method: "DELETE", body: JSON.stringify({ id }) });
        setState((x) => ({ ...x, orders: x.orders.filter((o) => o.id !== id) }));
        onNotice("Pesanan dihapus dari riwayat");
      } catch (e) { onNotice(e.message); }
    });
  };

  return (
    <div className="cx-orders-page cx-container">
      <button className="cx-back-link" onClick={onBack}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali</button>
      <header className="cx-orders-hero">
        <span className="cx-orders-kicker">Riwayat pembelian</span>
        <h1>Pesanan Saya</h1>
        <p>Semua akun yang sudah kamu bayar tersimpan aman di sini.</p>
        {!state.loading && !state.error && state.orders.length > 0 && (
          <div className="cx-orders-stats">
            <div><small>Total pesanan</small><strong>{state.orders.length}</strong></div>
            <div><small>Akun dibeli</small><strong>{state.orders.reduce((a, o) => a + (Number(o.itemCount) || 0), 0)}</strong></div>
            <div><small>Total belanja</small><strong>{formatPrice(state.orders.reduce((a, o) => a + (Number(o.total) || 0), 0))}</strong></div>
          </div>
        )}
      </header>
      {state.loading && (
        <div className="cx-orders-skeleton">
          <span /><span /><span />
        </div>
      )}
      {state.error && <p className="cx-field-error">{state.error}</p>}
      {!state.loading && !state.error && state.orders.length === 0 && (
        <div className="cx-empty"><Package size={24} /><h3>Belum ada pesanan</h3><p>Beli akun dari katalog untuk mulai.</p>
          <button className="cx-btn cx-btn-primary" onClick={() => navigate("store")}>Lihat katalog</button>
        </div>
      )}
      {state.orders.map((order) => (
        <article key={order.id} className="cx-order-card">
          <div className="cx-order-card-head">
            <div className="cx-order-card-id">
              <span className="cx-order-icon"><Package size={16} /></span>
              <div>
                <strong>{formatPrice(order.total)}</strong>
                <small>{order.itemCount} akun · {formatDate(order.createdAt)}</small>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`cx-order-status${order.status === "paid" ? " is-paid" : ""}`}>
                <BadgeCheck size={12} /> {order.status === "paid" ? "Lunas" : order.status}
              </span>
              <button className="cx-row-btn danger" onClick={() => deleteOrder(order.id)} aria-label="Hapus pesanan" disabled={isPending(`order-${order.id}`)}>
                {isPending(`order-${order.id}`) ? <Spinner /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
          <OrderItems items={order.items} onNotice={onNotice} />
        </article>
      ))}
      {confirmDialog}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STORE TOPBAR
════════════════════════════════════════════════════ */

function timeAgo(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} hari lalu`;
  return new Date(then).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const NOTIF_TONE = {
  admin: { icon: Bell, color: "var(--indigo2)" },
  topup_pending: { icon: Clock, color: "var(--amber)" },
  topup_approved: { icon: BadgeCheck, color: "var(--green)" },
  topup_rejected: { icon: X, color: "var(--red)" },
  order_paid: { icon: ShoppingBag, color: "#818cf8" },
};

/* Lonceng notifikasi: polling ringan tiap 30 detik + refresh saat dibuka. */
function NotificationBell({ navigate, activePage }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const p = await jsonRequest("/api/notifications");
      setItems(p.notifications || []);
      setUnread(Number(p.unread) || 0);
    } catch (_) { /* diam saja, lonceng tidak boleh merusak halaman */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("codexa:notify", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("codexa:notify", onFocus);
    };
  }, []);

  // Panel notifikasi ikut tertutup begitu user pindah menu.
  useEffect(() => { setOpen(false); }, [activePage]);

  // Esc juga menutup panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = () => { const next = !open; setOpen(next); if (next) load(); };

  const markAll = async () => {
    try { await jsonRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({}) }); } catch (_) {}
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openItem = async (n) => {
    if (!n.read) {
      try { await jsonRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({ id: n.id }) }); } catch (_) {}
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    // Isi pesan dibuka penuh dulu lewat overlay, bukan langsung pindah halaman.
    setOpen(false);
    setDetail(n);
  };

  const clearAll = async () => {
    try { await jsonRequest("/api/notifications", { method: "DELETE", body: JSON.stringify({}) }); } catch (_) {}
    setItems([]); setUnread(0);
  };

  return (
    <div className="cx-notif">
      <button className="cx-notif-trigger" onClick={toggle} aria-label="Notifikasi">
        <Bell size={14} />
        {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && (
        <>
          <div className="cx-account-overlay" onClick={() => setOpen(false)} />
          <div className="cx-notif-dropdown">
            <div className="cx-notif-head">
              <strong>Notifikasi</strong>
              <div className="cx-notif-head-actions">
                {unread > 0 && <button onClick={markAll}>Tandai dibaca</button>}
                {items.length > 0 && <button onClick={clearAll}>Hapus</button>}
              </div>
            </div>
            <div className="cx-notif-list">
              {loading && !items.length && <div className="cx-notif-empty">Memuat...</div>}
              {!loading && !items.length && (
                <div className="cx-notif-empty">Belum ada notifikasi. Aktivitas top up & pembelian akan muncul di sini.</div>
              )}
              {items.map((n) => {
                const tone = NOTIF_TONE[n.type] || { icon: Bell, color: "var(--muted)" };
                const ToneIcon = tone.icon;
                return (
                  <button key={n.id} className={`cx-notif-item${n.read ? "" : " is-unread"}`} onClick={() => openItem(n)}>
                    <span className="cx-notif-icon" style={{ color: tone.color }}><ToneIcon size={14} /></span>
                    <span className="cx-notif-copy">
                      <strong>{n.title}</strong>
                      <small>{n.body}</small>
                      <em>{timeAgo(n.createdAt)}</em>
                    </span>
                    {!n.read && <span className="cx-notif-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {detail && (
        <div className="cx-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="cx-modal cx-notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cx-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {(() => {
                  const tone = NOTIF_TONE[detail.type] || { icon: Bell, color: "var(--muted)" };
                  const ToneIcon = tone.icon;
                  return <span className="cx-notif-icon" style={{ color: tone.color }}><ToneIcon size={16} /></span>;
                })()}
                <h3 style={{ margin: 0, minWidth: 0 }}>{detail.title}</h3>
              </div>
              <button className="cx-icon-btn" onClick={() => setDetail(null)} aria-label="Tutup"><X size={14} /></button>
            </div>
            <div className="cx-notif-modal-body">
              <p>{detail.body}</p>
              <span className="cx-notif-modal-time"><Clock size={11} /> {timeAgo(detail.createdAt)}</span>
            </div>
            <div className="cx-modal-footer">
              {detail.link && (
                <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => { const link = detail.link; setDetail(null); navigate(link); }}>
                  Buka halaman <ArrowRight size={12} />
                </button>
              )}
              <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setDetail(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreTopbar({ activePage, navigate, cart, onCartOpen, user, menuOpen, setMenuOpen, onLogout }) {
  const accountRef = useRef(null);
  // Klik/tap di mana pun di luar kartu profil harus menutup menunya.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown, true); window.removeEventListener("keydown", onKey); };
  }, [menuOpen, setMenuOpen]);

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
          <button
            className={`cx-custom-email-nav${activePage === "custom-email" ? " active" : ""}`}
            title="Cek dan buat request email/username custom"
            onClick={() => navigate("custom-email")}
          >
            Custom Email
          </button>
        </nav>
        <div className="cx-topbar-actions">
          <NotificationBell navigate={navigate} activePage={activePage} />
          <button className="cx-cart-btn" onClick={onCartOpen}>
            <ShoppingBag size={13} />
            {cart.length > 0 && <b>{cart.length}</b>}
            <span className="cx-cart-label">Keranjang</span>
          </button>
          <div className="cx-account-menu" ref={accountRef}>
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
                      <strong>
                        {user && user.name}
                        <span className={`cx-role-tag${user && user.role === "admin" ? "" : " is-user"}`}>
                          {user && user.role === "admin" ? "Admin" : "User"}
                        </span>
                      </strong>
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

function CustomEmailPage({ value, setValue, check, onBack, onUse }) {
  return (
    <main className="cx-page cx-custom-page">
      <div className="cx-container">
        <button className="cx-back-link" onClick={onBack}>
          <ArrowRight size={12} style={{ transform: "rotate(180deg)" }} /> Kembali ke Store
        </button>
        <div className="cx-panel" style={{ marginTop: 14 }}>
          <div className="cx-panel-header">
            <h3><Mail size={14} /> Custom Email</h3>
            <span className="cx-panel-sub">Cek dulu nama email/username yang kamu mau</span>
          </div>
          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              Kalau tersedia, nama ini otomatis dipakai sebagai permintaan email khusus saat kamu checkout di keranjang.
            </p>
            <div className={`cx-input-wrap cx-custom-email-input is-${check.state}`}>
              <Mail size={13} />
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="contoh: namaku99 atau namaku99@gmail.com"
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <small className={`cx-custom-email-msg is-${check.state}`}>
              {check.message || "Masukkan minimal 3 karakter untuk mengecek ketersediaan."}
            </small>
            <button
              className="cx-btn cx-btn-primary"
              disabled={check.state !== "available"}
              onClick={onUse}
            >
              <BadgeCheck size={13} /> Pakai nama ini
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════
   MOBILE TAB BAR (bottom nav)
════════════════════════════════════════════════════ */
function MobileTabBar({ activePage, navigate, cart, onCartOpen, cartOpen }) {
  const items = [
    { key: "store",  label: "Store",    Icon: Package },
    { key: "orders", label: "Pesanan",  Icon: BadgeCheck },
    { key: "cart",   label: "Keranjang",Icon: ShoppingBag },
    { key: "custom-email", label: "Email", Icon: Mail },
    { key: "help",   label: "Bantuan",  Icon: CircleHelp },
    { key: "account",label: "Akun",     Icon: User },
  ];
  return (
    <nav className="cx-tabbar" aria-label="Navigasi utama">
      {items.map(({ key, label, Icon }) => {
        const active = key === "cart" ? !!cartOpen : (activePage === key && !cartOpen);
        return (
          <button
            key={key}
            className={`cx-tabbar-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => (key === "cart" ? onCartOpen() : navigate(key))}
          >
            <span className="cx-tabbar-icon">
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              {key === "cart" && cart.length > 0 && <b>{cart.length}</b>}
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════
   STORE FOOTER
════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   HELP PAGE
════════════════════════════════════════════════════ */
const HELP_STEPS = [
  { title: "Isi saldo", body: "Buka menu Top Up, pilih nominal, lalu unggah bukti transfer. Saldo masuk setelah admin verifikasi." },
  { title: "Pilih akun", body: "Di halaman Toko, buka produk lalu centang akun yang mau dibeli. Harga total muncul otomatis." },
  { title: "Bayar pakai saldo", body: "Klik Beli sekarang. Saldo langsung terpotong sesuai total akun yang dipilih." },
  { title: "Ambil detail akun", body: "Email dan password akun tampil di menu Pesanan, bisa disalin kapan saja." },
];

const HELP_FAQ = [
  { q: "Berapa lama top up diproses?", a: "Umumnya di bawah 1x24 jam pada jam kerja. Status top up bisa dipantau di menu Top Up." },
  { q: "Akun yang saya beli bermasalah, bagaimana?", a: "Buka Assisten CodeXa dan laporkan kendalanya. Laporan tersimpan dan dibalas admin lewat notifikasi." },
  { q: "Bisa refund saldo?", a: "Saldo yang sudah masuk dipakai untuk pembelian akun. Untuk kasus akun gagal dipakai, admin akan mengganti akun atau mengembalikan saldo." },
  { q: "Di mana melihat detail akun saya?", a: "Menu Pesanan menyimpan semua pembelian beserta kredensial akunnya." },
  { q: "Kenapa notifikasi tidak muncul?", a: "Tarik ulang halaman atau buka lonceng notifikasi di kanan atas. Pesan dari admin masuk ke situ." },
];

function HelpPage({ navigate, onAskAssistant }) {
  const [openFaq, setOpenFaq] = useState(0);
  return (
    <main className="cx-help">
      <div className="cx-container">
        <button className="cx-back-link" onClick={() => navigate("store")}>
          <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali
        </button>

        <section className="cx-help-hero">
          <span className="cx-help-badge"><CircleHelp size={12} /> Pusat Bantuan</span>
          <h1>Ada yang bisa kami bantu?</h1>
          <p>Panduan singkat memakai CodeXa, mulai dari isi saldo sampai mengambil detail akun.</p>
          <div className="cx-help-cta">
            <button className="cx-btn cx-btn-primary" onClick={onAskAssistant}>
              <Sparkles size={13} /> Tanya Assisten
            </button>
            <button className="cx-btn cx-btn-ghost" onClick={() => navigate("orders")}>
              <Package size={13} /> Cek pesanan
            </button>
          </div>
        </section>

        <section className="cx-help-quick">
          {[
            { icon: Wallet, label: "Top Up saldo", desc: "Isi saldo & pantau status", page: "topup" },
            { icon: ShoppingBag, label: "Belanja akun", desc: "Lihat katalog & stok", page: "store" },
            { icon: Package, label: "Pesanan saya", desc: "Detail akun yang dibeli", page: "orders" },
            { icon: User, label: "Akun saya", desc: "Profil & keamanan", page: "account" },
          ].map((item) => (
            <button key={item.page} className="cx-help-quick-card" onClick={() => navigate(item.page)}>
              <span className="cx-help-quick-icon"><item.icon size={15} /></span>
              <span className="cx-help-quick-text">
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </span>
              <ArrowUpRight size={14} className="cx-help-quick-arrow" />
            </button>
          ))}
        </section>

        <section className="cx-help-section">
          <h2>Cara belanja di CodeXa</h2>
          <ol className="cx-help-steps">
            {HELP_STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="cx-help-step-no">{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="cx-help-section">
          <h2>Pertanyaan umum</h2>
          <div className="cx-help-faq">
            {HELP_FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div className={`cx-help-faq-item${open ? " is-open" : ""}`} key={item.q}>
                  <button onClick={() => setOpenFaq(open ? -1 : i)} aria-expanded={open}>
                    <span>{item.q}</span>
                    <ChevronDown size={15} />
                  </button>
                  {open && <p>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="cx-help-contact">
          <div>
            <strong>Masih belum terjawab?</strong>
            <p>Kirim keluhanmu lewat Assisten CodeXa. Laporan langsung masuk ke admin dan balasannya dikirim sebagai notifikasi.</p>
          </div>
          <button className="cx-btn cx-btn-primary" onClick={onAskAssistant}>
            <Send size={13} /> Kirim laporan
          </button>
        </section>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════
   HALAMAN LEGAL (Syarat, Privasi, Refund)
════════════════════════════════════════════════════ */
const LEGAL_CONTENT = {
  terms: {
    kicker: "Dokumen resmi",
    title: "Syarat & Ketentuan",
    intro: "Dengan mendaftar dan bertransaksi di CodeXa Store, kamu dianggap sudah membaca dan menyetujui ketentuan di bawah ini.",
    sections: [
      { h: "1. Ketentuan akun pembeli", p: [
        "Satu orang hanya boleh memakai satu akun CodeXa. Data yang didaftarkan wajib benar dan aktif, terutama email dan nomor WhatsApp.",
        "Keamanan password akun CodeXa sepenuhnya tanggung jawab pemilik akun. Segala aktivitas yang terjadi setelah login dianggap dilakukan oleh pemilik akun.",
        "CodeXa berhak menangguhkan atau memblokir akun yang terindikasi melakukan penipuan, chargeback, spam pembelian, atau menyalahgunakan sistem saldo.",
      ] },
      { h: "2. Saldo dan pembayaran", p: [
        "Seluruh pembelian di CodeXa memakai saldo. Saldo diisi lewat menu Top Up dan baru masuk setelah admin memverifikasi bukti pembayaran.",
        "Permintaan top up diproses pada jam operasional. Nominal yang masuk mengikuti jumlah yang benar-benar diterima admin.",
        "Saldo yang sudah masuk tidak dapat dicairkan kembali menjadi uang tunai dan hanya bisa dipakai untuk transaksi di CodeXa Store.",
      ] },
      { h: "3. Produk akun digital", p: [
        "Produk yang dijual adalah akun digital dengan stok terbatas. Stok yang ditampilkan adalah stok nyata dari database, bukan contoh.",
        "Detail login (email dan password) hanya terbuka setelah pembayaran berhasil dan dapat dilihat kapan saja di halaman Pesanan.",
        "Pembeli wajib segera mengganti password akun yang dibeli setelah menerima detail login.",
      ] },
      { h: "4. Larangan", p: [
        "Dilarang menjual ulang akun dengan klaim garansi atas nama CodeXa tanpa izin tertulis.",
        "Dilarang memakai akun yang dibeli untuk aktivitas ilegal, penipuan, atau tindakan yang melanggar ketentuan penyedia layanan asal.",
      ] },
      { h: "5. Perubahan ketentuan", p: [
        "CodeXa dapat memperbarui syarat dan ketentuan ini sewaktu-waktu. Versi terbaru yang tayang di halaman ini adalah versi yang berlaku.",
      ] },
    ],
  },
  privacy: {
    kicker: "Dokumen resmi",
    title: "Kebijakan Privasi",
    intro: "Kami hanya mengumpulkan data yang benar-benar dibutuhkan untuk menjalankan transaksi dan menjaga keamanan akun kamu.",
    sections: [
      { h: "1. Data yang kami kumpulkan", p: [
        "Data akun: nama, email, dan nomor WhatsApp (opsional) yang kamu isi saat mendaftar.",
        "Data transaksi: riwayat top up, riwayat pesanan, nominal, metode pembayaran, dan catatan yang kamu kirim ke admin.",
        "Data teknis dasar yang diperlukan agar sesi login tetap aman.",
      ] },
      { h: "2. Cara kami memakai data", p: [
        "Memproses pembelian, verifikasi top up, dan pengiriman detail akun.",
        "Mengirim notifikasi terkait status pesanan dan saldo di dalam aplikasi.",
        "Mendeteksi penyalahgunaan, penipuan, dan aktivitas mencurigakan.",
      ] },
      { h: "3. Keamanan data", p: [
        "Password akun CodeXa disimpan dalam bentuk hash, bukan teks biasa.",
        "Kredensial akun yang dijual disimpan dalam bentuk terenkripsi dan hanya terbuka untuk pembeli sah setelah pembayaran.",
        "Akses admin dilindungi sesi terpisah dan tidak dibagikan ke pihak ketiga.",
      ] },
      { h: "4. Berbagi data", p: [
        "Kami tidak menjual maupun menyewakan data pribadi kamu ke pihak mana pun.",
        "Data hanya dibagikan bila diwajibkan oleh hukum yang berlaku.",
      ] },
      { h: "5. Hak kamu", p: [
        "Kamu bisa meminta perubahan atau penghapusan data akun kapan saja lewat menu Bantuan atau kontak admin.",
        "Penghapusan akun akan menghapus riwayat top up dan pesanan yang terkait secara permanen.",
      ] },
    ],
  },
  refund: {
    kicker: "Dokumen resmi",
    title: "Kebijakan Refund",
    intro: "Kami ingin transaksi berjalan adil untuk semua pihak. Berikut aturan pengembalian dana yang berlaku.",
    sections: [
      { h: "1. Refund yang disetujui", p: [
        "Akun yang dibeli tidak bisa dipakai sama sekali sejak awal (salah kredensial) dan dilaporkan maksimal 1x24 jam setelah pembelian.",
        "Terjadi kesalahan sistem sehingga saldo terpotong tetapi detail akun tidak diterima.",
      ] },
      { h: "2. Refund yang ditolak", p: [
        "Password akun sudah diganti oleh pembeli lalu terjadi masalah setelahnya.",
        "Pembeli salah membeli produk karena tidak membaca deskripsi.",
        "Laporan dikirim lewat dari batas waktu klaim.",
      ] },
      { h: "3. Bentuk pengembalian", p: [
        "Refund yang disetujui dikembalikan dalam bentuk saldo CodeXa, bukan uang tunai.",
        "Proses peninjauan maksimal 2x24 jam sejak laporan lengkap diterima admin.",
      ] },
    ],
  },
  disclaimer: {
    kicker: "Dokumen resmi",
    title: "Disclaimer",
    intro: "Batasan tanggung jawab CodeXa atas produk digital dan layanan yang dijual di platform ini.",
    sections: [
      { h: "1. Status platform", p: [
        "CodeXa adalah toko digital independen yang menjual akun dan lisensi layanan pihak ketiga. Kami tidak berafiliasi, tidak disponsori, dan tidak mewakili merek mana pun yang produknya tercantum di katalog.",
        "Seluruh nama merek, logo, dan tanda dagang adalah milik pemiliknya masing-masing dan hanya dipakai sebagai keterangan produk.",
      ] },
      { h: "2. Ketersediaan layanan", p: [
        "Stok, harga, dan masa aktif produk dapat berubah sewaktu-waktu mengikuti kebijakan penyedia layanan aslinya.",
        "Kami berusaha menjaga situs tetap online, namun tidak menjamin layanan bebas gangguan, pemeliharaan, atau kendala pada penyedia pihak ketiga.",
      ] },
      { h: "3. Tanggung jawab pengguna", p: [
        "Pembeli bertanggung jawab menjaga kerahasiaan detail akun yang diterima dan tidak membagikannya ke pihak lain.",
        "Penyalahgunaan akun, pelanggaran ketentuan penyedia layanan, atau perubahan kredensial oleh pembeli berada di luar tanggung jawab CodeXa.",
      ] },
      { h: "4. Batasan ganti rugi", p: [
        "Tanggung jawab maksimum CodeXa atas satu transaksi terbatas pada nilai saldo yang dibayarkan untuk transaksi tersebut.",
        "Kami tidak bertanggung jawab atas kerugian tidak langsung seperti kehilangan data, kehilangan pendapatan, atau gangguan pekerjaan.",
      ] },
      { h: "5. Konten informasi", p: [
        "Deskripsi produk, panduan, dan jawaban asisten di situs ini bersifat informatif dan dapat berubah tanpa pemberitahuan.",
        "Untuk keputusan penting, konfirmasikan terlebih dahulu ke admin lewat halaman Bantuan.",
      ] },
    ],
  },
};

function LegalPage({ kind, onBack, navigate }) {
  const doc = LEGAL_CONTENT[kind] || LEGAL_CONTENT.terms;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [kind]);
  return (
    <div className="cx-legal-page cx-container">
      <button className="cx-back-link" onClick={onBack}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Kembali</button>
      <header className="cx-legal-hero">
        <span className="cx-orders-kicker">{doc.kicker}</span>
        <h1>{doc.title}</h1>
        <p>{doc.intro}</p>
        <small>Terakhir diperbarui: {formatDate(new Date())}</small>
      </header>
      <div className="cx-legal-tabs">
        {[["terms", "Syarat & Ketentuan"], ["privacy", "Kebijakan Privasi"], ["refund", "Kebijakan Refund"], ["disclaimer", "Disclaimer"]].map(([id, label]) => (
          <button key={id} className={kind === id ? "active" : ""} onClick={() => navigate(id)}>{label}</button>
        ))}
      </div>
      <article className="cx-legal-body">
        {doc.sections.map((sec) => (
          <section key={sec.h}>
            <h2>{sec.h}</h2>
            {sec.p.map((line, i) => <p key={i}>{line}</p>)}
          </section>
        ))}
        <div className="cx-legal-contact">
          <FileText size={14} />
          <div>
            <strong>Ada yang belum jelas?</strong>
            <p>Hubungi admin lewat halaman Bantuan, kami balas di jam operasional.</p>
          </div>
          <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={() => navigate("help")}>Buka Bantuan</button>
        </div>
      </article>
    </div>
  );
}

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
          <button onClick={() => navigate("terms")}>Syarat &amp; Ketentuan</button>
          <button onClick={() => navigate("privacy")}>Kebijakan Privasi</button>
          <button onClick={() => navigate("refund")}>Kebijakan Refund</button>
          <button onClick={() => navigate("disclaimer")}>Disclaimer</button>
        </div>
        <p className="cx-footer-copy">© {new Date().getFullYear()} CodeXa Store. Seluruh transaksi tunduk pada Syarat &amp; Ketentuan.</p>
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
        <ExpandableText
          className="cx-product-desc"
          lines={3}
          limit={120}
          text={product.description || "Akun digital siap digunakan. Detail dikirim setelah pembayaran."}
        />
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
          <button className="cx-product-buy" disabled={selected.length === 0} onClick={() => onBuy(selected)} aria-label={`Beli ${product.title}`}><span>{selected.length ? "Beli sekarang" : "Pilih akun"}</span><ArrowRight size={15} /></button>
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
  const [navOpen, setNavOpen]             = useState(false);
  const [asstOpen, setAsstOpen]           = useState(false);
  const [topups, setTopups]               = useState([]);
  const [users, setUsers]                 = useState([]);
  const [userQuery, setUserQuery]         = useState("");
  const [userPage, setUserPage]           = useState(1);
  const [userForm, setUserForm]           = useState(null);
  const [savingUser, setSavingUser]       = useState(false);
  const [aiCfg, setAiCfg]                 = useState(null);
  const [aiForm, setAiForm]               = useState(null);
  const [savingAi, setSavingAi]           = useState(false);
  const [aiNotice, setAiNotice]           = useState("");
  const [aiError, setAiError]             = useState("");
  const [testingAi, setTestingAi]         = useState(false);
  const [orders, setOrders]               = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [headerMenu, setHeaderMenu]       = useState("");
  const [confirm, confirmDialog]          = useConfirmDialog();
  const [isPending, runAction]            = usePendingActions();
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("codexa.admin.alerts.dismissed") || "[]"); }
    catch (_) { return []; }
  });
  const contentRef = useRef(null);

  const persistDismissed = (list) => {
    setDismissedAlerts(list);
    try { localStorage.setItem("codexa.admin.alerts.dismissed", JSON.stringify(list)); } catch (_) {}
  };
  const dismissAlert = (key) => { persistDismissed([...new Set([...dismissedAlerts, key])]); onNotice("Notifikasi dihapus"); };

  // Pindah menu = konten selalu mulai dari atas, tidak menggantung di tengah.
  const goNav = (label) => {
    setActiveNav(label);
    setNavOpen(false);
    if (label === "Pengguna") setUserQuery("");
  };

  const loadSettings = () =>
    jsonRequest("/api/admin/settings", { method: "GET" })
      .then((p) => {
        setAiCfg(p.assistant);
        setAiForm({
          enabled: p.assistant.enabled !== false,
          apiKey: "",
          baseUrl: p.assistant.baseUrl || "",
          modelAdmin: p.assistant.modelAdmin || "",
          modelUser: p.assistant.modelUser || "",
          maxSteps: String(p.assistant.maxSteps ?? 6),
          temperature: String(p.assistant.temperature ?? 0.3),
          extraPrompt: p.assistant.extraPrompt || "",
        });
      })
      .catch((e) => setAiError(e.message));

  const updateAiForm = (key, val) => setAiForm((f) => ({ ...f, [key]: val }));

  const saveSettings = async () => {
    setSavingAi(true); setAiError(""); setAiNotice("");
    try {
      const payload = {
        enabled: aiForm.enabled,
        baseUrl: aiForm.baseUrl,
        modelAdmin: aiForm.modelAdmin,
        modelUser: aiForm.modelUser,
        maxSteps: Number(aiForm.maxSteps) || 6,
        temperature: Number(aiForm.temperature),
      };
      payload.extraPrompt = aiForm.extraPrompt;
      if (aiForm.apiKey.trim()) payload.apiKey = aiForm.apiKey.trim();
      const p = await jsonRequest("/api/admin/settings", { method: "PATCH", body: JSON.stringify(payload) });
      setAiCfg(p.assistant);
      setAiForm((f) => ({ ...f, apiKey: "" }));
      onNotice("Pengaturan Assisten disimpan");
    } catch (e) { setAiError(e.message); }
    finally { setSavingAi(false); }
  };

  const clearApiKey = async () => {
    const ok = await confirm({
      title: "Hapus API key Assisten?",
      description: "Assisten tidak bisa dipakai sampai kamu memasukkan API key baru.",
      confirmText: "Ya, hapus key", danger: true,
    });
    if (!ok) return;
    setSavingAi(true); setAiError(""); setAiNotice("");
    try {
      const p = await jsonRequest("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ apiKey: "__CLEAR__" }) });
      setAiCfg(p.assistant); onNotice("API key dihapus");
    } catch (e) { setAiError(e.message); }
    finally { setSavingAi(false); }
  };

  const testAssistant = async () => {
    setTestingAi(true); setAiError(""); setAiNotice("");
    try {
      const p = await jsonRequest("/api/admin/settings", { method: "POST", body: JSON.stringify({}) });
      setAiNotice(`${p.message} (model ${p.model})`);
    } catch (e) { setAiError(e.message); }
    finally { setTestingAi(false); }
  };

  const setUserRole = async (id, role) => {
    try {
      await jsonRequest("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id, action: role === "admin" ? "promote" : "demote" }),
      });
      loadUsersData();
      onNotice(role === "admin" ? "User dijadikan admin" : "Akses admin dicabut");
    } catch (e) { setApiError(e.message); }
  };

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
      balance: String(u.balance ?? 0), status: u.status || "active", role: u.role === "admin" ? "admin" : "user",
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
    const ok = await confirm({
      title: "Hapus akun pengguna ini?",
      description: "Semua riwayat top up dan pesanan milik akun ini ikut terhapus permanen.",
      detail: `${u.name || "Tanpa nama"} · ${u.email}`,
      confirmText: "Ya, hapus akun", danger: true,
    });
    if (!ok) return;
    await runAction(`user-del-${u.id}`, async () => {
      try {
        await jsonRequest("/api/admin/users", { method: "DELETE", body: JSON.stringify({ id: u.id }) });
        await loadUsersData(); onNotice("User dihapus");
      } catch (e) { setApiError(e.message); }
    });
  };

  const reviewTopup = async (id, action, info) => {
    const approve = action === "approve";
    const ok = await confirm({
      title: approve ? "Setujui permintaan top up?" : "Tolak permintaan top up?",
      description: approve
        ? "Saldo pengguna langsung bertambah dan notifikasi terkirim ke akunnya."
        : "Pengguna akan menerima notifikasi bahwa permintaannya ditolak.",
      detail: info,
      confirmText: approve ? "Ya, setujui" : "Ya, tolak",
      danger: !approve,
    });
    if (!ok) return;
    await runAction(`topup-${id}`, async () => {
      try {
        await jsonRequest("/api/admin/topups", { method: "PATCH", body: JSON.stringify({ id, action }) });
        onNotice(approve ? "Top up disetujui, saldo user bertambah" : "Top up ditolak");
        await loadUsersData();
      } catch (e) { setApiError(e.message); }
    });
  };

  const checkAuth = () =>
    jsonRequest("/api/admin/login", { method: "GET" })
      .then((p) => { setAuthenticated(p.authenticated); if (p.authenticated) { loadListings(); loadUsersData(); loadSettings(); loadOrders(); } })
      .catch(() => setAuthenticated(false));

  useEffect(() => { checkAuth(); }, []);

  const loadListings = () => {
    setLoading(true); setApiError("");
    return jsonRequest("/api/admin/products", { method: "GET" })
      .then((p) => setListings(p.products || []))
      .catch((e) => setApiError(e.message))
      .finally(() => setLoading(false));
  };

  const loadOrders = () => {
    setOrdersLoading(true);
    return jsonRequest("/api/orders?scope=admin", { method: "GET" })
      .then((p) => setOrders(p.orders || []))
      .catch((e) => setApiError(e.message))
      .finally(() => setOrdersLoading(false));
  };

  // Satu tombol refresh untuk semua data panel supaya indikator putar akurat.
  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.all([loadListings(), loadUsersData(), loadOrders()]); }
    finally { setRefreshing(false); }
  };

  const deleteAdminOrder = async (id) => {
    const ok = await confirm({
      title: "Hapus pesanan ini?",
      description: "Pesanan dihapus dari riwayat admin dan pembeli. Tindakan ini tidak bisa dibatalkan.",
      detail: `#${String(id).slice(0, 8)}`,
      confirmText: "Ya, hapus", danger: true,
    });
    if (!ok) return;
    await runAction(`aorder-${id}`, async () => {
      try {
        await jsonRequest("/api/orders?scope=admin", { method: "DELETE", body: JSON.stringify({ id }) });
        setOrders((list) => list.filter((o) => o.id !== id));
        onNotice("Pesanan dihapus");
      } catch (e) { setApiError(e.message); }
    });
  };

  const deleteTopup = async (id) => {
    const ok = await confirm({
      title: "Hapus permintaan top up ini?",
      description: "Catatan permintaan ini hilang dari riwayat admin.",
      confirmText: "Ya, hapus", danger: true,
    });
    if (!ok) return;
    await runAction(`topup-del-${id}`, async () => {
      try {
        await jsonRequest("/api/admin/topups", { method: "DELETE", body: JSON.stringify({ id }) });
        setTopups((list) => list.filter((t) => t.id !== id));
        onNotice("Permintaan top up dihapus");
      } catch (e) { setApiError(e.message); }
    });
  };

  const clearTopupHistory = async () => {
    const done = topups.filter((t) => t.status !== "pending").length;
    const ok = await confirm({
      title: "Bersihkan riwayat top up?",
      description: "Semua permintaan yang sudah disetujui atau ditolak akan dihapus. Permintaan yang masih menunggu tetap aman.",
      detail: `${done} riwayat akan dihapus`,
      confirmText: "Ya, bersihkan", danger: true,
    });
    if (!ok) return;
    await runAction("topup-clear", async () => {
      try {
        await jsonRequest("/api/admin/topups", { method: "DELETE", body: JSON.stringify({ scope: "resolved" }) });
        setTopups((list) => list.filter((t) => t.status === "pending"));
        onNotice("Riwayat top up dibersihkan");
      } catch (e) { setApiError(e.message); }
    });
  };

  const login = async (e) => {
    e.preventDefault(); setLoginError("");
    try { await jsonRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); setAuthenticated(true); setPassword(""); loadListings(); loadUsersData(); loadSettings(); loadOrders(); }
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

  const deleteListing = async (listing) => {
    const id = typeof listing === "string" ? listing : listing.id;
    const ok = await confirm({
      title: "Hapus produk ini?",
      description: "Listing beserta seluruh akun yang belum terjual di dalamnya akan dihapus permanen.",
      detail: typeof listing === "string" ? `#${String(id).slice(0, 8)}` : `${listing.title} · stok ${listing.stock} akun`,
      confirmText: "Ya, hapus produk", danger: true,
    });
    if (!ok) return;
    await runAction(`prod-${id}`, async () => {
      try {
        await jsonRequest("/api/admin/products", { method: "DELETE", body: JSON.stringify({ id }) });
        await loadListings(); onNotice("Produk dihapus");
      } catch (e) { setApiError(e.message); }
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? listings.filter((l) => `${l.title} ${l.loginType}`.toLowerCase().includes(q)) : listings;
  }, [listings, search]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return q ? users.filter((u) => `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)) : users;
  }, [users, userQuery]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => `${o.buyer.name} ${o.buyer.email} ${o.id} ${(o.items || []).map((i) => i.title).join(" ")}`.toLowerCase().includes(q));
  }, [orders, search]);

  const pendingTopups = topups.filter((t) => t.status === "pending").length;

  const adminAlerts = useMemo(() => {
    const list = [];
    if (pendingTopups) list.push({ key: "topup", nav: "Top Up", title: `${pendingTopups} permintaan top up menunggu`, desc: "Butuh persetujuan admin" });
    const low = listings.filter((l) => Number(l.stock) <= 3 && l.status !== "sold");
    if (low.length) list.push({ key: "stock", nav: "Produk", title: `${low.length} produk stok menipis`, desc: low.slice(0, 3).map((l) => l.title).join(", ") });
    const blocked = users.filter((u) => u.status !== "active");
    if (blocked.length) list.push({ key: "user", nav: "Pengguna", title: `${blocked.length} akun tidak aktif`, desc: "Tinjau status pengguna" });
    if (orders.length) list.push({ key: "order", nav: "Pesanan", title: `${orders.length} pesanan tercatat`, desc: "Lihat detail pembeli" });
    return list.filter((a) => !dismissedAlerts.includes(a.key));
  }, [pendingTopups, listings, users, orders, dismissedAlerts]);

  /* Pesanan dikelompokkan per akun pembeli: satu kartu = satu akun,
     transaksinya ditumpuk di dalam kartu itu. */
  const groupedOrders = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((o) => {
      const key = o.buyer.id || o.buyer.email;
      const group = map.get(key) || { buyer: o.buyer, orders: [], total: 0, accounts: 0 };
      group.orders.push(o);
      group.total += Number(o.total) || 0;
      group.accounts += Number(o.itemCount) || 0;
      map.set(key, group);
    });
    return [...map.values()].sort((a, b) => new Date(b.orders[0].createdAt || 0) - new Date(a.orders[0].createdAt || 0));
  }, [filteredOrders]);

  const recentActivity = useMemo(() => {
    const feed = [
      ...orders.slice(0, 5).map((o) => ({
        key: `o-${o.id}`, Icon: ShoppingBag, at: o.createdAt,
        title: `${o.buyer.name} membeli ${o.itemCount} akun`,
        desc: `${formatPrice(o.total)} · ${(o.items || []).map((i) => i.title).join(", ") || "-"}`,
      })),
      ...topups.slice(0, 5).map((t) => ({
        key: `t-${t.id}`, Icon: Wallet, at: t.createdAt,
        title: `Top up ${formatPrice(t.amount)} · ${t.userName}`,
        desc: t.status === "pending" ? "Menunggu review" : t.status === "approved" ? "Disetujui" : "Ditolak",
      })),
      ...listings.slice(0, 5).map((l) => ({
        key: `l-${l.id}`, Icon: Package, at: l.createdAt,
        title: l.title, desc: `${l.loginType} · stok ${l.stock}`,
      })),
    ];
    return feed
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, 8)
      .map((a) => ({ ...a, time: formatDate(a.at) }));
  }, [orders, topups, listings]);

  const USERS_PER_PAGE = 8;
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safeUserPage = Math.min(userPage, userPageCount);
  const pagedUsers = filteredUsers.slice((safeUserPage - 1) * USERS_PER_PAGE, safeUserPage * USERS_PER_PAGE);
  // Reset halaman hanya saat pencarian berubah; refresh data setelah aksi admin
  // tidak boleh menendang admin kembali ke halaman 1.
  useEffect(() => { setUserPage(1); }, [userQuery]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeNav]);

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
    { label: "Pesanan",     shortcut: "⌘O", icon: ShoppingBag,    dot: orders.length > 0 },
    { label: "Pengguna",    shortcut: "⌘U", icon: User,           dot: users.some((u) => u.status !== "active") },
    { label: "Top Up",      shortcut: "⌘T", icon: Wallet,         dot: topups.some((t) => t.status === "pending") },
    { label: "Custom Email",shortcut: "⌘E", icon: Mail,           dot: orders.some((o) => o.customEmail) },
    { label: "Assisten",    shortcut: "⌘I", icon: Sparkles,       dot: !(aiCfg && aiCfg.enabled && aiCfg.hasKey) },
    { label: "Pengaturan",  shortcut: "⌘,", icon: Settings },
  ];

  return (
    <div className={`cx-admin-shell${navOpen ? " nav-open" : ""}`}>
      {navOpen && <div className="cx-sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      {/* ── Sidebar ── */}
      <aside className={`cx-sidebar${navOpen ? " open" : ""}`}>
        <div className="cx-sidebar-brand">
          <span className="cx-brand-mark" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 4 }}>&lt;/&gt;</span>
          <span>CodeXa Store</span>
          <ChevronDown size={12} color="var(--faint)" />
          <button className="cx-sidebar-close" onClick={() => setNavOpen(false)} aria-label="Tutup menu"><X size={14} /></button>
        </div>
        <div className="cx-sidebar-section">Workspace</div>
        <nav>
          {NAV_ITEMS.map(({ label, shortcut, icon: NavIcon, dot }) => (
            <button key={label} className={`cx-sidebar-item ${activeNav === label ? "active" : ""}`} onClick={() => goNav(label)}>
              <NavIcon size={14} strokeWidth={1.7} />
              <span>{label}</span>
              {dot && <span className="cx-sidebar-dot" />}
              <span className="cx-sidebar-shortcut">{shortcut}</span>
            </button>
          ))}
        </nav>
        <div className="cx-sidebar-footer">
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
        {headerMenu && <div className="cx-menu-backdrop" onClick={() => setHeaderMenu("")} />}
        {/* Header */}
        <header className="cx-admin-header">
          <button className="cx-mobile-menu-btn" onClick={() => setNavOpen(true)} aria-label="Buka menu">
            <Menu size={15} />
          </button>
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
          <div className="cx-admin-header-actions" style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className={`cx-admin-asst-btn${asstOpen ? " active" : ""}`}
              onClick={() => setAsstOpen((v) => !v)}
              aria-label="Buka Assisten"
              title="Assisten CodeXa"
            >
              <Sparkles size={13} />
              <span>Assisten</span>
            </button>
            <div className="cx-admin-menu-wrap">
              <button className="cx-icon-btn" aria-label="Bantuan" onClick={() => setHeaderMenu((m) => (m === "help" ? "" : "help"))}><CircleHelp size={13} /></button>
              {headerMenu === "help" && (
                <div className="cx-admin-menu">
                  <div className="cx-admin-menu-title">Bantuan cepat</div>
                  <p>Kelola listing di menu <strong>Produk</strong>, cek transaksi pembeli di <strong>Pesanan</strong>.</p>
                  <p>Setujui saldo pembeli di menu <strong>Top Up</strong>.</p>
                  <p>Butuh bantuan lanjut? Buka <strong>Assisten</strong> di kanan atas.</p>
                </div>
              )}
            </div>
            <div className="cx-admin-menu-wrap">
              <button className="cx-icon-btn" aria-label="Notifikasi" onClick={() => setHeaderMenu((m) => (m === "notif" ? "" : "notif"))} style={{ position: "relative" }}>
                <Bell size={13} />
                {adminAlerts.length > 0 && <span className="cx-admin-badge">{adminAlerts.length}</span>}
              </button>
              {headerMenu === "notif" && (
                <div className="cx-admin-menu">
                  <div className="cx-admin-menu-title">
                    Notifikasi
                    {adminAlerts.length > 0 && (
                      <button
                        type="button"
                        className="cx-menu-clear"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Hapus semua notifikasi?",
                            description: "Daftar notifikasi admin dikosongkan. Notifikasi baru tetap akan muncul lagi kalau ada kejadian baru.",
                            confirmText: "Ya, hapus semua", danger: true,
                          });
                          if (!ok) return;
                          persistDismissed([...new Set([...dismissedAlerts, ...adminAlerts.map((a) => a.key)])]);
                          setHeaderMenu("");
                          onNotice("Semua notifikasi dihapus");
                        }}
                      >
                        <Trash2 size={10} /> Hapus semua
                      </button>
                    )}
                  </div>
                  {adminAlerts.length === 0
                    ? <p>Tidak ada notifikasi baru.</p>
                    : adminAlerts.map((a) => (
                      <div key={a.key} className="cx-admin-menu-row">
                        <button className="cx-admin-menu-item" onClick={() => { goNav(a.nav); setHeaderMenu(""); }}>
                          <strong>{a.title}</strong>
                          <small>{a.desc}</small>
                        </button>
                        <button className="cx-row-btn danger" aria-label="Hapus notifikasi" onClick={() => dismissAlert(a.key)}><Trash2 size={11} /></button>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="cx-admin-menu-wrap">
              <button className="cx-avatar cx-admin-avatar-btn" aria-label="Profil admin" onClick={() => setHeaderMenu((m) => (m === "profile" ? "" : "profile"))}>AR</button>
              {headerMenu === "profile" && (
                <div className="cx-admin-menu">
                  <div className="cx-admin-menu-head">
                    <div className="cx-avatar">AR</div>
                    <div><strong>Admin</strong><small>Owner · CodeXa Store</small></div>
                  </div>
                  <button className="cx-admin-menu-item" onClick={() => { goNav("Pengaturan"); setHeaderMenu(""); }}><Settings size={12} /> Pengaturan</button>
                  <button className="cx-admin-menu-item" onClick={() => { onBack(); setHeaderMenu(""); }}><ShoppingBag size={12} /> Lihat store</button>
                  <button className="cx-admin-menu-item danger" onClick={() => { setHeaderMenu(""); logout(); }}><LogOut size={12} /> Keluar</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Command bar */}
        <div className="cx-cmd-bar">
          <Command size={11} />
          <span>Press <kbd>⌘K</kbd> for commands</span>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace,monospace", color: "var(--faint)", fontSize: 10 }}>v2.4.1</span>
        </div>

        {/* Content */}
        <div className="cx-admin-content" ref={contentRef}>
          {activeNav === "Assisten" ? (
            <>
              <div className="cx-admin-top">
                <div>
                  <div className="cx-admin-date">Konfigurasi AI</div>
                  <h1>Assisten</h1>
                </div>
                <div className="cx-admin-actions">
                  <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={loadSettings}><RefreshCw size={11} /> Refresh</button>
                  <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={testAssistant} disabled={testingAi || !aiCfg?.hasKey}>
                    <Sparkles size={11} /> {testingAi ? "Menguji..." : "Tes Koneksi"}
                  </button>
                </div>
              </div>

              <div className="cx-stat-grid">
                {[
                  { label: "Status", value: aiCfg ? (aiCfg.enabled ? (aiCfg.hasKey ? "Aktif" : "Belum ada key") : "Dimatikan") : "—", delta: aiCfg?.hasKey ? "siap dipakai" : "isi API key dulu", up: Boolean(aiCfg?.enabled && aiCfg?.hasKey) },
                  { label: "API Key", value: aiCfg?.keyPreview || "kosong", delta: aiCfg?.keySource === "panel" ? "dari admin panel" : aiCfg?.keySource === "env" ? "dari env Vercel" : "belum diatur", up: Boolean(aiCfg?.hasKey) },
                  { label: "Model Admin", value: aiCfg?.modelAdmin || "—", delta: "akses penuh", up: true },
                  { label: "Model User", value: aiCfg?.modelUser || "—", delta: "data sendiri saja", up: true },
                ].map(({ label, value, delta, up }) => (
                  <div key={label} className="cx-stat-card">
                    <span className="cx-stat-label">{label}</span>
                    <strong className="cx-stat-value" style={{ fontSize: 15, wordBreak: "break-all" }}>{value}</strong>
                    <span className="cx-stat-delta" style={{ color: up ? "var(--green)" : "var(--amber)" }}>{delta}</span>
                  </div>
                ))}
              </div>

              <div className="cx-panel">
                <div className="cx-panel-header">
                  <h3>Token API & Model</h3>
                  <span className="cx-panel-sub">
                    {aiCfg?.updatedAt ? `terakhir diubah ${formatDate(aiCfg.updatedAt)}` : "tersimpan di database, tanpa redeploy"}
                  </span>
                </div>
                <div style={{ padding: 14 }}>
                  {!aiForm ? (
                    <p style={{ color: "var(--faint)", fontSize: 11 }}>Memuat pengaturan...</p>
                  ) : (
                    <>
                      <div className="cx-form-grid">
                        <div className="cx-full-span">
                          <Field label="QWEN_API_KEY" hint={aiCfg?.hasKey ? `Tersimpan: ${aiCfg.keyPreview} (${aiCfg.keySource === "panel" ? "panel" : "env Vercel"}). Kosongkan bila tidak diubah.` : "Belum ada key. Assisten tidak bisa dipakai sampai key diisi."}>
                            <InputWrap icon={LockKeyhole}>
                              <input
                                type="text"
                                value={aiForm.apiKey}
                                onChange={(e) => updateAiForm("apiKey", e.target.value)}
                                placeholder="sk-... / API key DashScope"
                                autoComplete="off"
                              />
                            </InputWrap>
                          </Field>
                        </div>
                        <Field label="Model untuk Admin">
                          <InputWrap><input value={aiForm.modelAdmin} onChange={(e) => updateAiForm("modelAdmin", e.target.value)} placeholder="qwen3.8-max" /></InputWrap>
                        </Field>
                        <Field label="Model untuk User">
                          <InputWrap><input value={aiForm.modelUser} onChange={(e) => updateAiForm("modelUser", e.target.value)} placeholder="qwen3.7-flash" /></InputWrap>
                        </Field>
                        <div className="cx-full-span">
                          <Field label="Base URL Penyedia AI" hint="Kosongkan untuk memakai endpoint DashScope International">
                            <InputWrap><input value={aiForm.baseUrl} onChange={(e) => updateAiForm("baseUrl", e.target.value)} placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1" /></InputWrap>
                          </Field>
                        </div>
                        <Field label="Maks. Langkah Tool" hint="1 - 10, default 6">
                          <InputWrap><input type="number" min="1" max="10" value={aiForm.maxSteps} onChange={(e) => updateAiForm("maxSteps", e.target.value)} /></InputWrap>
                        </Field>
                        <Field label="Temperature" hint="0 = presisi, 1 = kreatif">
                          <InputWrap><input type="number" step="0.1" min="0" max="2" value={aiForm.temperature} onChange={(e) => updateAiForm("temperature", e.target.value)} /></InputWrap>
                        </Field>
                        <div className="cx-full-span">
                          <Field label="Instruksi Tambahan" hint="Ditambahkan ke system prompt Assisten (opsional)">
                            <InputWrap><textarea value={aiForm.extraPrompt} onChange={(e) => updateAiForm("extraPrompt", e.target.value)} placeholder="Contoh: Selalu tawarkan promo top up mingguan." /></InputWrap>
                          </Field>
                        </div>
                        <div className="cx-full-span">
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--ink2)" }}>
                            <input type="checkbox" checked={aiForm.enabled} onChange={(e) => updateAiForm("enabled", e.target.checked)} />
                            Assisten aktif untuk user & admin
                          </label>
                        </div>
                      </div>
                      {aiError && <p className="cx-form-error">{aiError}</p>}
                      {aiNotice && <p style={{ color: "var(--green)", fontSize: 11, marginTop: 8 }}>{aiNotice}</p>}
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={saveSettings} disabled={savingAi}>
                          {savingAi ? <><RefreshCw size={11} /> Menyimpan...</> : <><Check size={11} /> Simpan Pengaturan</>}
                        </button>
                        {aiCfg?.keySource === "panel" && (
                          <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={clearApiKey} disabled={savingAi}>
                            <Trash2 size={11} /> Hapus API Key
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="cx-panel" style={{ marginTop: 18 }}>
                <div className="cx-panel-header">
                  <h3>Hak Akses Assisten</h3>
                  <span className="cx-panel-sub">role menentukan tool yang boleh dipakai</span>
                </div>
                <div style={{ padding: 14, fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
                  <p><strong style={{ color: "var(--ink2)" }}>Admin</strong> — bisa membaca & mengubah data semua user, saldo, status akun, top up, dan produk.</p>
                  <p><strong style={{ color: "var(--ink2)" }}>User biasa</strong> — hanya data akunnya sendiri, dan bisa eskalasi masalah ke admin.</p>
                  <p>Atur role tiap akun di panel <strong style={{ color: "var(--ink2)" }}>Pengguna</strong> (ikon perisai) atau lewat form edit user.</p>
                </div>
              </div>
            </>
          ) : (
          <>
          <div className="cx-admin-top">
            <div>
              <div className="cx-admin-date">{new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
              <h1>{activeNav === "Dashboard" ? "Ringkasan" : activeNav}</h1>
            </div>
            <div className="cx-admin-actions">
              <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={refreshAll} disabled={refreshing}>
                <RefreshCw size={11} className={refreshing ? "cx-spin" : ""} /> {refreshing ? "Memuat..." : "Refresh"}
              </button>
              {(activeNav === "Dashboard" || activeNav === "Produk") && (
                <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => openForm()}><Plus size={11} /> Tambah Produk</button>
              )}
            </div>
          </div>

          {apiError && (
            <div style={{ border: "1px solid rgba(201,121,128,.3)", background: "rgba(201,121,128,.08)", color: "var(--red)", padding: "10px 14px", borderRadius: 4, fontSize: 11, marginBottom: 18 }}>
              {apiError}
            </div>
          )}

          {/* ══ DASHBOARD ══ */}
          {activeNav === "Dashboard" && (
            <>
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

              <div className="cx-quick-grid">
                {[
                  { label: "Permintaan Top Up", nav: "Top Up", icon: Wallet, info: `${pendingTopups} menunggu` },
                  { label: "Pesanan Masuk", nav: "Pesanan", icon: ShoppingBag, info: `${orders.length} transaksi` },
                  { label: "Pengguna", nav: "Pengguna", icon: User, info: `${users.length} akun` },
                  { label: "Produk", nav: "Produk", icon: Package, info: `${listings.length} listing` },
                ].map(({ label, nav, icon: QIcon, info }) => (
                  <button key={nav} className="cx-quick-card" onClick={() => goNav(nav)}>
                    <span className="cx-quick-icon"><QIcon size={15} /></span>
                    <span className="cx-quick-copy">
                      <strong>{label}</strong>
                      <small>{info}</small>
                    </span>
                    <ArrowRight size={13} color="var(--faint)" />
                  </button>
                ))}
              </div>

              <div className="cx-panel" style={{ marginTop: 18 }}>
                <div className="cx-panel-header">
                  <h3>Aktivitas Terbaru</h3>
                  <span className="cx-panel-sub">produk & transaksi terakhir</span>
                </div>
                {recentActivity.length === 0
                  ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11 }}>Belum ada aktivitas.</div>
                  : recentActivity.map((a, i) => (
                    <div key={a.key} className="cx-activity-item">
                      <div className="cx-activity-icon" style={{ color: ACCENT_COLORS[i % ACCENT_COLORS.length] }}>
                        <a.Icon size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cx-activity-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                        <div className="cx-activity-desc">{a.desc}</div>
                      </div>
                      <span className="cx-activity-time">{a.time}</span>
                    </div>
                  ))
                }
              </div>
            </>
          )}

          {/* ══ PRODUK ══ */}
          {activeNav === "Produk" && (
            <div className="cx-panel cx-panel-plain">
              <div className="cx-panel-header">
                <h3>Produk</h3>
                <span className="cx-panel-sub">{filtered.length} dari {listings.length} listing</span>
                <div className="cx-panel-actions">
                  <button className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => openForm()}><Plus size={11} /> Tambah Produk</button>
                </div>
              </div>
              {loading && !listings.length
                ? <RowSkeleton rows={4} />
                : filtered.length === 0
                  ? <div className="cx-panel-empty"><Package size={20} /><p>Tidak ada produk ditemukan.</p></div>
                  : (
                    <div className="cx-product-grid">
                      {filtered.map((l) => {
                        const prices = (l.accounts || []).map((a) => Number(a.price) || Number(l.price) || 0);
                        const min = prices.length ? Math.min(...prices) : Number(l.price) || 0;
                        const max = prices.length ? Math.max(...prices) : min;
                        const stock = Number(l.stock) || 0;
                        return (
                          <article key={l.id} className="cx-admin-product-card">
                            <header>
                              <span className="cx-admin-product-icon"><ProviderIcon type={l.loginType} size={18} /></span>
                              <div className="cx-admin-product-title">
                                <strong title={l.title}>{l.title}</strong>
                                <small>{l.loginType}</small>
                              </div>
                              <span className={`cx-status ${l.status === "available" ? "cx-status-ok" : stock <= 3 ? "cx-status-low" : "cx-status-out"}`}>
                                {l.status === "available" ? "Aktif" : "Habis"}
                              </span>
                            </header>
                            <div className="cx-admin-product-meta">
                              <div>
                                <small>Harga</small>
                                <strong className="cx-mono">{min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`}</strong>
                              </div>
                              <div>
                                <small>Stok</small>
                                <strong className="cx-mono" style={{ color: stock === 0 ? "var(--red)" : stock <= 3 ? "var(--amber)" : "var(--ink2)" }}>{stock} akun</strong>
                              </div>
                            </div>
                            {l.description && <ExpandableText className="cx-admin-product-desc" text={l.description} lines={2} limit={90} />}
                            <footer>
                              <button className="cx-row-btn" onClick={() => openForm(l)}><Pencil size={11} /> <span>Edit</span></button>
                              <button className="cx-row-btn danger" onClick={() => deleteListing(l)} disabled={isPending(`prod-${l.id}`)}>
                                {isPending(`prod-${l.id}`) ? <Spinner /> : <Trash2 size={11} />} <span>Hapus</span>
                              </button>
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  )
              }
            </div>
          )}

          {/* ══ PESANAN ══ */}
          {activeNav === "Pesanan" && (
            <div className="cx-panel cx-panel-plain">
              <div className="cx-panel-header">
                <h3>Pesanan Masuk</h3>
                <span className="cx-panel-sub">{groupedOrders.length} akun pembeli · {filteredOrders.length} transaksi</span>
              </div>
              {ordersLoading && !orders.length
                ? <RowSkeleton rows={3} />
                : groupedOrders.length === 0
                  ? <div className="cx-panel-empty"><ShoppingBag size={20} /><p>Belum ada pesanan masuk.</p></div>
                  : groupedOrders.map((g) => (
                    <div key={g.buyer.id || g.buyer.email} className="cx-order-card cx-buyer-card">
                      <div className="cx-order-card-head">
                        <div className="cx-avatar">{String(g.buyer.name || "U").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                        <div className="cx-buyer-ident">
                          <strong>{g.buyer.name}</strong>
                          <small>{g.buyer.email}{g.buyer.phone ? ` · ${g.buyer.phone}` : ""}</small>
                        </div>
                        <div className="cx-order-total">
                          <strong className="cx-mono">{formatPrice(g.total)}</strong>
                          <small>{g.orders.length} transaksi · {g.accounts} akun</small>
                        </div>
                      </div>
                      <div className="cx-order-meta">
                        <span>Saldo pembeli: {formatPrice(g.buyer.balance)}</span>
                        <span>Terakhir: {formatDate(g.orders[0].createdAt)}</span>
                      </div>
                      <div className="cx-buyer-orders">
                        {g.orders.map((o) => (
                          <div key={o.id} className="cx-buyer-order">
                            <div className="cx-buyer-order-head">
                              <span className="cx-mono">#{String(o.id).slice(0, 8)}</span>
                              <span>{formatDate(o.createdAt)}</span>
                              <span className={`cx-status ${o.status === "paid" ? "cx-status-ok" : "cx-status-low"}`}>{o.status === "paid" ? "Lunas" : "Refund"}</span>
                              <strong className="cx-mono" style={{ marginLeft: "auto" }}>{formatPrice(o.total)}</strong>
                              <button
                                className="cx-row-btn danger"
                                onClick={() => deleteAdminOrder(o.id)}
                                aria-label="Hapus pesanan"
                                disabled={isPending(`aorder-${o.id}`)}
                              >
                                {isPending(`aorder-${o.id}`) ? <Spinner /> : <Trash2 size={11} />}
                              </button>
                            </div>
                            {o.customEmail && (
                              <div className="cx-custom-email-tag"><Mail size={11} /> Permintaan email khusus: <strong>{o.customEmail}</strong></div>
                            )}
                            <div className="cx-order-items">
                              {(o.items || []).map((it, i) => (
                                <div key={i} className="cx-order-item">
                                  <ProviderIcon type={it.loginType} size={13} />
                                  <span className="cx-order-item-title">{it.title}</span>
                                  <span className="cx-order-item-sub">{(it.accounts || []).length} akun · {(it.accounts || []).map((a) => a.email).join(", ")}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="cx-order-actions">
                        <button className="cx-row-btn" onClick={() => { setUserQuery(g.buyer.email); setActiveNav("Pengguna"); }}><User size={11} /> <span>Lihat akun</span></button>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}

          {/* ══ CUSTOM EMAIL ══ */}
          {activeNav === "Custom Email" && (() => {
            const customOrders = orders.filter((o) => o.customEmail);
            return (
              <div className="cx-panel cx-panel-plain">
                <div className="cx-panel-header">
                  <h3>Permintaan Custom Email</h3>
                  <span className="cx-panel-sub">{customOrders.length} permintaan dari pembeli</span>
                </div>
                {ordersLoading && !orders.length
                  ? <RowSkeleton rows={3} />
                  : customOrders.length === 0
                    ? <div className="cx-panel-empty"><Mail size={20} /><p>Belum ada permintaan email khusus.</p></div>
                    : customOrders.map((o) => (
                      <div key={o.id} className="cx-order-card">
                        <div className="cx-buyer-order-head">
                          <span className="cx-mono">#{String(o.id).slice(0, 8)}</span>
                          <span>{formatDate(o.createdAt)}</span>
                          <span className={`cx-status ${o.status === "paid" ? "cx-status-ok" : "cx-status-low"}`}>{o.status === "paid" ? "Lunas" : "Refund"}</span>
                          <strong className="cx-mono" style={{ marginLeft: "auto" }}>{formatPrice(o.total)}</strong>
                        </div>
                        <div className="cx-custom-email-tag"><Mail size={11} /> Email diminta: <strong>{o.customEmail}</strong></div>
                        <div className="cx-order-meta">
                          <span>{o.userName || o.buyerName || "Pembeli"}{o.userEmail ? ` · ${o.userEmail}` : ""}</span>
                          <span>{(o.items || []).reduce((n, it) => n + ((it.accounts || []).length), 0)} akun</span>
                        </div>
                        <div className="cx-order-items">
                          {(o.items || []).map((it, i) => (
                            <div key={i} className="cx-order-item">
                              <ProviderIcon type={it.loginType} size={13} />
                              <span className="cx-order-item-title">{it.title}</span>
                            </div>
                          ))}
                        </div>
                        <div className="cx-order-actions">
                          <button className="cx-row-btn" onClick={() => goNav("Pesanan")}><ShoppingBag size={11} /> <span>Buka di Pesanan</span></button>
                        </div>
                      </div>
                    ))
                }
              </div>
            );
          })()}

          {/* ══ TOP UP ══ */}
          {activeNav === "Top Up" && (
            <div className="cx-panel">
              <div className="cx-panel-header">
                <h3>Permintaan Top Up</h3>
                <span className="cx-panel-sub">{pendingTopups} menunggu · {topups.length - pendingTopups} selesai</span>
                <div className="cx-panel-actions">
                  <ActionBtn
                    className="cx-btn cx-btn-ghost cx-btn-sm"
                    onClick={clearTopupHistory}
                    disabled={topups.length - pendingTopups === 0}
                    busy={isPending("topup-clear")}
                    busyLabel="Membersihkan..."
                  >
                    <Trash2 size={11} /> Bersihkan riwayat
                  </ActionBtn>
                </div>
              </div>
              {topups.length === 0
                ? <div style={{ padding: "20px 14px", color: "var(--faint)", fontSize: 11 }}>Belum ada permintaan top up.</div>
                : topups.map((t) => (
                  <div key={t.id} className="cx-topup-row">
                    <div>
                      <strong>{formatPrice(t.amount)}</strong>
                      <small>{t.userName} · {t.userEmail} · {t.method}{t.reference ? ` · ID trx: ${t.reference}` : ""}</small>
                      {t.note && <ExpandableText className="cx-topup-note" text={`Catatan: ${t.note}`} lines={2} limit={80} />}
                    </div>
                    <span className="cx-topup-date">{formatDate(t.createdAt)}</span>
                    {t.status === "pending"
                      ? <div className="cx-topup-review">
                          <ActionBtn
                            className="cx-btn cx-btn-primary cx-btn-sm"
                            onClick={() => reviewTopup(t.id, "approve", `${formatPrice(t.amount)} · ${t.userName} (${t.userEmail})`)}
                            busy={isPending(`topup-${t.id}`)}
                          >
                            <Check size={11} /> Setujui
                          </ActionBtn>
                          <ActionBtn
                            className="cx-btn cx-btn-ghost cx-btn-sm"
                            onClick={() => reviewTopup(t.id, "reject", `${formatPrice(t.amount)} · ${t.userName} (${t.userEmail})`)}
                            busy={isPending(`topup-${t.id}`)}
                          >
                            <X size={11} /> Tolak
                          </ActionBtn>
                        </div>
                      : <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className={`cx-topup-badge ${t.status === "approved" ? "ok" : "bad"}`}>
                            {t.status === "approved" ? <BadgeCheck size={11} /> : <X size={11} />}
                            {t.status === "approved" ? " Disetujui" : " Ditolak"}
                          </span>
                          <button className="cx-row-btn danger" onClick={() => deleteTopup(t.id)} aria-label="Hapus permintaan" disabled={isPending(`topup-del-${t.id}`)}>
                            {isPending(`topup-del-${t.id}`) ? <Spinner /> : <Trash2 size={11} />}
                          </button>
                        </div>}
                  </div>
                ))}
            </div>
          )}

          {/* ══ PENGGUNA ══ */}
          {activeNav === "Pengguna" && (
          <div className="cx-panel">
            <div className="cx-panel-header">
              <h3>Pengguna</h3>
              <span className="cx-panel-sub">
                {userQuery.trim() ? `${filteredUsers.length} hasil dari ${users.length} akun` : `${users.length} akun terdaftar`}
              </span>
              <div className="cx-panel-actions">
                <div className="cx-search" style={{ maxWidth: 240 }}>
                  <Search size={12} />
                  <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Cari nama / email / no. HP" />
                </div>
              </div>
            </div>
            {userQuery.trim() && (
              <div className="cx-filter-bar">
                <span className="cx-filter-chip">
                  <Search size={10} /> Filter: “{userQuery.trim()}”
                  <button type="button" onClick={() => setUserQuery("")} aria-label="Hapus filter"><X size={10} /></button>
                </span>
                <button type="button" className="cx-filter-reset" onClick={() => setUserQuery("")}>Tampilkan semua {users.length} akun</button>
              </div>
            )}
            <div className="cx-user-head">
              <span>USER</span><span>SALDO</span><span>TOP UP</span><span>STATUS</span><span>BERGABUNG</span><span />
            </div>
            {filteredUsers.length === 0
              ? (
                <div className="cx-panel-empty">
                  <User size={20} />
                  <p>{userQuery.trim() ? `Tidak ada akun cocok dengan “${userQuery.trim()}”.` : "Belum ada user terdaftar."}</p>
                  {userQuery.trim() && <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={() => setUserQuery("")}>Tampilkan semua akun</button>}
                </div>
              )
              : pagedUsers.map((u) => (
                <div key={u.id} className="cx-user-row">
                  <div className="cx-user-ident">
                    <div className="cx-avatar">{String(u.name || "U").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <strong>
                        {u.name}
                        {u.role === "admin" && (
                          <span className="cx-role-tag"><ShieldCheck size={9} /> Admin</span>
                        )}
                      </strong>
                      <small>{u.email}{u.phone ? ` · ${u.phone}` : ""}</small>
                    </div>
                  </div>
                  <span className="cx-mono cx-user-cell" data-label="Saldo">{formatPrice(u.balance)}</span>
                  <span className="cx-mono cx-user-cell" data-label="Top up" style={{ color: "var(--muted)" }}>
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
                    <button
                      className="cx-row-btn"
                      onClick={() => setUserRole(u.id, u.role === "admin" ? "user" : "admin")}
                      aria-label={u.role === "admin" ? "Cabut admin" : "Jadikan admin"}
                      title={u.role === "admin" ? "Cabut akses admin" : "Jadikan admin"}
                    >
                      <ShieldCheck size={11} />
                    </button>
                    <button className="cx-row-btn" onClick={() => openUserForm(u)} aria-label="Edit user"><Pencil size={11} /></button>
                    <button className="cx-row-btn danger" onClick={() => deleteUser(u)} aria-label="Hapus user" disabled={isPending(`user-del-${u.id}`)}>
                      {isPending(`user-del-${u.id}`) ? <Spinner /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              ))}
            {filteredUsers.length > USERS_PER_PAGE && (
              <div className="cx-pager">
                <span>Halaman {safeUserPage} dari {userPageCount} · {filteredUsers.length} akun</span>
                <div className="cx-pager-btns">
                  <button className="cx-row-btn" disabled={safeUserPage <= 1} onClick={() => setUserPage(safeUserPage - 1)}>Sebelumnya</button>
                  <button className="cx-row-btn" disabled={safeUserPage >= userPageCount} onClick={() => setUserPage(safeUserPage + 1)}>Berikutnya</button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ══ PENGATURAN ══ */}
          {activeNav === "Pengaturan" && (
            <div className="cx-two-col">
              <div className="cx-panel">
                <div className="cx-panel-header"><h3>Sesi Admin</h3></div>
                <div className="cx-setting-row">
                  <div><strong>Status sesi</strong><small>Sesi admin aktif di perangkat ini.</small></div>
                  <span className="cx-status cx-status-ok">Aktif</span>
                </div>
                <div className="cx-setting-row">
                  <div><strong>Keluar dari panel</strong><small>Akhiri sesi admin sekarang.</small></div>
                  <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={logout}><LogOut size={11} /> Keluar</button>
                </div>
                <div className="cx-setting-row">
                  <div><strong>Kembali ke store</strong><small>Buka tampilan pembeli.</small></div>
                  <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={onBack}><ArrowRight size={11} /> Store</button>
                </div>
              </div>
              <div className="cx-panel">
                <div className="cx-panel-header"><h3>Data & Pemeliharaan</h3></div>
                <div className="cx-setting-row">
                  <div><strong>Muat ulang semua data</strong><small>Produk, pengguna, top up, dan pesanan.</small></div>
                  <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={refreshAll} disabled={refreshing}>
                    <RefreshCw size={11} className={refreshing ? "cx-spin" : ""} /> Refresh
                  </button>
                </div>
                <div className="cx-setting-row">
                  <div><strong>Bersihkan riwayat top up</strong><small>Hapus permintaan yang sudah disetujui/ditolak.</small></div>
                  <button className="cx-btn cx-btn-ghost cx-btn-sm" onClick={clearTopupHistory} disabled={topups.length - pendingTopups === 0}>
                    <Trash2 size={11} /> Bersihkan
                  </button>
                </div>
                <div className="cx-setting-row">
                  <div><strong>Assisten AI</strong><small>{aiCfg && aiCfg.enabled && aiCfg.hasKey ? "Terhubung dan aktif" : "Belum dikonfigurasi"}</small></div>
                  <button className="cx-btn cx-btn-secondary cx-btn-sm" onClick={() => goNav("Assisten")}><Sparkles size={11} /> Atur</button>
                </div>
              </div>
            </div>
          )}
          </>
          )}
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
                <Field label="Role" hint="Admin bisa memakai Assisten mode admin">
                  <InputWrap>
                    <select value={userForm.role} onChange={(e) => updateUserForm("role", e.target.value)}>
                      <option value="user">User biasa</option>
                      <option value="admin">Admin</option>
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

      <AssistantWidget open={asstOpen} onOpenChange={setAsstOpen} hideFab />
      {confirmDialog}
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
  { id: "DANA",      short: "DANA",  icon: "/wallets/dana.png",      color: "#118EEA", tint: "rgba(17,142,234,.14)" },
  { id: "GoPay",     short: "gopay", icon: "/wallets/gopay.png",     color: "#00AED6", tint: "rgba(0,174,214,.14)" },
  { id: "OVO",       short: "OVO",   icon: "/wallets/ovo.png",       color: "#4C3494", tint: "rgba(76,52,148,.16)" },
  { id: "SeaBank",   short: "SeaBank", icon: "/wallets/seabank.png", color: "#E85D04", tint: "rgba(232,93,4,.14)" },
  { id: "ShopeePay", short: "SPay",  icon: "/wallets/shopeepay.png", color: "#EE4D2D", tint: "rgba(238,77,45,.14)" },
  { id: "LinkAja",   short: "Link",  icon: "/wallets/linkaja.png",   color: "#E22B2B", tint: "rgba(226,43,43,.14)" },
  { id: "BCA",       short: "BCA",   icon: "/wallets/bca.png",       color: "#0066AE", tint: "rgba(0,102,174,.14)" },
  { id: "BRI",       short: "BRI",   icon: "/wallets/bri.png",       color: "#00529C", tint: "rgba(0,82,156,.14)" },
  { id: "BNI",       short: "BNI",   icon: "/wallets/bni.png",       color: "#00695C", tint: "rgba(0,105,92,.14)" },
  { id: "Mandiri",   short: "Livin", icon: "/wallets/mandiri.png",   color: "#003D79", tint: "rgba(0,61,121,.14)" },
];
const appMeta = (id) => QRIS_APPS.find((a) => a.id === id) || QRIS_APPS[QRIS_APPS.length - 1];

function AppLogo({ app, size = 34 }) {
  const m = appMeta(app);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [m.icon]);
  const showImg = m.icon && !broken;
  return (
    <span className="cx-applogo" style={{ width: size * 1.55, height: size, background: m.tint, color: m.color, borderColor: m.color }}>
      {showImg
        ? <img
            src={m.icon}
            alt={m.id}
            className="cx-applogo-img"
            decoding="async"
            onError={() => setBroken(true)}
          />
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
  const [state, setState] = useState({ balance: user.balance, topups: [], pendingTotal: 0, loading: true, error: "" });
  const load = () => {
    setState((x) => ({ ...x, loading: true, error: "" }));
    jsonRequest("/api/topup", { method: "GET" })
      .then((p) => setState({
        balance: Number(p.balance) || 0,
        topups: p.topups || [],
        pendingTotal: Number(p.pendingTotal) || 0,
        loading: false,
        error: "",
      }))
      .catch((e) => setState((x) => ({ ...x, loading: false, error: e.message })));
  };
  useEffect(() => { load(); }, []);
  return [state, load];
}

/* ─── Halaman Profil (tanpa form top up) ─── */
function ProfilePage({ user, onBack, onTopup }) {
  const [state] = useTopupData(user);
  const initials = String(user.name || "CX").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const pendingTotal = Number(state.pendingTotal) || 0;

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
            <li>
              <ShieldCheck size={13} /><span>Role akun</span>
              <strong>
                {user.role === "admin" ? "Admin" : "User"}
                <span className={`cx-role-tag${user.role === "admin" ? "" : " is-user"}`}>
                  {user.role === "admin" ? "Akses penuh" : "Akses standar"}
                </span>
              </strong>
            </li>
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

/* Kompres bukti transfer di browser supaya upload ringan (maks 1400px, JPEG). */
function compressProof(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("File harus berupa gambar (JPG/PNG).")); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error("Ukuran gambar maksimal 12MB.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file bukti."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ─── Halaman Top Up (berdiri sendiri) ─── */
function TopUpPage({ user, onBack, onNotice, onRefresh }) {
  const [state, load] = useTopupData(user);
  const [amount, setAmount]     = useState("");
  const [app, setApp]           = useState(QRIS_APPS[0].id);
  const [trxId, setTrxId]       = useState("");
  const [note, setNote]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [formError, setFormError] = useState("");
  const [step, setStep]         = useState("form");
  const [agreed, setAgreed]     = useState(false);
  const [orderId, setOrderId]   = useState("");
  const trxIdRef = useRef(null);
  const proofRef = useRef(null);
  const [showTrxRequired, setShowTrxRequired] = useState(false);
  const [proof, setProof] = useState("");
  const [proofName, setProofName] = useState("");
  const [proofBusy, setProofBusy] = useState(false);

  const amountNumber = Math.round(Number(amount) || 0);
  const appLabel = app;
  const methodLabel = `QRIS · ${appLabel}`;
  const pendingTotal = Number(state.pendingTotal) || 0;
  const dataReady = trxId.trim().length >= 4 && Boolean(proof);

  const goConfirm = (e) => {
    e.preventDefault(); setFormError("");
    if (!Number.isFinite(amountNumber) || amountNumber < 10000) {
      setFormError("Minimal top up Rp10.000."); return;
    }
    setOrderId("CX" + Date.now().toString().slice(-6));
    setAgreed(false); setStep("confirm");
  };

  const fullNote = () => {
    const parts = [];
    if (note.trim()) parts.push(note.trim());
    parts.push(`Order ID: ${orderId}`);
    return parts.join(" | ").slice(0, 300);
  };

  const pickProof = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setProofBusy(true); setFormError("");
    try {
      const dataUrl = await compressProof(file);
      setProof(dataUrl); setProofName(file.name);
    } catch (err) { setFormError(err.message); }
    finally { setProofBusy(false); }
  };

  const submitTopup = async (e) => {
    e.preventDefault(); setFormError(""); setShowTrxRequired(false);
    if (!trxId.trim()) { setFormError("Nomor ID transaksi wajib diisi."); setShowTrxRequired(true); return; }
    if (!proof) {
      setFormError("Unggah bukti transfer dulu, bot yang akan mengirimnya ke admin.");
      proofRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);

    try {
      await jsonRequest("/api/topup", {
        method: "POST",
        body: JSON.stringify({ amount: amountNumber, method: methodLabel, reference: trxId.trim(), note: fullNote(), proof }),
      });
      setAmount(""); setTrxId(""); setNote(""); setApp(QRIS_APPS[0].id);
      setProof(""); setProofName("");
      setStep("form"); setAgreed(false);
      onNotice("Bukti transfer terkirim otomatis ke admin, menunggu verifikasi");
      load(); onRefresh();
      window.dispatchEvent(new Event("codexa:notify"));
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
            {["Nominal", "Konfirmasi", "Bayar & unggah bukti"].map((s, i) => {
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
            <p className="cx-field-hint">Pembayaran QRIS bisa lewat aplikasi di atas.</p>


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
              <li>Lengkapi data + unggah bukti di bawah, bot langsung kirim ke admin.</li>
            </ol>

            <Field label="Nomor ID transaksi" hint="Wajib. Nomor referensi / transaction ID dari struk pembayaran." error={showTrxRequired ? "* wajib memasukkan ID transaksi" : ""}>
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

            <div className="cx-proof-block" ref={proofRef}>
              <div className="cx-proof-title">Unggah bukti transfer — bot yang kirim ke admin</div>
              {proof ? (
                <div className="cx-proof-preview">
                  <img src={proof} alt="Pratinjau bukti transfer" />
                  <div className="cx-proof-meta">
                    <strong>{proofName || "bukti-transfer.jpg"}</strong>
                    <small>Siap dikirim otomatis ke admin lewat bot Telegram.</small>
                    <button type="button" className="cx-btn cx-btn-ghost" onClick={() => { setProof(""); setProofName(""); }}>Ganti gambar</button>
                  </div>
                </div>
              ) : (
                <label className={`cx-proof-drop${proofBusy ? " busy" : ""}`}>
                  <input type="file" accept="image/*" onChange={pickProof} disabled={proofBusy} hidden />
                  <FileText size={18} />
                  <span>{proofBusy ? "Memproses gambar..." : "Pilih / foto struk pembayaran"}</span>
                  <small>JPG atau PNG. Tidak perlu kirim manual ke WhatsApp/Telegram.</small>
                </label>
              )}
            </div>

            <div className="cx-confirm-actions">
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setStep("confirm")}>Kembali</button>
              <button type="submit" className="cx-btn cx-btn-primary" disabled={busy || !dataReady}>
                {busy ? <><RefreshCw size={13} /> Mengirim...</> : <><Plus size={13} /> Kirim bukti &amp; konfirmasi</>}
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

/* ═══════════════════════════════════════════════════
   ASSISTEN AI (Qwen) — floating widget
   Role ditentukan server dari cookie sesi:
   admin → akses penuh, user → hanya data sendiri.
════════════════════════════════════════════════════ */
const ASSISTANT_HINTS = {
  user: [
    "Cek status akun saya",
    "Saldo saya berapa sekarang?",
    "Riwayat top up terakhir saya",
    "Top up saya belum masuk, tolong bantu",
  ],
  admin: [
    "Ringkasan toko hari ini",
    "Ada top up pending? tampilkan",
    "Cari user dengan email ...",
    "Ada laporan user apa aja?",
    "Tampilkan isi database (tabel + jumlah baris)",
    "Hapus laporan yang sudah closed",
  ],
};

/* ── Markdown ringan untuk balasan Assisten ──
   Model sering menulis **tebal**, daftar, dan `kode`. Tanpa renderer, simbolnya
   ikut tampil mentah di bubble chat. Ini parser kecil tanpa dependensi. ── */
function renderInline(raw, keyPrefix) {
  const nodes = [];
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let n = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) nodes.push(raw.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (tok.startsWith("**") || tok.startsWith("__")) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return nodes.length ? nodes : [raw];
}

function parseBlocks(text) {
  const blocks = [];
  String(text || "")
    .replace(/\r/g, "")
    .replace(/```/g, "")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const last = blocks[blocks.length - 1];
      const heading = t.match(/^#{1,6}\s+(.*)$/);
      if (heading) { blocks.push({ kind: "h", text: heading[1] }); return; }
      const bullet = t.match(/^[-*•]\s+(.*)$/);
      if (bullet) {
        if (last && last.kind === "ul") last.items.push(bullet[1]);
        else blocks.push({ kind: "ul", items: [bullet[1]] });
        return;
      }
      const numbered = t.match(/^\d+[.)]\s+(.*)$/);
      if (numbered) {
        if (last && last.kind === "ol") last.items.push(numbered[1]);
        else blocks.push({ kind: "ol", items: [numbered[1]] });
        return;
      }
      // baris tabel markdown → jadikan teks biasa yang rapi
      if (/^\|.*\|$/.test(t)) {
        const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return;
        blocks.push({ kind: "p", text: cells.join(" · ") });
        return;
      }
      blocks.push({ kind: "p", text: t });
    });
  return blocks;
}

function RichText({ text }) {
  const blocks = parseBlocks(text);
  if (!blocks.length) return null;
  return (
    <div className="cx-md">
      {blocks.map((b, i) => {
        if (b.kind === "h") return <p key={i} className="cx-md-h">{renderInline(b.text, `h${i}`)}</p>;
        if (b.kind === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `u${i}-${j}`)}</li>)}</ul>;
        if (b.kind === "ol") return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `o${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{renderInline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}

/** Nama tool → label pendek yang enak dibaca di progres chat. */
function toolLabel(name) {
  return String(name || "tool")
    .replace(/^admin_/, "")
    .replace(/^get_my_/, "")
    .replace(/_/g, " ");
}

function AssistantWidget({ open: openProp, onOpenChange, hideFab = false }) {
  const controlled = typeof openProp === "boolean";
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (v) => {
    const next = typeof v === "function" ? v(open) : v;
    if (controlled) { if (onOpenChange) onOpenChange(next); }
    else setOpenState(next);
  };
  const [info, setInfo] = useState({ loading: true, role: "", available: false, model: "", reason: "", error: "" });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Progres langsung dari server saat assisten bekerja (catatan + tool berjalan).
  const [live, setLive] = useState({ notes: [], steps: [] });
  const [error, setError] = useState("");
  const scroller = useRef(null);
  const inputRef = useRef(null);

  const loadInfo = () => {
    setInfo((s) => ({ ...s, loading: true, error: "" }));
    fetch("/api/assistant", { credentials: "same-origin" })
      .then(async (r) => {
        const p = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(p.error || "Assisten tidak tersedia");
        return p;
      })
      .then((p) => setInfo({ loading: false, role: p.role, available: p.available, model: p.model || "", reason: p.reason || "", error: "" }))
      .catch((e) => setInfo({ loading: false, role: "", available: false, model: "", reason: "", error: e.message }));
  };

  useEffect(() => { if (open) loadInfo(); }, [open]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy]);

  const isAdminMode = info.role === "admin";

  const send = async (raw) => {
    const content = String(raw == null ? draft : raw).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError("");
    setLive({ notes: [], steps: [] });
    const pushNote = (text) => setLive((s) => ({ ...s, notes: [...s.notes, text] }));
    const startTool = (name) =>
      setLive((s) => ({ ...s, steps: [...s.steps, { name, status: "run", error: "" }] }));
    const endTool = (name, ok, err) =>
      setLive((s) => ({
        ...s,
        steps: s.steps.map((st, i) =>
          st.name === name && st.status === "run" && !s.steps.slice(i + 1).some((x) => x.name === name && x.status === "run")
            ? { ...st, status: ok ? "done" : "fail", error: err || "" }
            : st,
        ),
      }));

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })), stream: true }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Assisten gagal menjawab");
      }
      if (!res.body || !res.body.getReader) {
        // Browser lama: fallback ke respons JSON biasa.
        const payload = await res.json().catch(() => ({}));
        setMessages([...next, { role: "assistant", content: payload.reply || "", actions: payload.actions || [] }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = null;
      const notes = [];
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const raw = line.trim();
          if (!raw) continue;
          let ev;
          try { ev = JSON.parse(raw); } catch (_) { continue; }
          if (ev.type === "note" && ev.text) { notes.push(ev.text); pushNote(ev.text); }
          else if (ev.type === "tool_start") startTool(ev.name);
          else if (ev.type === "tool_end") endTool(ev.name, ev.ok !== false, ev.error);
          else if (ev.type === "error") throw new Error(ev.error || "Assisten gagal menjawab");
          else if (ev.type === "done") done = ev;
        }
      }
      if (!done) throw new Error("Koneksi ke Assisten terputus, coba lagi.");
      setMessages([
        ...next,
        { role: "assistant", content: done.reply || "", actions: done.actions || [], notes },
      ]);
    } catch (e) {
      setError(e.message);
      setMessages(next);
    } finally {
      setLive({ notes: [], steps: [] });
      setBusy(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const hints = ASSISTANT_HINTS[isAdminMode ? "admin" : "user"];

  return (
    <>
      {!hideFab && (
        <button
          className={`cx-ai-fab${open ? " open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup Assisten" : "Buka Assisten"}
        >
          {open ? <X size={16} /> : <Sparkles size={16} />}
          {!open && <span className="cx-ai-fab-label">Assisten</span>}
        </button>
      )}

      {open && <div className="cx-ai-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="cx-ai-panel" role="dialog" aria-label="Assisten CodeXa">
          <div className="cx-ai-grab" />
          <div className="cx-ai-head">
            <div className="cx-ai-avatar"><Sparkles size={14} /></div>
            <div className="cx-ai-head-copy">
              <strong>Assisten CodeXa</strong>
              <small>
                {info.loading ? "Menyiapkan..."
                  : info.error ? "Perlu masuk dulu"
                  : isAdminMode ? "Mode admin · akses penuh"
                  : "Mode user · data akun kamu"}
              </small>
            </div>
            {!info.loading && !info.error && (
              <span className={`cx-ai-badge${isAdminMode ? " admin" : ""}`}>
                {isAdminMode ? <ShieldCheck size={10} /> : <User size={10} />}
                {isAdminMode ? "Admin" : "User"}
              </span>
            )}
            <button className="cx-icon-btn" onClick={() => setOpen(false)} aria-label="Tutup"><X size={13} /></button>
          </div>

          <div className="cx-ai-body" ref={scroller}>
            {info.loading && <div className="cx-ai-empty"><RefreshCw size={18} /><p>Menghubungkan ke Assisten...</p></div>}

            {!info.loading && info.error && (
              <div className="cx-ai-empty">
                <LockKeyhole size={18} />
                <p>{info.error}</p>
                <button className="cx-btn cx-btn-ghost" onClick={loadInfo}>Coba lagi</button>
              </div>
            )}

            {!info.loading && !info.error && !info.available && (
              <div className="cx-ai-empty">
                <LockKeyhole size={18} />
                <p>
                  {info.reason === "disabled"
                    ? "Assisten sedang dimatikan oleh admin. Coba lagi nanti."
                    : info.role === "admin"
                      ? "Assisten belum aktif. Isi API key di Admin Panel → Assisten."
                      : "Assisten belum aktif. Admin sedang menyiapkannya, coba lagi nanti."}
                </p>
                <button className="cx-btn cx-btn-ghost" onClick={loadInfo}>Coba lagi</button>
              </div>
            )}

            {!info.loading && !info.error && info.available && messages.length === 0 && (
              <div className="cx-ai-intro">
                <p>
                  {isAdminMode
                    ? "Mode admin aktif. Aku bisa baca & ubah data user, saldo, status akun, top up, dan produk."
                    : "Hai! Aku bisa cek info & status akun kamu, saldo, riwayat top up, ubah profil, dan meneruskan masalahmu ke admin."}
                </p>
                <div className="cx-ai-hints">
                  {hints.map((h) => (
                    <button key={h} onClick={() => send(h)}>{h}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`cx-ai-msg ${m.role}`}>
                {m.role === "assistant" && m.notes && m.notes.length > 0 && (
                  <div className="cx-ai-notes">
                    {m.notes.map((n, j) => <p key={j}><Check size={9} />{n}</p>)}
                  </div>
                )}
                <div className="cx-ai-bubble">
                  {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                </div>
                {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                  <div className="cx-ai-actions">
                    {m.actions.map((a, j) => <span key={j}><Check size={9} />{a}</span>)}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="cx-ai-msg assistant">
                {live.notes.map((n, i) => (
                  <div className="cx-ai-bubble" key={`n${i}`}><RichText text={n} /></div>
                ))}
                {live.steps.length > 0 && (
                  <div className="cx-ai-steps">
                    {live.steps.map((st, i) => (
                      <span key={i} className={st.status}>
                        {st.status === "run" ? <RefreshCw size={9} className="cx-spin" />
                          : st.status === "done" ? <Check size={9} /> : <X size={9} />}
                        {toolLabel(st.name)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="cx-ai-bubble cx-ai-typing"><i /><i /><i /></div>
              </div>
            )}

            {error && <div className="cx-ai-error">{error}</div>}
          </div>

          {!info.loading && !info.error && info.available && (
            <div className="cx-ai-composer-wrap">
              <form
                className="cx-ai-composer"
                onSubmit={(e) => { e.preventDefault(); send(); }}
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={isAdminMode ? "Perintah untuk Assisten admin..." : "Tanya apa saja soal akunmu..."}
                  maxLength={2000}
                  disabled={busy}
                />
                <button type="submit" className="cx-ai-send" disabled={busy || !draft.trim()} aria-label="Kirim">
                  {busy ? <RefreshCw size={13} /> : <Send size={13} />}
                </button>
              </form>
            </div>
          )}

          {!info.loading && !info.error && info.available && !isAdminMode && (
            <p className="cx-ai-foot"><ShieldCheck size={9} /> Assisten hanya bisa mengakses data akunmu sendiri.</p>
          )}
        </div>
      )}
    </>
  );
}

/* ─── mount ─── */
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
