import React, { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import {
  LayoutDashboard, ArrowLeftRight, WalletCards, Target, BarChart3,
  LogOut, Plus, Search, Trash2, Pencil, X, PiggyBank, TrendingUp,
  TrendingDown, CalendarDays, CircleUserRound, Menu, ChevronRight
} from "lucide-react";

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));

const dateLabel = (value) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const navItems = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["transactions", "Transaksi", ArrowLeftRight],
  ["budgets", "Anggaran", WalletCards],
  ["wishlist", "Wishlist", Target],
  ["reports", "Laporan", BarChart3],
];

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="screen-center"><div className="spinner" /></div>;
  if (!isSupabaseConfigured) return <SetupScreen />;
  if (!session) return <Auth />;

  return <FinanceApp session={session} />;
}

function SetupScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-card setup-card">
        <div className="brand brand-center"><div className="brand-mark">₿</div><div><b>SiHago</b><small>Keuangan Pribadi</small></div></div>
        <h1>Hubungkan Supabase</h1>
        <p>Isi file <code>.env</code> dengan URL project dan anon key Supabase, lalu jalankan ulang aplikasi.</p>
        <pre>{`VITE_SUPABASE_URL=https://xxx.supabase.co\nVITE_SUPABASE_ANON_KEY=ey...`}</pre>
        <p className="muted">Setelah itu jalankan SQL pada <code>supabase/schema.sql</code>.</p>
      </div>
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { full_name: form.name } }
        });
        if (error) throw error;
        setMessage(data.session ? "Akun berhasil dibuat." : "Akun dibuat. Cek email untuk verifikasi, jika verifikasi diaktifkan.");
        if (!data.session) setMode("login");
      }
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-logo">SiHago</div>
        <h1>Catat uangmu.<br /><span>Kelola hidupmu.</span></h1>
        <p>Kelola pemasukan, pengeluaran, anggaran, dan wishlist dalam satu tempat.</p>
        <div className="visual-card"><TrendingUp size={24}/><div><b>Keuangan lebih terarah</b><small>Lihat kondisi keuanganmu dengan cepat.</small></div></div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><div className="brand-mark">₿</div><b>SiHago</b></div>
          <h2>{mode === "login" ? "Selamat datang kembali" : "Buat akun SiHago"}</h2>
          <p className="muted">{mode === "login" ? "Masuk untuk melanjutkan pencatatan keuangan." : "Mulai kelola keuangan pribadimu."}</p>
          <form onSubmit={submit}>
            {mode === "register" && <Field label="Nama lengkap" value={form.name} onChange={v => setForm({...form, name:v})} placeholder="Nama kamu" />}
            <Field label="Email" type="email" value={form.email} onChange={v => setForm({...form, email:v})} placeholder="nama@email.com" />
            <Field label="Password" type="password" value={form.password} onChange={v => setForm({...form, password:v})} placeholder="Minimal 6 karakter" />
            {message && <div className="alert">{message}</div>}
            <button className="primary-btn full" disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}</button>
          </form>
          <div className="auth-switch">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button onClick={() => {setMode(mode==="login"?"register":"login");setMessage("")}}>{mode === "login" ? "Daftar sekarang" : "Masuk"}</button></div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", placeholder }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required /></label>;
}

