import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, BadgeCheck, Bell, Check, ChevronRight, CircleHelp,
  Headphones, LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, Package,
  Pencil, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, Trash2,
  UserCheck, UserRound, UserX, Users, X,
} from "lucide-react";
import "./styles.css";

const formatPrice = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const formatDate = (value) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)) : "-";

function App() {
  const [activePage, setActivePage] = useState(() => window.location.pathname === "/admin" ? "admin" : "store");
  const [search, setSearch] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({ products: [], orders: [], customerCount: 0, loading: true, error: "" });

  useEffect(() => {
    const onPopState = () => setActivePage(window.location.pathname === "/admin" ? "admin" : window.location.pathname === "/orders" ? "orders" : window.location.pathname === "/help" ? "help" : "store");
    window.addEventListener("popstate", onPopState);
    fetch("/api/data").then(async (result) => {
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error || "Data tidak tersedia");
      return payload;
    }).then((payload) => setData({ products: payload.products || [], orders: payload.orders || [], customerCount: Number(payload.customerCount) || 0, loading: false, error: "" }))
      .catch((error) => setData((current) => ({ ...current, loading: false, error: error.message })));
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.products.filter((product) => `${product.title || ""} ${product.description || ""}`.toLowerCase().includes(query)) : data.products;
  }, [data.products, search]);

  const navigate = (page) => {
    const path = page === "store" ? "/" : `/${page}`;
    window.history.pushState({}, "", path);
    setActivePage(page);
    setShowMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const showNotice = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };

  return <div className="app-shell">
    <header className="topbar"><div className="container topbar-inner">
      <button className="brand" onClick={() => navigate("store")} aria-label="Kembali ke toko"><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></button>
      <nav className={`main-nav ${showMobileMenu ? "is-open" : ""}`}><button className={activePage === "store" ? "active" : ""} onClick={() => navigate("store")}>Store</button><button className={activePage === "orders" ? "active" : ""} onClick={() => navigate("orders")}>Pesanan</button><button className={activePage === "help" ? "active" : ""} onClick={() => navigate("help")}>Bantuan</button></nav>
      <div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={17} /></button><button className="avatar-button" onClick={() => navigate("admin")} aria-label="Buka panel admin">CX</button><button className="mobile-menu-button" onClick={() => setShowMobileMenu((open) => !open)} aria-label="Buka menu"><Menu size={20} /></button></div>
    </div></header>

    {activePage === "store" && <main>
      <section className="hero container"><div className="hero-copy"><p className="section-kicker">CODEXA ACCESS</p><h1>Akun digital,<br /><em>tanpa drama.</em></h1><p className="hero-lede">Katalog ini terhubung ke data akun nyata. Tidak ada akun contoh atau stok palsu yang ditampilkan.</p><button className="primary-button" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>Lihat katalog <ArrowRight size={15} /></button></div><div className="hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><span className="hero-star">✦</span><div className="hero-card"><span>LIVE DATA</span><strong>NEON DB</strong><small>NO MOCK ACCOUNTS</small></div></div></section>
      <section className="container catalog-section" id="catalog"><div className="section-heading"><div><p className="section-kicker">CATALOG</p><h2>Akun yang tersedia.</h2></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari akun..." /></label></div>{data.loading ? <DataState message="Mengambil data dari Neon..." /> : data.error ? <DataState message={data.error} error /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={() => showNotice("Checkout tersedia setelah alur pembayaran akun diaktifkan.")} />)}</div> : <div className="empty-state"><Package size={24} /><h3>Belum ada akun tersedia</h3><p>Belum ada produk nyata di database. Panel tidak menampilkan akun contoh.</p></div>}</section>
    </main>}
    {activePage === "orders" && <OrdersPage orders={data.orders} loading={data.loading} onBack={() => navigate("store")} />}
    {activePage === "help" && <HelpPage onBack={() => navigate("store")} />}
    {activePage === "admin" && <AdminPage data={data} onBack={() => navigate("store")} onNotice={showNotice} />}
    <footer className="footer"><div className="container footer-inner"><div className="brand footer-brand"><span className="brand-mark">&lt;/&gt;</span><span>Code<span className="brand-dot">Xa</span></span></div><p>Data akun terhubung ke Neon Database.</p><div className="footer-links"><button onClick={() => navigate("help")}>Bantuan</button><button onClick={() => navigate("orders")}>Pesanan</button></div></div></footer>
    {notice && <div className="toast"><Check size={16} />{notice}</div>}<button className="admin-shortcut" onClick={() => navigate("admin")}><LayoutDashboard size={14} /> Admin</button>
  </div>;
}

