import { useState, useEffect } from "react";

// ── MOCK DATA (replace with Supabase queries in production) ───────────────────

const MOCK_SUBSCRIBERS = [
  { id: "u1", email: "cortez@example.com", plan: "yearly", status: "active", joined: "2026-01-15", plays: 142, winRate: 71, revenue: 199 },
  { id: "u2", email: "marcus@example.com", plan: "monthly", status: "active", joined: "2026-03-02", plays: 67, winRate: 64, revenue: 87 },
  { id: "u3", email: "dre@example.com", plan: "monthly", status: "active", joined: "2026-04-10", plays: 44, winRate: 68, revenue: 58 },
  { id: "u4", email: "aaliyah@example.com", plan: "yearly", status: "active", joined: "2026-02-20", plays: 98, winRate: 73, revenue: 199 },
  { id: "u5", email: "omar@example.com", plan: "monthly", status: "canceled", joined: "2026-01-30", plays: 23, winRate: 52, revenue: 29 },
  { id: "u6", email: "zara@example.com", plan: "monthly", status: "active", joined: "2026-05-01", plays: 12, winRate: 83, revenue: 29 },
  { id: "u7", email: "kai@example.com", plan: "yearly", status: "active", joined: "2026-03-18", plays: 88, winRate: 69, revenue: 199 },
  { id: "u8", email: "nina@example.com", plan: "monthly", status: "past_due", joined: "2026-04-01", plays: 31, winRate: 61, revenue: 58 },
];

const MOCK_PLAYS = [
  { id: "p1", userId: "u1", user: "cortez@example.com", matchup: "Yankees @ Red Sox", sport: "MLB", slot: "PUBLIC", tier: "1", pick: "Yankees ML", betType: "ML", generatedAt: "2026-05-21 11:42", outcome: "WIN", odds: "-145" },
  { id: "p2", userId: "u2", user: "marcus@example.com", matchup: "Dodgers @ Padres", sport: "MLB", slot: "VEGAS", tier: "2", pick: "Padres ML", betType: "ML", generatedAt: "2026-05-21 12:15", outcome: "WIN", odds: "+140" },
  { id: "p3", userId: "u3", user: "dre@example.com", matchup: "Sinner vs Alcaraz", sport: "Tennis", slot: "VEGAS", tier: "1", pick: "Sinner ML", betType: "ML", generatedAt: "2026-05-21 08:55", outcome: "LOSS", odds: "-120" },
  { id: "p4", userId: "u4", user: "aaliyah@example.com", matchup: "Cubs vs Cardinals", sport: "MLB", slot: "PUBLIC", tier: "2", pick: "Cubs ML", betType: "ML", generatedAt: "2026-05-21 13:30", outcome: "PENDING", odds: "-150" },
  { id: "p5", userId: "u1", user: "cortez@example.com", matchup: "Astros @ Mariners", sport: "MLB", slot: "PUBLIC", tier: "1", pick: "Mariners ML", betType: "ML", generatedAt: "2026-05-21 14:00", outcome: "PENDING", odds: "-130" },
  { id: "p6", userId: "u6", user: "zara@example.com", matchup: "Yankees @ Red Sox", sport: "MLB", slot: "PUBLIC", tier: "1", pick: "Yankees ML", betType: "ML", generatedAt: "2026-05-21 11:50", outcome: "WIN", odds: "-145" },
  { id: "p7", userId: "u7", user: "kai@example.com", matchup: "Dodgers @ Padres", sport: "MLB", slot: "VEGAS", tier: "2", pick: "Padres ML", betType: "ML", generatedAt: "2026-05-21 12:20", outcome: "WIN", odds: "+140" },
  { id: "p8", userId: "u8", user: "nina@example.com", matchup: "Sinner vs Alcaraz", sport: "Tennis", slot: "VEGAS", tier: "1", pick: "Sinner ML", betType: "ML", generatedAt: "2026-05-21 09:10", outcome: "LOSS", odds: "-120" },
];

const MOCK_REVENUE = [
  { month: "Jan", mrr: 228 }, { month: "Feb", mrr: 427 },
  { month: "Mar", mrr: 655 }, { month: "Apr", mrr: 913 },
  { month: "May", mrr: 1021 },
];