function FinanceApp({ session }) {
  const [page, setPage] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [wishlists, setWishlists] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    const uid = session.user.id;
    const [p,t,b,w] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", uid).order("transaction_date", {ascending:false}).order("created_at", {ascending:false}),
      supabase.from("budgets").select("*").eq("user_id", uid).order("month", {ascending:false}),
      supabase.from("wishlists").select("*").eq("user_id", uid).order("created_at", {ascending:false}),
    ]);
    setProfile(p.data); setTransactions(t.data || []); setBudgets(b.data || []); setWishlists(w.data || []);
    setBusy(false);
  };
  useEffect(()=>{load()},[session.user.id]);

  const logout = async () => await supabase.auth.signOut();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand"><div className="brand-mark">₿</div><div><b>SiHago</b><small>Keuangan Pribadi</small></div></div>
          <button className="mobile-close" onClick={()=>setMobileOpen(false)}><X/></button>
        </div>
        <nav>{navItems.map(([id,label,Icon]) =>
          <button key={id} className={`nav-item ${page===id?"active":""}`} onClick={()=>{setPage(id);setMobileOpen(false)}}><Icon size={20}/><span>{label}</span></button>
        )}</nav>
        <div className="sidebar-bottom">
          <div className="account"><div className="avatar">{(profile?.full_name || session.user.email || "P")[0].toUpperCase()}</div><div className="account-text"><b>{profile?.full_name || "Pengguna"}</b><small>{session.user.email}</small></div><CircleUserRound size={18}/></div>
          <button className="logout" onClick={logout}><LogOut size={19}/> Keluar</button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="hamburger" onClick={()=>setMobileOpen(true)}><Menu/></button>
          <div><h1>{navItems.find(x=>x[0]===page)?.[1]}</h1><p>{new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</p></div>
          <button className="add-btn" onClick={()=>setModal({type:"transaction"})}><Plus size={18}/> Tambah</button>
        </header>

        {busy ? <div className="loading-box"><div className="spinner"/> Memuat data...</div> :
          page==="dashboard" ? <Dashboard transactions={transactions} budgets={budgets} wishlists={wishlists} onAdd={()=>setModal({type:"transaction"})} /> :
          page==="transactions" ? <Transactions data={transactions} refresh={load} openModal={setModal} /> :
          page==="budgets" ? <Budgets data={budgets} transactions={transactions} refresh={load} openModal={setModal} /> :
          page==="wishlist" ? <Wishlists data={wishlists} refresh={load} openModal={setModal} /> :
          <Reports transactions={transactions} />
        }
      </main>
      {modal && <Modal type={modal.type} item={modal.item} close={()=>setModal(null)} refresh={load} uid={session.user.id} />}
    </div>
  );
}