function DataState({ message, error = false }) { return <div className="empty-state"><CircleHelp size={24} /><h3>{error ? "Data belum bisa dimuat" : "Memuat data nyata"}</h3><p>{message}</p></div>; }
function ProductCard({ product, onAdd }) { return <article className={`product-card ${product.accent || "violet"}`}><div className="product-visual"><div className="visual-label">{product.type || "Akun"}</div><div className="visual-monogram">{product.initials || "CX"}</div><span className="visual-small">CODEXA<br /><b>ACCESS</b></span></div><div className="product-content"><div className="product-meta"><span className="product-type">{product.type || "Akun"}</span><span className="stock-dot"><i />{product.stock ?? 0} tersisa</span></div><h3>{product.title}</h3><p>{product.description || "Akun nyata dari katalog CodeXa."}</p><div className="product-bottom"><strong>{formatPrice(Number(product.price) || 0)}</strong><button className="round-add" onClick={onAdd} aria-label={`Pilih ${product.title}`}><ShoppingBag size={17} /></button></div></div></article>; }
function OrdersPage({ orders, loading, onBack }) { return <main className="page-container container"><div className="page-top"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">AREA PEMBELI</p><h1>Pesanan saya.</h1><p className="page-lede">Riwayat pesanan dari database nyata.</p></div><div className="orders-layout"><div className="orders-list"><div className="subheading"><h2>Riwayat pesanan</h2><span>{loading ? "..." : `${orders.length} pesanan`}</span></div>{orders.length ? orders.map((order) => <div className="order-row" key={order.id}><div className="order-icon"><Package size={17} /></div><div className="order-info"><div><strong>{order.product}</strong><span className="status pending">{order.status}</span></div><p>{order.id} · {order.date}</p><b>{formatPrice(Number(order.total) || 0)}</b></div><ChevronRight size={16} /></div>) : <div className="empty-state"><Package size={24} /><h3>Belum ada pesanan</h3><p>Riwayat akan muncul setelah ada transaksi nyata.</p></div>}</div></div></main>; }
function HelpPage({ onBack }) { return <main className="page-container container"><div className="page-top"><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">SUPPORT</p><h1>Kami siap bantu.</h1><p className="page-lede">Hubungi support jika ada pertanyaan soal akun atau pesanan.</p></div><div className="help-grid"><div className="help-card dark"><Headphones size={24} /><h3>Butuh bantuan?</h3><p>Tim support akan membantu setelah ada kanal kontak yang dikonfigurasi.</p></div></div></main>; }

function AdminPage({ data, onBack, onNotice }) {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionId, setActionId] = useState("");
  const [apiError, setApiError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    setLoadingUsers(true);
    setApiError("");
    fetch("/api/admin/users", { credentials: "same-origin" }).then(async (result) => {
      const payload = await result.json();
      if (result.status === 401) { setAuthenticated(false); throw new Error("Sesi admin sudah berakhir"); }
      if (!result.ok) throw new Error(payload.error || "Akun tidak bisa dimuat");
      return payload.users || [];
    }).then(setUsers).catch((error) => setApiError(error.message)).finally(() => setLoadingUsers(false));
  };
  useEffect(() => {
    fetch("/api/admin/login", { credentials: "same-origin" }).then((result) => result.json()).then((payload) => { setAuthenticated(payload.authenticated); if (payload.authenticated) loadUsers(); }).catch(() => setAuthenticated(false));
  }, []);
  const login = async (event) => {
    event.preventDefault(); setLoginError("");
    const result = await fetch("/api/admin/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const payload = await result.json();
    if (!result.ok) return setLoginError(payload.error || "Login gagal");
    setPassword(""); setAuthenticated(true); loadUsers();
  };
  const logout = async () => { await fetch("/api/admin/login", { method: "DELETE", credentials: "same-origin" }); setAuthenticated(false); setUsers([]); };
  const openForm = (user = null) => setForm(user ? { id: user.id, name: user.name || "", email: user.email || "", role: user.role || "user", banned: Boolean(user.banned) } : { name: "", email: "", role: "user", banned: false });
  const closeForm = () => { if (!saving) setForm(null); };
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const saveUser = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true); setApiError("");
    const isEdit = Boolean(form.id);
    const result = await fetch("/api/admin/users", {
      method: isEdit ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await result.json();
    if (!result.ok) {
      setApiError(payload.error || "Akun gagal disimpan");
      setSaving(false);
      return;
    }
    setUsers((current) => isEdit ? current.map((item) => item.id === payload.user.id ? payload.user : item) : [payload.user, ...current]);
    setForm(null); setSaving(false);
    onNotice(isEdit ? "Perubahan akun disimpan" : "Profil akun dibuat");
  };
  const toggleUser = async (user) => {
    setActionId(user.id); setApiError("");
    const result = await fetch("/api/admin/users", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role || "user", banned: !user.banned }) });
    const payload = await result.json();
    if (!result.ok) setApiError(payload.error || "Status akun gagal diubah"); else { setUsers((current) => current.map((item) => item.id === user.id ? payload.user : item)); onNotice(user.banned ? "Akun diaktifkan" : "Akun dinonaktifkan"); }
    setActionId("");
  };
  const deleteUser = async (user) => {
    if (!window.confirm(`Hapus akun ${user.email}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionId(user.id); setApiError("");
    const result = await fetch("/api/admin/users", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id }) });
    const payload = await result.json();
    if (!result.ok) setApiError(payload.error || "Akun gagal dihapus");
    else { setUsers((current) => current.filter((item) => item.id !== user.id)); onNotice("Akun dihapus"); }
    setActionId("");
  };
  const filteredUsers = users.filter((user) => {
    const matchesSearch = `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? !user.banned : user.banned);
    return matchesSearch && matchesStatus;
  });

  if (authenticated === null) return <main className="page-container container"><DataState message="Memeriksa akses admin..." /></main>;
  if (!authenticated) return <main className="page-container container"><div style={{ maxWidth: 460, margin: "70px auto" }}><div className="admin-panel" style={{ padding: 32 }}><div className="page-top" style={{ marginBottom: 24 }}><ShieldCheck size={28} /><p className="section-kicker">ADMIN CODEXA</p><h1>Masuk ke panel.</h1><p className="page-lede">Panel ini dilindungi password dan menampilkan akun nyata dari Neon.</p></div><form onSubmit={login}><label className="custom-input"><span>Password admin</span><div><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required /></div></label>{loginError && <p style={{ color: "#ff8f9a" }}>{loginError}</p>}<button className="primary-button full-button" type="submit">Masuk ke admin <LogIn size={15} /></button></form><button className="back-link" onClick={onBack} style={{ marginTop: 18 }}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button></div></div></main>;

  return <main className="page-container container"><div className="page-top"><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}><div><button className="back-link" onClick={onBack}><ArrowRight size={14} className="back-arrow" /> Kembali ke store</button><p className="section-kicker">ADMIN CODEXA / AKUN</p><h1>Panel akun nyata.</h1><p className="page-lede">Kelola profil, role, dan status akun dari database Neon. Password dan token tidak pernah ditampilkan.</p></div><div className="admin-header-actions"><button className="secondary-button" onClick={logout}><LogOut size={15} /> Keluar</button><button className="primary-button" onClick={() => openForm()}><Plus size={15} /> Buat akun</button></div></div></div>
    <div className="admin-stats"><StatCard label="Pelanggan terdaftar" value={data.loading ? "..." : data.customerCount} change="Akun nyata" icon={Users} color="violet" /><StatCard label="Akun ditemukan" value={loadingUsers ? "..." : users.length} change="Neon Auth" icon={BadgeCheck} color="mint" /><StatCard label="Status aktif" value={loadingUsers ? "..." : users.filter((user) => !user.banned).length} change="Bisa login" icon={UserCheck} color="coral" /><StatCard label="Nonaktif" value={loadingUsers ? "..." : users.filter((user) => user.banned).length} change="Perlu perhatian" icon={UserX} color="gold" /></div>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Daftar akun</h2><p>{filteredUsers.length} dari {users.length} akun nyata dari Neon Auth</p></div><div className="admin-toolbar"><label className="search-box"><Search size={16} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Cari nama/email..." /></label><select className="admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status"><option value="all">Semua status</option><option value="active">Aktif</option><option value="banned">Nonaktif</option></select><button className="icon-button" onClick={loadUsers} aria-label="Muat ulang"><RefreshCw size={16} /></button></div></div>{apiError && <p className="admin-error">{apiError}</p>}{loadingUsers ? <DataState message="Mengambil daftar akun..." /> : filteredUsers.length ? <div className="admin-orders-table"><div className="table-header"><span>Akun</span><span>Role</span><span>Dibuat</span><span>Status</span><span>Aksi</span></div>{filteredUsers.map((user) => <div className="table-row" key={user.id}><span data-label="Akun"><strong>{user.name || "Tanpa nama"}</strong><small>{user.email}</small></span><span data-label="Role"><b className="role-badge">{user.role || "user"}</b></span><span data-label="Dibuat">{formatDate(user.createdAt)}</span><span data-label="Status"><b className={`status ${user.banned ? "pending" : "success"}`}>{user.banned ? "Nonaktif" : "Aktif"}</b></span><span data-label="Aksi" className="row-actions"><button className="table-action" disabled={actionId === user.id} onClick={() => openForm(user)} aria-label={`Edit ${user.email}`}><Pencil size={14} /></button><button className="table-action" disabled={actionId === user.id} onClick={() => toggleUser(user)} title={user.banned ? "Aktifkan" : "Nonaktifkan"}>{user.banned ? <UserCheck size={14} /> : <UserX size={14} />}</button><button className="table-action danger" disabled={actionId === user.id} onClick={() => deleteUser(user)} aria-label={`Hapus ${user.email}`}><Trash2 size={14} /></button></span></div>)}</div> : <div className="empty-state"><UserRound size={24} /><h3>Belum ada akun</h3><p>Tidak ada akun nyata yang cocok dengan pencarian.</p></div>}</section>
    {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeForm()}><form className="admin-form modal" onSubmit={saveUser} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={closeForm} aria-label="Tutup"><X size={16} /></button><div className="admin-form-heading"><p className="section-kicker">{form.id ? "EDIT AKUN" : "AKUN BARU"}</p><h2>{form.id ? "Edit profil akun." : "Buat profil akun."}</h2><p>{form.id ? "Perbarui data profil dan hak akses akun nyata." : "Profil dibuat di database Neon. Kredensial login tetap dikelola oleh provider Auth."}</p></div><label className="custom-input"><span>Nama</span><div><UserRound size={16} /><input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nama pengguna" required maxLength={120} /></div></label><label className="custom-input"><span>Email</span><div><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="nama@email.com" required maxLength={320} /></div></label><label className="custom-input"><span>Role</span><div><select value={form.role} onChange={(event) => updateForm("role", event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></div></label>{form.id && <label className="admin-checkbox"><input type="checkbox" checked={!form.banned} onChange={(event) => updateForm("banned", !event.target.checked)} /> Akun aktif dan boleh login</label>}<div className="admin-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan..." : <><Check size={15} /> Simpan akun</>}</button></div></form></div>}
  </main>;
}

function StatCard({ label, value, change, icon: Icon, color }) { return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={16} /></div><span>{label}</span><strong>{value}</strong><small>{change}</small></div>; }
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);