// ── SUPABASE QUERIES (production) ─────────────────────────────────────────────
// Replace MOCK_ data with these:
//
// const { data: subscribers } = await supabaseAdmin
//   .from('profiles')
//   .select('*, subscriptions(*), plays(count)')
//   .order('created_at', { ascending: false });
//
// const { data: plays } = await supabaseAdmin
//   .from('plays')
//   .select('*, profiles(email)')
//   .order('generated_at', { ascending: false })
//   .limit(100);
//
// Outcome override:
// await supabaseAdmin.from('plays').update({ outcome: newOutcome }).eq('id', playId);

// ── HELPERS ───────────────────────────────────────────────────────────────────

const OUTCOME_STYLES = {
  WIN:     { bg: "#0a2e1a", border: "#1a6b3a", text: "#4ade80" },
  LOSS:    { bg: "#1f0a0a", border: "#7f1d1d", text: "#f87171" },
  PUSH:    { bg: "#1a1500", border: "#b45309", text: "#fbbf24" },
  PENDING: { bg: "#111",    border: "#333",    text: "#888"    },
};

const STATUS_STYLES = {
  active:   { color: "#4ade80" },
  canceled: { color: "#f87171" },
  past_due: { color: "#fbbf24" },
  trialing: { color: "#60a5fa" },
};

const TIER_COLORS = { "1": "#4ade80", "2": "#fbbf24", "3": "#888", "PASS": "#f87171" };
const TIER_LABELS = { "1": "🔒 Lock", "2": "⭐ T2", "3": "⚠️ T3", "PASS": "🚫 Pass" };

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: accent || "#e5e5e5", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ data }) {
  const max = Math.max(...data.map(d => d.mrr));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 48, marginTop: 12 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", background: i === data.length - 1 ? "#c9a227" : "#2a2a2a", borderRadius: 2, height: Math.round((d.mrr / max) * 40) }} />
          <div style={{ fontSize: 9, color: "#444" }}>{d.month}</div>
        </div>
      ))}
    </div>
  );
}

// ── OUTCOME OVERRIDE MODAL ────────────────────────────────────────────────────