function Dashboard({transactions,budgets,wishlists,onAdd}) {
  const income = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0);
  const balance = income-expense;
  const recent = transactions.slice(0,5);
  const expenseByCat = Object.entries(transactions.filter(t=>t.type==="expense").reduce((a,t)=>(a[t.category]=(a[t.category]||0)+Number(t.amount),a),{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return <div className="content">
    <section className="hero">
      <div className="hero-main"><span><PiggyBank size={18}/> Saldo Keseluruhan</span><strong>{rupiah(balance)}</strong><small>Total semua pemasukan dikurangi pengeluaran</small></div>
      <div className="hero-grid">
        <Stat icon={<TrendingUp/>} label="Masuk" value={rupiah(income)} sub={`${transactions.filter(t=>t.type==="income").length} transaksi`} />
        <Stat icon={<TrendingDown/>} label="Keluar" value={rupiah(expense)} sub={`${transactions.filter(t=>t.type==="expense").length} transaksi`} />
        <Stat icon={<WalletCards/>} label="Bulan Ini" value={`${balance>=0?"+":""}${rupiah(balance)}`} sub={balance>=0?"Surplus":"Defisit"} />
      </div>
    </section>
    <div className="grid-two">
      <Panel title="Arus Kas Terbaru" action={transactions.length ? "Lihat semua" : null}>
        {recent.length ? <div className="transaction-list">{recent.map(t=><TransactionRow key={t.id} t={t}/>)}</div> : <Empty icon={<ArrowLeftRight/>} text="Belum ada data transaksi bulan ini" button="Tambah transaksi" onClick={onAdd}/>}
      </Panel>
      <Panel title="Pengeluaran per Kategori">
        {expenseByCat.length ? <div className="category-list">{expenseByCat.map(([cat,val])=><div className="cat-row" key={cat}><span>{cat}</span><b>{rupiah(val)}</b><div className="progress"><i style={{width:`${Math.max(8,val/expense*100)}%`}}/></div></div>)}</div> : <Empty icon={<BarChart3/>} text="Belum ada pengeluaran"/>}
      </Panel>
    </div>
    <div className="grid-two lower">
      <Panel title="Status Anggaran">
        {budgets.length ? budgets.slice(0,3).map(b=><BudgetMini key={b.id} b={b} transactions={transactions}/>) : <Empty icon={<WalletCards/>} text="Belum ada anggaran" />}
      </Panel>
      <Panel title="Wishlist">
        {wishlists.length ? wishlists.slice(0,3).map(w=><WishlistMini key={w.id} w={w}/>) : <Empty icon={<Target/>} text="Belum ada wishlist" />}
      </Panel>
    </div>
  </div>;
}

function Stat({icon,label,value,sub}) { return <div className="stat"><span>{icon}{label}</span><b>{value}</b><small>{sub}</small></div> }
function Panel({title,children,action}) { return <section className="panel"><div className="panel-head"><h2>{title}</h2>{action&&<button className="text-btn">{action}<ChevronRight size={15}/></button>}</div>{children}</section> }
function Empty({icon,text,button,onClick}) { return <div className="empty"><div className="empty-icon">{icon}</div><p>{text}</p>{button&&<button className="primary-btn small" onClick={onClick}><Plus size={15}/>{button}</button>}</div> }
function TransactionRow({t}) { return <div className="tx-row"><div className={`tx-icon ${t.type}`}>{t.type==="income"?<TrendingUp/>:<TrendingDown/>}</div><div className="tx-info"><b>{t.title}</b><small>{t.category} · {dateLabel(t.transaction_date)}</small></div><strong className={t.type}>{t.type==="income"?"+":"-"}{rupiah(t.amount)}</strong></div> }
function BudgetMini({b,transactions}) { const used=transactions.filter(t=>t.type==="expense"&&t.category===b.category&&t.transaction_date?.slice(0,7)===b.month?.slice(0,7)).reduce((s,t)=>s+Number(t.amount),0); const p=Math.min(100,used/Number(b.amount)*100); return <div className="mini-item"><div><b>{b.category}</b><span>{rupiah(used)} / {rupiah(b.amount)}</span></div><div className="progress"><i style={{width:`${p}%`}}/></div> }
function WishlistMini({w}) { const p=Math.min(100,Number(w.saved_amount)/Number(w.target_amount)*100); return <div className="mini-item"><div><b>{w.name}</b><span>{Math.round(p)}%</span></div><div className="progress"><i style={{width:`${p}%`}}/></div> }

function Transactions({data,refresh,openModal}) {
  const [q,setQ]=useState("");
  const filtered=data.filter(t=>`${t.title} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="content"><div className="page-actions"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari transaksi..." /></div><button className="primary-btn" onClick={()=>openModal({type:"transaction"})}><Plus size={17}/> Tambah transaksi</button></div>
    <Panel title={`Semua Transaksi (${filtered.length})`}>{filtered.length?<div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Kategori</th><th>Jenis</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td>{dateLabel(t.transaction_date)}</td><td><b>{t.title}</b>{t.notes&&<small>{t.notes}</small>}</td><td>{t.category}</td><td><span className={`badge ${t.type}`}>{t.type==="income"?"Pemasukan":"Pengeluaran"}</span></td><td className={`money ${t.type}`}>{t.type==="income"?"+":"-"}{rupiah(t.amount)}</td><td><button className="icon-btn" onClick={()=>openModal({type:"transaction",item:t})}><Pencil size={16}/></button><DeleteButton table="transactions" id={t.id} refresh={refresh}/></td></tr>)}</tbody></table></div>:<Empty icon={<ArrowLeftRight/>} text="Belum ada transaksi." button="Tambah transaksi" onClick={()=>openModal({type:"transaction"})}/>}</Panel>
  </div>
}

function Budgets({data,transactions,refresh,openModal}) {
  return <div className="content"><div className="page-actions"><div><h2 className="section-title">Anggaran bulanan</h2><p className="muted">Atur batas pengeluaran per kategori.</p></div><button className="primary-btn" onClick={()=>openModal({type:"budget"})}><Plus size={17}/> Tambah anggaran</button></div>
    <div className="card-grid">{data.map(b=>{const used=transactions.filter(t=>t.type==="expense"&&t.category===b.category&&t.transaction_date?.slice(0,7)===b.month?.slice(0,7)).reduce((s,t)=>s+Number(t.amount),0); const p=Math.min(100,used/Number(b.amount)*100); return <div className="info-card" key={b.id}><div className="card-top"><div className="round-icon"><WalletCards/></div><DeleteButton table="budgets" id={b.id} refresh={refresh}/></div><h3>{b.category}</h3><small>{b.month?.slice(0,7)}</small><div className="big-number">{rupiah(b.amount)}</div><div className="progress"><i style={{width:`${p}%`}}/></div><div className="split"><span>Terpakai {rupiah(used)}</span><b>{Math.round(p)}%</b></div></div>})}</div>
    {!data.length&&<Panel title="Anggaran"><Empty icon={<WalletCards/>} text="Belum ada anggaran."/></Panel>}
  </div>
}

function Wishlists({data,refresh,openModal}) {
  return <div className="content"><div className="page-actions"><div><h2 className="section-title">Wishlist</h2><p className="muted">Simpan target barang atau impianmu.</p></div><button className="primary-btn" onClick={()=>openModal({type:"wishlist"})}><Plus size={17}/> Tambah wishlist</button></div>
    <div className="card-grid">{data.map(w=>{const p=Math.min(100,Number(w.saved_amount)/Number(w.target_amount)*100);return <div className="info-card" key={w.id}><div className="card-top"><div className="round-icon"><Target/></div><DeleteButton table="wishlists" id={w.id} refresh={refresh}/></div><h3>{w.name}</h3><small>{w.target_date?`Target ${dateLabel(w.target_date)}`:"Tanpa tanggal target"}</small><div className="big-number">{rupiah(w.target_amount)}</div><div className="progress"><i style={{width:`${p}%`}}/></div><div className="split"><span>Terkumpul {rupiah(w.saved_amount)}</span><b>{Math.round(p)}%</b></div></div>})}</div>
    {!data.length&&<Panel title="Wishlist"><Empty icon={<Target/>} text="Belum ada wishlist."/></Panel>}
  </div>
}

function Reports({transactions}) {
  const income=transactions.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0);
  const expense=transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0);
  const cats=Object.entries(transactions.filter(t=>t.type==="expense").reduce((a,t)=>(a[t.category]=(a[t.category]||0)+Number(t.amount),a),{})).sort((a,b)=>b[1]-a[1]);
  return <div className="content"><div className="report-summary"><div><span>Total pemasukan</span><b className="income">{rupiah(income)}</b></div><div><span>Total pengeluaran</span><b className="expense">{rupiah(expense)}</b></div><div><span>Selisih</span><b>{rupiah(income-expense)}</b></div></div><Panel title="Ringkasan Pengeluaran"><div className="report-bars">{cats.length?cats.map(([c,v])=><div className="bar-row" key={c}><div><span>{c}</span><b>{rupiah(v)}</b></div><div className="progress"><i style={{width:`${Math.max(5,v/(cats[0][1])*100)}%`}}/></div></div>):<Empty icon={<BarChart3/>} text="Belum ada data laporan."/>}</div></Panel></div>
}

function DeleteButton({table,id,refresh}) {
  const del=async()=>{if(confirm("Hapus data ini?")){await supabase.from(table).delete().eq("id",id);refresh();}};
  return <button className="icon-btn danger" onClick={del}><Trash2 size={16}/></button>
}

function Modal({type,item,close,refresh,uid}) {
  const isTx=type==="transaction";
  const [form,setForm]=useState(item ? {...item} : isTx ? {type:"expense",title:"",category:"Makanan",amount:"",transaction_date:new Date().toISOString().slice(0,10),notes:""} : type==="budget" ? {category:"Makanan",amount:"",month:new Date().toISOString().slice(0,7)+"-01"} : {name:"",target_amount:"",saved_amount:"0",target_date:""});
  const [busy,setBusy]=useState(false); const set=(k,v)=>setForm({...form,[k]:v});
  const submit=async(e)=>{e.preventDefault();setBusy(true);
    let table=isTx?"transactions":type==="budget"?"budgets":"wishlists";
    let payload=isTx?{user_id:uid,type:form.type,title:form.title,category:form.category,amount:Number(form.amount),transaction_date:form.transaction_date,notes:form.notes||null}:type==="budget"?{user_id:uid,category:form.category,amount:Number(form.amount),month:form.month}:{user_id:uid,name:form.name,target_amount:Number(form.target_amount),saved_amount:Number(form.saved_amount||0),target_date:form.target_date||null};
    const query=item ? supabase.from(table).update(payload).eq("id",item.id) : supabase.from(table).insert(payload);
    const {error}=await query;if(error) alert(error.message); else {await refresh();close();} setBusy(false);
  };
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-head"><div><h2>{item?"Edit":"Tambah"} {isTx?"Transaksi":type==="budget"?"Anggaran":"Wishlist"}</h2><p className="muted">Data akan disimpan ke Supabase.</p></div><button className="icon-btn" onClick={close}><X/></button></div><form onSubmit={submit}>
    {isTx ? <><div className="segmented"><button type="button" className={form.type==="expense"?"selected":""} onClick={()=>set("type","expense")}>Pengeluaran</button><button type="button" className={form.type==="income"?"selected":""} onClick={()=>set("type","income")}>Pemasukan</button></div><Field label="Nama transaksi" value={form.title} onChange={v=>set("title",v)} placeholder="Contoh: Makan siang"/><div className="form-grid"><Field label="Jumlah" type="number" value={form.amount} onChange={v=>set("amount",v)} placeholder="50000"/><Field label="Tanggal" type="date" value={form.transaction_date} onChange={v=>set("transaction_date",v)} /></div><label className="field"><span>Kategori</span><select value={form.category} onChange={e=>set("category",e.target.value)}>{["Makanan","Transportasi","Belanja","Tagihan","Hiburan","Kesehatan","Pendidikan","Gaji","Bonus","Investasi","Lainnya"].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Catatan</span><textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Opsional"/></label></> :
    type==="budget" ? <><Field label="Kategori" value={form.category} onChange={v=>set("category",v)} placeholder="Makanan"/><div className="form-grid"><Field label="Batas anggaran" type="number" value={form.amount} onChange={v=>set("amount",v)} placeholder="1000000"/><Field label="Bulan" type="month" value={form.month?.slice(0,7)} onChange={v=>set("month",v+"-01")} /></div></> :
    <><Field label="Nama target" value={form.name} onChange={v=>set("name",v)} placeholder="Contoh: Laptop baru"/><Field label="Target harga" type="number" value={form.target_amount} onChange={v=>set("target_amount",v)} placeholder="10000000"/><Field label="Sudah terkumpul" type="number" value={form.saved_amount} onChange={v=>set("saved_amount",v)} placeholder="0"/><Field label="Tanggal target" type="date" value={form.target_date||""} onChange={v=>set("target_date",v)} /></>}
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Batal</button><button className="primary-btn" disabled={busy}>{busy?"Menyimpan...":"Simpan"}</button></div>
  </form></div></div>
}

export default App;