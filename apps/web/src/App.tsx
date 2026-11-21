import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness, ChartNoAxesCombined, CircleDollarSign, LogOut, Menu, Search, Settings, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { supabase } from "./lib/supabase";

type Stock = { symbol: string; name: string; price: number; change_percent: number };
type Account = { id: string; display_name: string | null; cash_balance: number };
const demoStocks: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 231.42, change_percent: 1.82 },
  { symbol: "MSFT", name: "Microsoft", price: 415.36, change_percent: 0.74 },
  { symbol: "NVDA", name: "NVIDIA", price: 138.85, change_percent: 3.21 },
  { symbol: "AMZN", name: "Amazon", price: 218.94, change_percent: -0.62 },
  { symbol: "GOOGL", name: "Alphabet", price: 192.18, change_percent: 1.14 },
  { symbol: "TSLA", name: "Tesla", price: 338.11, change_percent: -1.37 }
];
const chartData = Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, value: 100000 + Math.sin(i / 2.8) * 2200 + i * 185 + Math.cos(i) * 700 }));
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export default function App() {
  const [stocks, setStocks] = useState(demoStocks);
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Stock>(demoStocks[0]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(1);
  const [cash, setCash] = useState(100000);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    fetch(import.meta.env.VITE_API_URL + "/api/account", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null).then(v => { if (v?.account) { setAccount(v.account); setCash(Number(v.account.cash_balance)); } }).catch(() => {});
  }, [session]);

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL;
    if (!api) return;
    fetch(api + "/api/market").then(r => r.ok ? r.json() : null).then(v => { if (v?.stocks?.length) setStocks(v.stocks); }).catch(() => {});
  }, []);

  const filtered = useMemo(() => stocks.filter(s => (s.symbol + " " + s.name).toLowerCase().includes(query.toLowerCase())), [stocks, query]);
  const signIn = async (create: boolean) => {
    if (!supabase) { setNotice("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable accounts."); return; }
    setBusy(true);
    const result = create ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false); setNotice(result.error?.message ?? (create ? "Check your email to confirm your account." : "Signed in."));
    if (!result.error) setAuthOpen(false);
  };
  const trade = async () => {
    if (!session) { setAuthOpen(true); setNotice("Sign in to place a simulated trade."); return; }
    setBusy(true);
    try {
      const r = await fetch(import.meta.env.VITE_API_URL + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ symbol: selected.symbol, side, quantity }) });
      const v = await r.json(); setNotice(r.ok ? `${side.toUpperCase()} order filled: ${quantity} ${selected.symbol}` : (v.error ?? "Order failed"));
      if (r.ok) { const a = await fetch(import.meta.env.VITE_API_URL + "/api/account", { headers: { Authorization: `Bearer ${session.access_token}` } }).then(x => x.json()); setAccount(a.account); setCash(Number(a.account.cash_balance)); }
    } catch { setNotice("Cannot reach the API. Check that the backend is running."); }
    finally { setBusy(false); }
  };

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={21}/></span><span>stock<span className="accent">sim</span></span></div>
      <div className="workspace"><span className="avatar">S</span><div><b>Paper Trading</b><small>Practice portfolio</small></div></div>
      <p className="nav-label">WORKSPACE</p><a className="nav-item active"><Activity size={17}/> Overview</a><a className="nav-item"><ChartNoAxesCombined size={17}/> Markets</a><a className="nav-item"><BriefcaseBusiness size={17}/> Portfolio</a><a className="nav-item"><Wallet size={17}/> Transactions</a>
      <p className="nav-label">PREFERENCES</p><a className="nav-item"><Settings size={17}/> Settings</a><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleDollarSign size={18}/></div><b>Learn by doing.</b><p>Practice your strategy with $100,000 in virtual cash.</p></div><small>STOCKSIM · SIMULATED MARKET</small></div>
    </aside>
    <main className="main"><header className="topbar"><button className="icon-btn mobile-menu"><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><button className="icon-btn"><Bell size={18}/></button>{session ? <button className="profile" onClick={() => supabase?.auth.signOut()}><span className="avatar">{(session.user.email?.[0] ?? "U").toUpperCase()}</span><span>{session.user.email}</span><LogOut size={15}/></button> : <button className="primary small" onClick={() => setAuthOpen(true)}>Sign in</button>}</div></header>
      <section className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> MARKET SIMULATOR</div><h1>Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, investor.</h1><p>Here's what's happening with your virtual portfolio today.</p></div><div className="market-status"><span className="live-dot"/> Simulation market <b>Open</b></div></section>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice} <span>×</span></div>}
      <section className="stats-grid"><Stat icon={<Wallet/>} label="Available cash" value={money(cash)} hint="Virtual buying power"/><Stat icon={<BriefcaseBusiness/>} label="Portfolio value" value={money(0)} hint="Your holdings"/><Stat icon={<ChartNoAxesCombined/>} label="Total return" value="$0.00" hint="0.00% all time" positive/><Stat icon={<Activity/>} label="Total equity" value={money(cash)} hint="Cash + holdings"/></section>
      <section className="content-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>Portfolio performance</h2><p>Track your simulated account value</p></div><span className="period-pill">1D <span>⌄</span></span></div><div className="chart-total">{money(cash)} <span className="positive-text">+$0.00 (0.00%)</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36d6a0" stopOpacity={0.25}/><stop offset="100%" stopColor="#36d6a0" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#202b3b" vertical={false}/><XAxis dataKey="time" tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} interval={4}/><Tooltip contentStyle={{ background: "#111a29", border: "1px solid #263449", borderRadius: 10 }}/><Area type="monotone" dataKey="value" stroke="#36d6a0" strokeWidth={2} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div></div>
        <div className="panel trade-panel"><div className="panel-head"><div><h2>Quick trade</h2><p>Place a simulated market order</p></div><span className="trade-icon"><ArrowUpRight size={18}/></span></div><label>STOCK</label><select value={selected.symbol} onChange={e => setSelected(stocks.find(s => s.symbol === e.target.value) ?? stocks[0])}>{stocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} · {s.name}</option>)}</select><div className="selected-price"><b>{money(Number(selected.price))}</b><span className={selected.change_percent >= 0 ? "positive-text" : "negative-text"}>{selected.change_percent >= 0 ? "+" : ""}{selected.change_percent}% today</span></div><div className="side-toggle"><button className={side === "buy" ? "chosen buy" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "chosen sell" : ""} onClick={() => setSide("sell")}>Sell</button></div><label>QUANTITY</label><div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}/><button onClick={() => setQuantity(Math.min(100000, quantity + 1))}>+</button></div><div className="order-estimate"><span>Estimated total</span><b>{money(Number(selected.price) * quantity)}</b></div><button className={side === "buy" ? "primary trade-submit" : "danger trade-submit"} disabled={busy} onClick={trade}>{busy ? "Processing..." : `${side === "buy" ? "Buy" : "Sell"} ${selected.symbol}`}</button><small className="disclaimer">Virtual trades only. No real money or securities are involved.</small></div></section>
      <section className="panel market-panel"><div className="panel-head market-head"><div><h2>Market watch</h2><p>Popular stocks in your watchlist</p></div><div className="search-box"><Search size={16}/><input placeholder="Search stocks..." value={query} onChange={e => setQuery(e.target.value)}/></div></div><div className="table-scroll"><table><thead><tr><th>ASSET</th><th>LAST PRICE</th><th>24H CHANGE</th><th>MARKET</th><th/></tr></thead><tbody>{filtered.map(s => <tr key={s.symbol} onClick={() => setSelected(s)}><td><div className="stock-name"><span className="stock-avatar">{s.symbol.slice(0,1)}</span><span><b>{s.symbol}</b><small>{s.name}</small></span></div></td><td className="price-cell">{money(Number(s.price))}</td><td><span className={Number(s.change_percent) >= 0 ? "change positive" : "change negative"}>{Number(s.change_percent) >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}{Number(s.change_percent).toFixed(2)}%</span></td><td><span className="market-tag">US EQUITY</span></td><td><button className="text-button" onClick={e => { e.stopPropagation(); setSelected(s); document.querySelector(".trade-panel")?.scrollIntoView({ behavior: "smooth" }); }}>Trade →</button></td></tr>)}</tbody></table></div></section>
      <footer>© 2026 StockSim · Built for learning, not financial advice.</footer>
    </main>
    {authOpen && <div className="modal-backdrop"><div className="auth-modal"><button className="modal-close" onClick={() => setAuthOpen(false)}>×</button><div className="brand"><span className="brand-mark"><ChartNoAxesCombined size={20}/></span>stock<span className="accent">sim</span></div><h2>Welcome to StockSim</h2><p>Sign in or create an account to start trading virtually.</p><input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}/><input type="password" placeholder="Password (min. 6 characters)" value={password} onChange={e => setPassword(e.target.value)}/><button className="primary trade-submit" disabled={busy} onClick={() => signIn(false)}>Sign in</button><button className="secondary trade-submit" disabled={busy} onClick={() => signIn(true)}>Create account</button><small>New accounts receive $100,000 virtual cash after database setup.</small></div></div>}
  </div>;
}
function Stat({ icon, label, value, hint, positive }: { icon: React.ReactNode; label: string; value: string; hint: string; positive?: boolean }) { return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span></div><strong>{value}</strong><small className={positive ? "positive-text" : ""}>{hint}</small></div>; }