function OutcomeModal({ play, onSave, onClose }) {
  const [selected, setSelected] = useState(play.outcome);
  const outcomes = ["WIN", "LOSS", "PUSH", "PENDING"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "0.5px solid #2a2a2a", borderRadius: 14, padding: 24, width: 340, fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#e5e5e5", marginBottom: 4 }}>Override outcome</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>{play.pick} · {play.matchup}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {outcomes.map(o => {
            const s = OUTCOME_STYLES[o];
            return (
              <button key={o} onClick={() => setSelected(o)} style={{
                padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: selected === o ? 600 : 400,
                background: selected === o ? s.bg : "transparent",
                border: `${selected === o ? "1px" : "0.5px"} solid ${selected === o ? s.border : "#222"}`,
                color: selected === o ? s.text : "#555", cursor: "pointer", fontFamily: "inherit"
              }}>{o}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", background: "transparent", border: "0.5px solid #222", borderRadius: 8, color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onSave(play.id, selected)} style={{ flex: 1, padding: "9px 0", background: "#c9a227", border: "none", borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── SUBSCRIBER DETAIL PANEL ───────────────────────────────────────────────────

function SubscriberPanel({ sub, plays, onClose }) {
  const userPlays = plays.filter(p => p.userId === sub.id);
  const wins = userPlays.filter(p => p.outcome === "WIN").length;
  const losses = userPlays.filter(p => p.outcome === "LOSS").length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ background: "#0f0f0f", borderLeft: "0.5px solid #1e1e1e", width: 380, overflowY: "auto", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#0f0f0f" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#e5e5e5" }}>Subscriber</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: 14, color: "#e5e5e5", marginBottom: 2 }}>{sub.email}</div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 18 }}>Joined {new Date(sub.joined).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Plan", val: sub.plan === "yearly" ? "Yearly" : "Monthly" },
              { label: "Status", val: sub.status, color: STATUS_STYLES[sub.status]?.color },
              { label: "Total plays", val: sub.plays },
              { label: "Win rate", val: `${sub.winRate}%`, color: sub.winRate >= 65 ? "#4ade80" : sub.winRate >= 55 ? "#fbbf24" : "#f87171" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#151515", border: "0.5px solid #1e1e1e", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: s.color || "#e5e5e5" }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Recent plays</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {userPlays.length === 0 && <div style={{ fontSize: 12, color: "#444" }}>No plays yet.</div>}
            {userPlays.map(p => {
              const os = OUTCOME_STYLES[p.outcome];
              return (
                <div key={p.id} style={{ background: "#151515", border: "0.5px solid #1e1e1e", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#e5e5e5" }}>{p.pick}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{p.matchup} · {p.odds}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: os.bg, border: `0.5px solid ${os.border}`, color: os.text }}>{p.outcome}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ADMIN DASHBOARD ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [plays, setPlays] = useState(MOCK_PLAYS);
  const [subscribers] = useState(MOCK_SUBSCRIBERS);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [viewSub, setViewSub] = useState(null);
  const [playFilter, setPlayFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Stats
  const activeCount = subscribers.filter(s => s.status === "active").length;
  const monthlyCount = subscribers.filter(s => s.plan === "monthly" && s.status === "active").length;
  const yearlyCount = subscribers.filter(s => s.plan === "yearly" && s.status === "active").length;
  const mrr = monthlyCount * 29 + yearlyCount * Math.round(199 / 12);
  const todayPlays = plays.length;
  const todayWins = plays.filter(p => p.outcome === "WIN").length;
  const todayLosses = plays.filter(p => p.outcome === "LOSS").length;
  const winRate = todayWins + todayLosses > 0
    ? Math.round((todayWins / (todayWins + todayLosses)) * 100)
    : 0;

  function handleOverrideSave(playId, outcome) {
    setPlays(prev => prev.map(p => p.id === playId ? { ...p, outcome } : p));
    setOverrideTarget(null);
    // Production: await supabaseAdmin.from('plays').update({ outcome }).eq('id', playId);
  }

  const filteredPlays = plays.filter(p => {
    if (playFilter !== "ALL" && p.outcome !== playFilter) return false;
    if (search && !p.user.includes(search) && !p.matchup.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredSubs = subscribers.filter(s => {
    if (subFilter !== "ALL" && s.status !== subFilter) return false;
    if (search && !s.email.includes(search)) return false;
    return true;
  });

  const TABS = ["overview", "plays", "subscribers"];

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#080808", minHeight: "100vh", color: "#e5e5e5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        input::placeholder { color: #444; }
        tr:hover td { background: #111 !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ borderBottom: "0.5px solid #1e1e1e", padding: "13px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#080808", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#fff", letterSpacing: "0.05em" }}>VEGAS</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#c9a227", letterSpacing: "0.05em" }}>VAULT</span>
            <span style={{ fontSize: 10, color: "#333", background: "#1a1500", border: "0.5px solid #c9a22744", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>ADMIN</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "5px 14px", borderRadius: 6, border: "none",
                background: tab === t ? "#1a1a1a" : "transparent",
                color: tab === t ? "#e5e5e5" : "#444",
                fontSize: 12, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit"
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12, color: "#555" }}>
          <span style={{ color: "#4ade80", fontSize: 11 }}>● Live</span>
          <span>Thu, May 21 2026</span>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1f0000", border: "0.5px solid #7f1d1d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#f87171" }}>A</div>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 20 }}>
              <StatCard label="Active subscribers" value={activeCount} sub={`${monthlyCount} monthly · ${yearlyCount} yearly`} accent="#e5e5e5" />
              <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} sub="Monthly recurring revenue" accent="#c9a227" />
              <StatCard label="Today's plays" value={todayPlays} sub={`${todayWins}W · ${todayLosses}L · ${plays.filter(p => p.outcome === "PENDING").length} pending`} />
              <StatCard label="Win rate today" value={`${winRate}%`} sub="Settled plays only" accent={winRate >= 65 ? "#4ade80" : winRate >= 55 ? "#fbbf24" : "#f87171"} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {/* MRR chart */}
              <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em" }}>Revenue trend</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#c9a227" }}>${mrr}/mo</div>
                </div>
                <MiniBar data={MOCK_REVENUE} />
              </div>

              {/* Model health */}
              <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Model performance</div>
                {[
                  { label: "🔒 Tier 1 locks", w: 8, l: 2, total: 10 },
                  { label: "⭐ Tier 2", w: 5, l: 3, total: 8 },
                  { label: "🟩 Public slot", w: 9, l: 3, total: 12 },
                  { label: "🟥 Vegas slot", w: 4, l: 2, total: 6 },
                ].map((row, i) => {
                  const pct = Math.round((row.w / (row.w + row.l)) * 100);
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: "#888" }}>{row.label}</span>
                        <span style={{ color: pct >= 65 ? "#4ade80" : pct >= 55 ? "#fbbf24" : "#f87171", fontWeight: 500 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 65 ? "#4ade80" : pct >= 55 ? "#fbbf24" : "#f87171", borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's play summary */}
            <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Today's plays — all subscribers</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Matchup", "Pick", "Odds", "Slot", "Tier", "Generated by", "Outcome", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "0 0 10px", color: "#444", fontWeight: 400, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plays.slice(0, 6).map(p => {
                    const os = OUTCOME_STYLES[p.outcome];
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: "8px 0", color: "#e5e5e5", borderTop: "0.5px solid #1a1a1a" }}>{p.matchup}</td>
                        <td style={{ padding: "8px 0", borderTop: "0.5px solid #1a1a1a" }}><span style={{ color: "#c9a227", fontWeight: 500 }}>{p.pick}</span></td>
                        <td style={{ padding: "8px 0", color: "#666", borderTop: "0.5px solid #1a1a1a" }}>{p.odds}</td>
                        <td style={{ padding: "8px 0", borderTop: "0.5px solid #1a1a1a" }}>
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, background: p.slot === "VEGAS" ? "#1f0a0a" : "#0a1a2e", color: p.slot === "VEGAS" ? "#f87171" : "#60a5fa" }}>{p.slot === "VEGAS" ? "🟥" : "🟩"} {p.slot}</span>
                        </td>
                        <td style={{ padding: "8px 0", borderTop: "0.5px solid #1a1a1a" }}>
                          <span style={{ color: TIER_COLORS[p.tier], fontSize: 12 }}>{TIER_LABELS[p.tier]}</span>
                        </td>
                        <td style={{ padding: "8px 0", color: "#555", borderTop: "0.5px solid #1a1a1a" }}>{p.user.split("@")[0]}</td>
                        <td style={{ padding: "8px 0", borderTop: "0.5px solid #1a1a1a" }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: os.bg, border: `0.5px solid ${os.border}`, color: os.text }}>{p.outcome}</span>
                        </td>
                        <td style={{ padding: "8px 0", borderTop: "0.5px solid #1a1a1a" }}>
                          <button onClick={() => setOverrideTarget(p)} style={{ background: "none", border: "0.5px solid #222", borderRadius: 4, color: "#555", fontSize: 11, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>Override</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── PLAYS TAB ── */}
        {tab === "plays" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search matchup or user..."
                style={{ flex: 1, padding: "8px 12px", background: "#111", border: "0.5px solid #222", borderRadius: 8, color: "#e5e5e5", fontSize: 12, outline: "none", fontFamily: "inherit" }}
              />
              {["ALL", "WIN", "LOSS", "PUSH", "PENDING"].map(f => (
                <button key={f} onClick={() => setPlayFilter(f)} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12,
                  border: `0.5px solid ${playFilter === f ? (OUTCOME_STYLES[f]?.border || "#c9a227") : "#222"}`,
                  background: playFilter === f ? (OUTCOME_STYLES[f]?.bg || "#1a1500") : "transparent",
                  color: playFilter === f ? (OUTCOME_STYLES[f]?.text || "#c9a227") : "#555",
                  cursor: "pointer", fontFamily: "inherit"
                }}>{f}</button>
              ))}
            </div>

            <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0d0d0d" }}>
                    {["Time", "Matchup", "Pick", "Odds", "Tier", "Slot", "User", "Outcome", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#444", fontWeight: 400, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid #1e1e1e" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlays.map(p => {
                    const os = OUTCOME_STYLES[p.outcome];
                    return (
                      <tr key={p.id} style={{ cursor: "default" }}>
                        <td style={{ padding: "9px 14px", color: "#555", borderTop: "0.5px solid #141414" }}>{p.generatedAt.split(" ")[1]}</td>
                        <td style={{ padding: "9px 14px", color: "#e5e5e5", borderTop: "0.5px solid #141414" }}>{p.matchup}</td>
                        <td style={{ padding: "9px 14px", borderTop: "0.5px solid #141414" }}><span style={{ color: "#c9a227", fontWeight: 500 }}>{p.pick}</span></td>
                        <td style={{ padding: "9px 14px", color: "#666", borderTop: "0.5px solid #141414" }}>{p.odds}</td>
                        <td style={{ padding: "9px 14px", borderTop: "0.5px solid #141414" }}><span style={{ color: TIER_COLORS[p.tier] }}>{TIER_LABELS[p.tier]}</span></td>
                        <td style={{ padding: "9px 14px", borderTop: "0.5px solid #141414" }}>
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, background: p.slot === "VEGAS" ? "#1f0a0a" : "#0a1a2e", color: p.slot === "VEGAS" ? "#f87171" : "#60a5fa" }}>{p.slot === "VEGAS" ? "🟥" : "🟩"}</span>
                        </td>
                        <td style={{ padding: "9px 14px", color: "#666", borderTop: "0.5px solid #141414" }}>{p.user.split("@")[0]}</td>
                        <td style={{ padding: "9px 14px", borderTop: "0.5px solid #141414" }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: os.bg, border: `0.5px solid ${os.border}`, color: os.text }}>{p.outcome}</span>
                        </td>
                        <td style={{ padding: "9px 14px", borderTop: "0.5px solid #141414" }}>
                          <button onClick={() => setOverrideTarget(p)} style={{ background: "none", border: "0.5px solid #222", borderRadius: 4, color: "#555", fontSize: 11, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPlays.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 13 }}>No plays match this filter.</div>
              )}
            </div>
          </>
        )}

        {/* ── SUBSCRIBERS TAB ── */}
        {tab === "subscribers" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by email..."
                style={{ flex: 1, padding: "8px 12px", background: "#111", border: "0.5px solid #222", borderRadius: 8, color: "#e5e5e5", fontSize: 12, outline: "none", fontFamily: "inherit" }}
              />
              {["ALL", "active", "canceled", "past_due"].map(f => (
                <button key={f} onClick={() => setSubFilter(f)} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12,
                  border: `0.5px solid ${subFilter === f ? "#c9a227" : "#222"}`,
                  background: subFilter === f ? "#1a1500" : "transparent",
                  color: subFilter === f ? "#c9a227" : "#555",
                  cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize"
                }}>{f}</button>
              ))}
            </div>

            <div style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0d0d0d" }}>
                    {["Email", "Plan", "Status", "Joined", "Plays", "Win rate", "Revenue", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#444", fontWeight: 400, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid #1e1e1e" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map(s => (
                    <tr key={s.id} onClick={() => setViewSub(s)} style={{ cursor: "pointer" }}>
                      <td style={{ padding: "10px 14px", color: "#e5e5e5", borderTop: "0.5px solid #141414" }}>{s.email}</td>
                      <td style={{ padding: "10px 14px", borderTop: "0.5px solid #141414" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: s.plan === "yearly" ? "#1a1500" : "#111", border: `0.5px solid ${s.plan === "yearly" ? "#c9a227" : "#333"}`, color: s.plan === "yearly" ? "#c9a227" : "#888" }}>{s.plan}</span>
                      </td>
                      <td style={{ padding: "10px 14px", borderTop: "0.5px solid #141414" }}>
                        <span style={{ fontSize: 12, color: STATUS_STYLES[s.status]?.color, fontWeight: 500 }}>● {s.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#555", borderTop: "0.5px solid #141414" }}>{new Date(s.joined).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td style={{ padding: "10px 14px", color: "#aaa", borderTop: "0.5px solid #141414" }}>{s.plays}</td>
                      <td style={{ padding: "10px 14px", borderTop: "0.5px solid #141414" }}>
                        <span style={{ color: s.winRate >= 65 ? "#4ade80" : s.winRate >= 55 ? "#fbbf24" : "#f87171", fontWeight: 500 }}>{s.winRate}%</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#aaa", borderTop: "0.5px solid #141414" }}>${s.revenue}</td>
                      <td style={{ padding: "10px 14px", borderTop: "0.5px solid #141414" }}>
                        <span style={{ color: "#555", fontSize: 12 }}>→</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSubs.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 13 }}>No subscribers match this filter.</div>
              )}
            </div>
          </>
        )}
      </div>

      {overrideTarget && (
        <OutcomeModal
          play={overrideTarget}
          onSave={handleOverrideSave}
          onClose={() => setOverrideTarget(null)}
        />
      )}

      {viewSub && (
        <SubscriberPanel
          sub={viewSub}
          plays={plays}
          onClose={() => setViewSub(null)}
        />
      )}
    </div>
  );
}
