"use client";
import { useState, useEffect, useRef } from "react";

// ── PROMPT ENGINE ─────────────────────────────────────────────────────────────

function buildBaseballPrompt(gameData) {
  return `You are the Vegas Vault AI Model — a professional sports betting analysis system. Your job is to identify when market pricing misrepresents reality and find the edge.

GAME DATA:
- Matchup: ${gameData.away} @ ${gameData.home}
- Date: ${gameData.date}
- Time: ${gameData.time}
- Starting Pitchers: ${gameData.awayPitcher} (${gameData.away}) vs ${gameData.homePitcher} (${gameData.home})
- Line: ${gameData.away} ${gameData.awayML} / ${gameData.home} ${gameData.homeML}
- Run Line: ${gameData.runLine}
- Series: Game ${gameData.seriesGame} of ${gameData.seriesLength}
- Slot: ${gameData.slot}

TEAM RECORDS & STATS:
${gameData.away}: ${gameData.awayRecord} overall | ${gameData.awayAwayRecord} away | Last 5: ${gameData.awayLast5} | Last 10: ${gameData.awayLast10}
${gameData.home}: ${gameData.homeRecord} overall | ${gameData.homeHomeRecord} home | Last 5: ${gameData.homeLast5} | Last 10: ${gameData.homeLast10}

PITCHING:
${gameData.awayPitcher}: ${gameData.awayPitcherStats}
${gameData.homePitcher}: ${gameData.homePitcherStats}
Bullpens: ${gameData.away} pen ERA: ${gameData.awayBullpenERA} | ${gameData.home} pen ERA: ${gameData.homeBullpenERA}

LINEUP & OFFENSE:
${gameData.away} offense: ${gameData.awayOffense}
${gameData.home} offense: ${gameData.homeOffense}

HEAD TO HEAD:
Last 5 matchups: ${gameData.h2hLast5}
At ${gameData.home} (home): ${gameData.h2hAtHome}

INJURIES:
${gameData.injuries}

LINE MOVEMENT:
${gameData.lineMovement}

---

Run the FULL Vegas Vault AI Model in this EXACT order. Do not skip any step.

Return your response as a JSON object with this exact structure:

{
  "summary": {
    "pick": "TEAM NAME",
    "betType": "ML or +1.5 or -1.5",
    "tier": "1 or 2 or 3 or PASS",
    "tierLabel": "LOCK or Tier 2 or Tier 3 or PASS",
    "slot": "PUBLIC or VEGAS",
    "isScamPlay": true,
    "verdict": "One sentence final verdict.",
    "confidence": "HIGH or MEDIUM or LOW"
  },
  "analysis": {
    "matchupFoundation": "Your matchup truth analysis ignoring the line.",
    "records": "Record analysis including home/away splits and streaks.",
    "recentForm": "Last 5 and last 10 analysis. Real vs fake form.",
    "headToHead": "H2H breakdown, who controls the series, margin of victory.",
    "hitterLineup": "Both lineups evaluated: depth, type of offense, hot/cold bats, batter vs pitcher splits.",
    "pitching": "Both starters evaluated + bullpen analysis.",
    "gameScript": "Classify: Close / Blowout / Controlled. Explain what this means for bet type.",
    "seriesContext": "Game number context, urgency, regression flags.",
    "trellRule": "ACTIVE or INACTIVE. If active, explain which player and direction.",
    "pricingComprehension": "Does the line make sense? Is this team appropriately priced?",
    "lineMovement": "What movement says. Confirmation only.",
    "vegasVsPublic": "Public slot or Vegas slot breakdown. Where is the trap?",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative, recent results making it look bad.",
      "whyItsActuallyCorrect": "Matchup reality, pitching, pricing mismatch, series context."
    }
  },
  "finalVerdict": "2-3 sentence final breakdown explaining the pick, bet type, and why."
}

Return ONLY valid JSON. No preamble, no explanation outside the JSON.`;
}

function buildTennisPrompt(gameData) {
  return `You are the Vegas Vault Tennis AI Model — a professional tennis betting analysis system. Identify when matchup reality and market price do not align.

MATCH DATA:
- Match: ${gameData.player1} vs ${gameData.player2}
- Surface: ${gameData.surface}
- Tournament: ${gameData.tournament}
- Round: ${gameData.round}
- Line: ${gameData.player1} ${gameData.player1ML} / ${gameData.player2} ${gameData.player2ML}

PLAYER DATA:
${gameData.player1}: Ranking #${gameData.player1Ranking} | Last 5: ${gameData.player1Last5} | Surface record: ${gameData.player1SurfaceRecord}
${gameData.player2}: Ranking #${gameData.player2Ranking} | Last 5: ${gameData.player2Last5} | Surface record: ${gameData.player2SurfaceRecord}

HEAD TO HEAD: ${gameData.h2h}
SERVE STATS: ${gameData.player1}: ${gameData.player1ServeStats} | ${gameData.player2}: ${gameData.player2ServeStats}
FATIGUE: ${gameData.player1}: ${gameData.player1Fatigue} | ${gameData.player2}: ${gameData.player2Fatigue}
INJURIES: ${gameData.injuries}
LINE MOVEMENT: ${gameData.lineMovement}

---

Run the FULL Vegas Vault Tennis AI Model in EXACT order. Return ONLY this JSON:

{
  "summary": {
    "pick": "PLAYER NAME",
    "betType": "ML or Game Spread or Set Spread or Over/Under or First Set",
    "tier": "1 or 2 or 3 or PASS",
    "tierLabel": "LOCK or Tier 2 or Tier 3 or PASS",
    "slot": "PUBLIC or VEGAS",
    "isScamPlay": true,
    "verdict": "One sentence final verdict.",
    "confidence": "HIGH or MEDIUM or LOW"
  },
  "analysis": {
    "matchupFoundation": "Matchup truth ignoring odds.",
    "rankingsTier": "Ranking analysis, trend, big-match experience.",
    "surfaceAnalysis": "Who benefits from this surface and why.",
    "recentForm": "Last 5 and 10 matches. Quality of opponents.",
    "tournamentContext": "Round, motivation, pressure.",
    "fatigueScheduling": "Time on court, consecutive matches, rest days.",
    "headToHead": "Overall and surface H2H. Stylistic edges.",
    "serveReturn": "Serve and return breakdown. Who controls service games.",
    "mentalPsychological": "Clutch performance, tiebreak record, meltdown risk.",
    "injuryCheck": "Any injuries, movement limitations, medical timeouts.",
    "pricingIntelligence": "Is the favorite overpriced? Is the market overreacting?",
    "gameScript": "Dominant / Grind / Underdog Live — which script is most likely.",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative making it look bad.",
      "whyItsActuallyCorrect": "Matchup reality, surface, fatigue, pricing mismatch."
    }
  },
  "finalVerdict": "2-3 sentence final breakdown explaining the pick, bet type, and why."
}

Return ONLY valid JSON. No preamble, no explanation outside the JSON.`;
}

// ── MOCK DATA ─────────────────────────────────────────────────────────────────

const MOCK_GAMES = [
  { id:1, sport:"MLB", slot:"PUBLIC", time:"1:10 PM CT", away:"Yankees", home:"Red Sox", awayRecord:"28-17", homeRecord:"22-24", awayAwayRecord:"13-9", homeHomeRecord:"10-13", awayLast5:"4-1", homeLast5:"2-3", awayLast10:"7-3", homeLast10:"4-6", awayML:"-145", homeML:"+125", runLine:"Yankees -1.5 (+115)", awayPitcher:"Gerrit Cole", homePitcher:"Brayan Bello", awayPitcherStats:"3.21 ERA, 1.08 WHIP, 78 K in 70.1 IP, 5-2", homePitcherStats:"4.87 ERA, 1.34 WHIP, 52 K in 64.0 IP, 3-5", awayBullpenERA:"3.45", homeBullpenERA:"4.92", awayOffense:"BA .261, OPS .778, strong 1-6 lineup", homeOffense:"BA .243, OPS .714, streaky bottom third", h2hLast5:"Yankees 4-1", h2hAtHome:"Yankees 3-1 at Fenway last 4", injuries:"Red Sox: Rafael Devers (back, day-to-day) | Yankees: all clear", lineMovement:"Opened Yankees -135, moved to -145. Sharp action on Yankees.", seriesGame:"2", seriesLength:"3", date:"2026-05-23" },
  { id:2, sport:"MLB", slot:"VEGAS", time:"2:20 PM CT", away:"Dodgers", home:"Padres", awayRecord:"31-14", homeRecord:"26-20", awayAwayRecord:"15-8", homeHomeRecord:"14-9", awayLast5:"3-2", homeLast5:"4-1", awayLast10:"6-4", homeLast10:"7-3", awayML:"-160", homeML:"+140", runLine:"Dodgers -1.5 (+105)", awayPitcher:"Tyler Glasnow", homePitcher:"Dylan Cease", awayPitcherStats:"2.98 ERA, 1.01 WHIP, 88 K in 75.2 IP, 6-2", homePitcherStats:"2.61 ERA, 1.09 WHIP, 92 K in 79.1 IP, 5-3", awayBullpenERA:"3.88", homeBullpenERA:"3.21", awayOffense:"BA .268, OPS .812, MLB-best lineup depth", homeOffense:"BA .254, OPS .741, Tatis/Machado carrying", h2hLast5:"Dodgers 3-2", h2hAtHome:"Padres 3-1 vs Dodgers at Petco last 4", injuries:"Dodgers: Freddie Freeman (ankle, questionable) | Padres: all clear", lineMovement:"Opened Dodgers -150, moved to -160. Public heavy on Dodgers.", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:3, sport:"MLB", slot:"PUBLIC", time:"7:05 PM CT", away:"Cardinals", home:"Cubs", awayRecord:"20-26", homeRecord:"24-22", awayAwayRecord:"8-15", homeHomeRecord:"13-10", awayLast5:"2-3", homeLast5:"3-2", awayLast10:"4-6", homeLast10:"6-4", awayML:"+130", homeML:"-150", runLine:"Cardinals +1.5 (-135)", awayPitcher:"Sonny Gray", homePitcher:"Justin Steele", awayPitcherStats:"3.54 ERA, 1.19 WHIP, 61 K in 58.2 IP, 3-4", homePitcherStats:"3.12 ERA, 1.14 WHIP, 74 K in 66.1 IP, 5-2", awayBullpenERA:"4.44", homeBullpenERA:"3.67", awayOffense:"BA .248, OPS .698, Goldschmidt cold last 2 weeks", homeOffense:"BA .257, OPS .743, Swanson hot, solid top 6", h2hLast5:"Cubs 3-2", h2hAtHome:"Cubs 3-0 vs Cardinals at Wrigley this season", injuries:"Cardinals: Paul Goldschmidt (wrist, day-to-day) | Cubs: all clear", lineMovement:"Opened Cubs -140, moved to -150. Public on Cubs.", seriesGame:"3", seriesLength:"3", date:"2026-05-23" },
];

// ── GENERATE ──────────────────────────────────────────────────────────────────

async function generatePlay(game) {
  const response = await fetch("/api/generate", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ game }),
  });
  if (!response.ok) throw new Error("Generate failed");
  return response.json();
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const TIER_STYLES = {
  "1":    { bg:"rgba(74,222,128,0.12)",  border:"rgba(74,222,128,0.4)",  text:"#4ade80", label:"LOCK"   },
  "2":    { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.4)",  text:"#fbbf24", label:"TIER 2" },
  "3":    { bg:"rgba(148,163,184,0.08)", border:"rgba(148,163,184,0.25)",text:"#94a3b8", label:"TIER 3" },
  "PASS": { bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.4)", text:"#f87171", label:"PASS"   },
};

const CONF_STYLES = {
  HIGH:   { color:"#4ade80" },
  MEDIUM: { color:"#fbbf24" },
  LOW:    { color:"#f87171" },
};

const NAV_ITEMS = [
  { icon:"⊞", label:"DASHBOARD",    active:true  },
  { icon:"◈", label:"TODAY'S SLATE", active:false },
  { icon:"◎", label:"AI ANALYZER",  active:false },
  { icon:"🔒", label:"VAULT LOCKS",  active:false },
  { icon:"↑↓", label:"ODDS MOVEMENT",active:false },
  { icon:"◈", label:"SHARP MONEY",  active:false },
  { icon:"◇", label:"PROPS AI",     active:false, arrow:true },
  { icon:"↺", label:"HISTORY",      active:false },
  { icon:"⚙", label:"SETTINGS",     active:false },
];

const ODDS_FEED = [
  { team:"LAD", line:"-1.5", odds:"-110", up:true  },
  { team:"NYY", line:"+1.5", odds:"-105", up:false },
  { team:"HOU", line:"-1.5", odds:"-125", up:true  },
  { team:"ATL", line:"+1.5", odds:"+102", up:false },
  { team:"SD",  line:"-1.5", odds:"-115", up:true  },
  { team:"PHI", line:"+1.5", odds:"-108", up:false },
  { team:"BOS", line:"+1.5", odds:"+118", up:true  },
  { team:"CHC", line:"-1.5", odds:"-130", up:false },
];

const INSIGHTS = [
  { icon:"◉", text:"Sharp money is on TOR, line moving from TOR -120 to -135", time:"2m ago"  },
  { icon:"◈", text:"Public is 78% heavy on NYY — Potential fade spot",           time:"4m ago"  },
  { icon:"○", text:"Weather edge detected in 3 games — Impacting totals",         time:"6m ago"  },
  { icon:"◉", text:"Reverse line movement on SD — Sharp vs public split",         time:"11m ago" },
];

// ── ANALYSIS ROW ──────────────────────────────────────────────────────────────

function AnalysisRow({ index, label, value }) {
  return (
    <div style={{ padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"grid", gridTemplateColumns:"160px 1fr", gap:12, alignItems:"start" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ width:18, height:18, borderRadius:4, background:"rgba(201,162,39,0.15)", border:"1px solid rgba(201,162,39,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#c9a227", fontWeight:700, flexShrink:0 }}>{index}</span>
        <span style={{ fontSize:9, color:"#c9a227", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", lineHeight:1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize:12, color:"#cbd5e1", lineHeight:1.7 }}>{value}</div>
    </div>
  );
}

function ScamPlayBlock({ scam }) {
  if (!scam?.active) return (
    <div style={{ padding:"10px 14px", background:"rgba(74,222,128,0.05)", border:"1px solid rgba(74,222,128,0.15)", borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color:"#4ade80" }}>✓</span>
      <span style={{ fontSize:11, color:"#4ade80" }}>No scam play — straightforward public side</span>
    </div>
  );
  return (
    <div style={{ background:"rgba(201,162,39,0.04)", border:"1px solid rgba(201,162,39,0.2)", borderRadius:10, padding:"12px 14px" }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#c9a227", background:"rgba(201,162,39,0.1)", padding:"3px 8px", borderRadius:4, display:"inline-block", marginBottom:10 }}>⚡ SCAM PLAY</div>
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:9, color:"#f87171", fontWeight:700, letterSpacing:"0.08em", marginBottom:3 }}>WHY IT LOOKS WRONG</div>
        <div style={{ fontSize:12, color:"#fca5a5", lineHeight:1.6 }}>{scam.whyItLooksWrong}</div>
      </div>
      <div>
        <div style={{ fontSize:9, color:"#4ade80", fontWeight:700, letterSpacing:"0.08em", marginBottom:3 }}>WHY IT'S ACTUALLY CORRECT</div>
        <div style={{ fontSize:12, color:"#86efac", lineHeight:1.6 }}>{scam.whyItsActuallyCorrect}</div>
      </div>
    </div>
  );
}

// ── PLAY RESULT MODAL ─────────────────────────────────────────────────────────

function PlayResult({ result, game, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_STYLES[result.summary.tier] || TIER_STYLES["3"];
  const conf = CONF_STYLES[result.summary.confidence] || CONF_STYLES.MEDIUM;
  const a = result.analysis;
  const isVegas = result.summary.slot === "VEGAS";
  const isTennis = game.sport === "Tennis";

  const baseballSteps = [
    { label:"Matchup Foundation", key:"matchupFoundation" },
    { label:"Records",            key:"records" },
    { label:"Recent Form",        key:"recentForm" },
    { label:"Head to Head",       key:"headToHead" },
    { label:"Hitter & Lineup",    key:"hitterLineup" },
    { label:"Pitching",           key:"pitching" },
    { label:"Game Script",        key:"gameScript" },
    { label:"Series Context",     key:"seriesContext" },
    { label:"Trell Rule",         key:"trellRule" },
    { label:"Pricing",            key:"pricingComprehension" },
    { label:"Line Movement",      key:"lineMovement" },
    { label:"Vegas vs Public",    key:"vegasVsPublic" },
  ];
  const tennisSteps = [
    { label:"Matchup Foundation",  key:"matchupFoundation" },
    { label:"Rankings & Tier",     key:"rankingsTier" },
    { label:"Surface Analysis",    key:"surfaceAnalysis" },
    { label:"Recent Form",         key:"recentForm" },
    { label:"Tournament Context",  key:"tournamentContext" },
    { label:"Fatigue & Schedule",  key:"fatigueScheduling" },
    { label:"Head to Head",        key:"headToHead" },
    { label:"Serve & Return",      key:"serveReturn" },
    { label:"Mental & Psych",      key:"mentalPsychological" },
    { label:"Injury Check",        key:"injuryCheck" },
    { label:"Pricing Intelligence",key:"pricingIntelligence" },
    { label:"Game Script",         key:"gameScript" },
  ];
  const steps = isTennis ? tennisSteps : baseballSteps;

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(16px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#080c14", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, width:"100%", maxWidth:660, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.9)" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color: game.sport==="MLB" ? "#60a5fa" : game.sport==="NBA" ? "#fb923c" : "#a78bfa", background: game.sport==="MLB" ? "rgba(96,165,250,0.1)" : game.sport==="NBA" ? "rgba(251,146,60,0.1)" : "rgba(167,139,250,0.1)", padding:"2px 8px", borderRadius:4 }}>{game.sport}</span>
            <span style={{ fontSize:12, color:"#475569" }}>{isTennis ? `${game.player1} vs ${game.player2}` : `${game.away} @ ${game.home}`} · {game.time}</span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, width:28, height:28, cursor:"pointer", color:"#64748b", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Pick hero */}
        <div style={{ padding:"22px 22px 18px" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:18 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", padding:"4px 12px", borderRadius:6, background:tier.bg, border:`1px solid ${tier.border}`, color:tier.text }}>{tier.label}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"4px 12px", borderRadius:6, background: isVegas ? "rgba(248,113,113,0.08)" : "rgba(96,165,250,0.08)", border: isVegas ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(96,165,250,0.25)", color: isVegas ? "#f87171" : "#60a5fa", letterSpacing:"0.08em" }}>{isVegas ? "VEGAS SLOT" : "PUBLIC SLOT"}</span>
            {result.summary.isScamPlay && <span style={{ fontSize:10, fontWeight:700, padding:"4px 12px", borderRadius:6, background:"rgba(201,162,39,0.08)", border:"1px solid rgba(201,162,39,0.25)", color:"#c9a227", letterSpacing:"0.08em" }}>⚡ SCAM PLAY</span>}
            <span style={{ fontSize:10, padding:"4px 12px", borderRadius:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:conf.color, marginLeft:"auto" }}>Confidence: <strong>{result.summary.confidence}</strong></span>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:10 }}>
            <span style={{ fontSize:30, fontWeight:800, color:"#f8fafc", letterSpacing:"-0.02em" }}>{result.summary.pick}</span>
            <span style={{ fontSize:17, fontWeight:600, color:"#c9a227", background:"rgba(201,162,39,0.1)", padding:"2px 10px", borderRadius:6, border:"1px solid rgba(201,162,39,0.2)" }}>{result.summary.betType}</span>
          </div>
          <p style={{ fontSize:13, color:"#94a3b8", lineHeight:1.7, margin:0 }}>{result.summary.verdict}</p>
        </div>

        {/* Final verdict */}
        <div style={{ margin:"0 22px 18px", padding:"14px 16px", background:"rgba(201,162,39,0.04)", border:"1px solid rgba(201,162,39,0.12)", borderRadius:10 }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#c9a227", marginBottom:8 }}>FINAL VERDICT</div>
          <p style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.75, margin:0 }}>{result.finalVerdict}</p>
        </div>

        {/* Expand */}
        <div style={{ padding:"0 22px 18px" }}>
          <button onClick={() => setExpanded(!expanded)} style={{ width:"100%", padding:"11px", background: expanded ? "rgba(201,162,39,0.06)" : "rgba(255,255,255,0.03)", border:`1px solid ${expanded ? "rgba(201,162,39,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius:10, fontSize:12, fontWeight:500, color: expanded ? "#c9a227" : "#64748b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:9, transform: expanded ? "rotate(180deg)" : "none", display:"inline-block", transition:"transform 0.2s" }}>▼</span>
            {expanded ? "Collapse full breakdown" : "View full Vegas Vault breakdown"}
          </button>
        </div>

        {expanded && (
          <div style={{ padding:"0 22px 22px" }}>
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:4 }}>
              {steps.map((s,i) => <AnalysisRow key={s.key} index={i+1} label={s.label} value={a[s.key]||"—"} />)}
            </div>
            <div style={{ marginTop:18 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#c9a227", marginBottom:10 }}>SCAM PLAY ANALYSIS</div>
              <ScamPlayBlock scam={a.scamPlay} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GAME CARD ─────────────────────────────────────────────────────────────────

function TeamLogo({ abbr, size = 36 }) {
  const colors = {
    Yankees:["#003087","#E4002C"], RedSox:["#BD3039","#0C2340"], Dodgers:["#005A9C","#EF3E42"],
    Padres:["#2F241D","#FFC425"], Cardinals:["#C41E3A","#0C2340"], Cubs:["#0E3386","#CC3433"],
    Pirates:["#27251F","#FDB827"], "Blue Jays":["#134A8E","#E8291C"], Tigers:["#0C2C56","#FA4616"],
    Orioles:["#DF4601","#000000"], Twins:["#002B5C","#D31145"], "Red Sox":["#BD3039","#0C2340"],
    Guardians:["#0C2340","#E31937"], Phillies:["#E81828","#002D72"], Rays:["#092C5C","#8FBCE6"],
    Yankees2:["#003087","#E4002C"], default:["#1e3a5f","#60a5fa"],
  };
  const [bg, accent] = colors[abbr] || colors.default;
  const initials = abbr.replace(/\s+/g,'').slice(0,2).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:8, background:`linear-gradient(135deg, ${bg}, ${bg}dd)`, border:`1px solid ${accent}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.33, fontWeight:800, color:accent, flexShrink:0, letterSpacing:"-0.02em" }}>
      {initials}
    </div>
  );
}

function GameCard({ game, onGenerate, results, generating, onCardClick }) {
  const resultPublic = results[`${game.id}-PUBLIC`];
  const resultVegas  = results[`${game.id}-VEGAS`];
  const hasAnyResult = resultPublic || resultVegas;
  const bestResult = resultVegas || resultPublic;
  const tier = bestResult ? (TIER_STYLES[bestResult.summary.tier] || TIER_STYLES["3"]) : null;
  const isTennis = game.sport === "Tennis";
  const sportColor = game.sport==="MLB" ? "#60a5fa" : game.sport==="NBA" ? "#fb923c" : "#a78bfa";
  const sportBg    = game.sport==="MLB" ? "rgba(96,165,250,0.1)" : game.sport==="NBA" ? "rgba(251,146,60,0.1)" : "rgba(167,139,250,0.1)";
  const awayName = isTennis ? game.player1 : game.away;
  const homeName = isTennis ? game.player2 : game.home;
  const awayRec  = isTennis ? `#${game.player1Ranking}` : game.awayRecord;
  const homeRec  = isTennis ? `#${game.player2Ranking}` : game.homeRecord;

  // Simulated public/sharp split for display
  const publicPct = 30 + ((game.id * 17) % 45);
  const sharpPct  = 100 - publicPct;

  return (
    <div
      onClick={() => hasAnyResult && onCardClick(game)}
      style={{
        background: hasAnyResult ? "linear-gradient(145deg, #0d1520, #0a1218)" : "#0b0f18",
        border: `1px solid ${hasAnyResult ? (tier?.border || "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.06)"}`,
        borderRadius:14, padding:"14px 16px",
        cursor: hasAnyResult ? "pointer" : "default",
        transition:"all 0.2s ease",
        boxShadow: hasAnyResult ? `0 4px 24px ${tier?.border?.replace("0.4","0.08") || "transparent"}` : "none",
        position:"relative", overflow:"hidden",
      }}
    >
      {/* Gold accent top border on locked */}
      {tier?.label === "LOCK" && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, #c9a227, transparent)" }} />}

      {/* Top row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", color:sportColor, background:sportBg, padding:"2px 7px", borderRadius:4 }}>{game.sport}</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, color:"#475569" }}>{game.time}</span>
          <span style={{ fontSize:14, color:"#2d3748", cursor:"pointer" }}>☆</span>
        </div>
      </div>

      {/* Matchup */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 28px 1fr", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <TeamLogo abbr={awayName} size={34} />
          <div>
            <div style={{ fontSize:9, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:1 }}>{isTennis ? "PLAYER 1" : "AWAY"}</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.01em" }}>{awayName.toUpperCase()}</div>
            <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>{awayRec}</div>
          </div>
        </div>
        <div style={{ textAlign:"center", fontSize:10, color:"#2d3748", fontWeight:700 }}>@</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:1 }}>{isTennis ? "PLAYER 2" : "HOME"}</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.01em" }}>{homeName.toUpperCase()}</div>
            <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>{homeRec}</div>
          </div>
          <TeamLogo abbr={homeName} size={34} />
        </div>
      </div>

      {/* Public/Sharp bar */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ fontSize:9, color:"#3b82f6", fontWeight:600, letterSpacing:"0.06em" }}>PUBLIC BETTING {publicPct}%</span>
          <span style={{ fontSize:9, color:"#10b981", fontWeight:600, letterSpacing:"0.06em" }}>SHARP MONEY {sharpPct}%</span>
        </div>
        <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden", display:"flex" }}>
          <div style={{ width:`${publicPct}%`, background:"linear-gradient(90deg, #1d4ed8, #3b82f6)", borderRadius:"2px 0 0 2px" }} />
          <div style={{ width:`${sharpPct}%`, background:"linear-gradient(90deg, #059669, #10b981)", borderRadius:"0 2px 2px 0" }} />
        </div>
      </div>

      {/* Tier badge if analyzed */}
      {bestResult && tier && (
        <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
          <div style={{ padding:"5px 20px", borderRadius:8, background:tier.bg, border:`1px solid ${tier.border}`, fontSize:11, fontWeight:800, color:tier.text, letterSpacing:"0.1em", display:"flex", alignItems:"center", gap:6 }}>
            {tier.label==="LOCK" && "🔒 "}{tier.label}
          </div>
        </div>
      )}

      {/* Result mini strip */}
      {hasAnyResult && (
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          {[["PUBLIC",resultPublic],["VEGAS",resultVegas]].map(([slot,result]) => {
            if (!result) return null;
            const ts = TIER_STYLES[result.summary.tier]||TIER_STYLES["3"];
            const iv = slot==="VEGAS";
            return (
              <div key={slot} style={{ flex:1, background: iv?"rgba(248,113,113,0.05)":"rgba(96,165,250,0.05)", border: iv?"1px solid rgba(248,113,113,0.15)":"1px solid rgba(96,165,250,0.15)", borderRadius:7, padding:"6px 8px" }}>
                <div style={{ fontSize:8, fontWeight:700, letterSpacing:"0.1em", color:iv?"#f87171":"#60a5fa", marginBottom:3 }}>{slot}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#f8fafc" }}>{result.summary.pick}</span>
                  <span style={{ fontSize:8, fontWeight:700, padding:"2px 5px", borderRadius:4, background:ts.bg, color:ts.text, border:`1px solid ${ts.border}` }}>{ts.label}</span>
                </div>
                <div style={{ fontSize:9, color:"#64748b", marginTop:1 }}>{result.summary.betType}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display:"flex", gap:8 }}>
        {["PUBLIC","VEGAS"].map(slot => {
          const key = `${game.id}-${slot}`;
          const isGen = generating===key;
          const hasRes = !!results[key];
          const iv = slot==="VEGAS";
          return (
            <button key={slot} onClick={e=>{e.stopPropagation(); onGenerate(game,slot);}} disabled={!!generating} style={{ flex:1, padding:"8px 0", background: isGen?(iv?"rgba(248,113,113,0.12)":"rgba(96,165,250,0.12)"):(hasRes?(iv?"rgba(248,113,113,0.06)":"rgba(96,165,250,0.06)"):"rgba(255,255,255,0.03)"), border:`1px solid ${(isGen||hasRes)?(iv?"rgba(248,113,113,0.35)":"rgba(96,165,250,0.35)"):(iv?"rgba(248,113,113,0.15)":"rgba(96,165,250,0.15)")}`, borderRadius:8, fontSize:10, fontWeight:700, letterSpacing:"0.06em", color:generating&&!isGen?"#2d3748":(iv?"#f87171":"#60a5fa"), cursor:generating?"not-allowed":"pointer" }}>
              {isGen ? "ANALYZING…" : hasRes ? `↻ ${slot}` : `Analyze as ${slot}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SPARKLINE SVG ─────────────────────────────────────────────────────────────

function Sparkline({ color = "#4ade80", width = 80, height = 36 }) {
  const pts = [18,22,14,28,20,32,24,36,28,30,38,32].map((v,i) => `${i*(width/11)},${height - (v/40)*height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// ── RADAR CHART ───────────────────────────────────────────────────────────────

function RadarChart() {
  const cx=80, cy=80, r=60;
  const rings = [0.25,0.5,0.75,1].map(f => ({r:r*f}));
  const dots = [
    {angle:-90, dist:0.85, color:"#3b82f6"},
    {angle:-10, dist:0.70, color:"#10b981"},
    {angle:50,  dist:0.55, color:"#f87171"},
    {angle:130, dist:0.80, color:"#c9a227"},
    {angle:200, dist:0.65, color:"#a78bfa"},
  ];
  const toDeg = (a, d) => ({
    x: cx + Math.cos(a*Math.PI/180)*r*d,
    y: cy + Math.sin(a*Math.PI/180)*r*d,
  });
  const spokes = [0,45,90,135,180,225,270,315].map(a => ({
    x1:cx, y1:cy,
    x2: cx + Math.cos(a*Math.PI/180)*r,
    y2: cy + Math.sin(a*Math.PI/180)*r,
  }));
  const filledPts = dots.map(d => toDeg(d.angle, d.dist));
  const polyStr = filledPts.map(p=>`${p.x},${p.y}`).join(" ");

  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {rings.map((rng,i) => <circle key={i} cx={cx} cy={cy} r={rng.r} fill="none" stroke="rgba(96,165,250,0.1)" strokeWidth="1" />)}
      {spokes.map((s,i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="rgba(96,165,250,0.08)" strokeWidth="1" />)}
      <polygon points={polyStr} fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" />
      {dots.map((d,i) => {
        const p = toDeg(d.angle, d.dist);
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={d.color} opacity="0.9" />;
      })}
    </svg>
  );
}

// ── CONFIDENCE MONITOR ────────────────────────────────────────────────────────

function ConfidenceChart() {
  const pts = [20,35,28,45,38,52,42,60,55,58,65,70,62,75,70].map((v,i) => `${i*(180/14)},${80-(v/80)*70}`).join(" ");
  return (
    <svg width="100%" height="60" viewBox="0 0 180 80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,80 ${pts} 180,80`} fill="url(#confGrad)" />
      <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── ODDS TICKER ───────────────────────────────────────────────────────────────

function OddsTicker() {
  const tickerRef = useRef(null);
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.4;
    const half = el.scrollWidth / 2;
    const tick = () => {
      pos += speed;
      if (pos >= half) pos = 0;
      el.scrollLeft = pos;
      requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const items = [...ODDS_FEED, ...ODDS_FEED];
  return (
    <div ref={tickerRef} style={{ overflowX:"hidden", display:"flex", gap:0, whiteSpace:"nowrap" }}>
      {items.map((o,i) => (
        <div key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"0 20px", borderRight:"1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#e2e8f0" }}>{o.team}{o.line}</span>
          <span style={{ fontSize:11, color: o.odds.startsWith("+") ? "#10b981" : "#e2e8f0", fontWeight:600 }}>{o.odds}</span>
          <span style={{ fontSize:10, color: o.up ? "#10b981" : "#f87171" }}>{o.up ? "▲" : "▼"}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function VegasVaultApp() {
  const [games, setGames]             = useState([]);
  const [trellAlerts, setTrellAlerts] = useState([]);
  const [results, setResults]         = useState({});
  const [generating, setGenerating]   = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [activeGame, setActiveGame]   = useState(null);
  const [filter, setFilter]           = useState("ALL");
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [time, setTime]               = useState(new Date());

  useEffect(() => {
    fetch("/api/today")
      .then(r => r.json())
      .then(data => { setGames(data.games||MOCK_GAMES); setTrellAlerts(data.trellAlerts||[]); setLoading(false); })
      .catch(() => { setGames(MOCK_GAMES); setLoading(false); });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const generated = Object.keys(results).length;
  const FILTERS = ["ALL","MLB","NBA","Tennis","NHL","NCAAF","SOCCER","NEW"];

  const filteredGames = games.filter(g => {
    if (filter==="MLB")    return g.sport==="MLB";
    if (filter==="NBA")    return g.sport==="NBA";
    if (filter==="Tennis") return g.sport==="Tennis";
    if (filter==="NEW")    return !results[`${g.id}-PUBLIC`] && !results[`${g.id}-VEGAS`];
    return true;
  });

  async function handleGenerate(game, slot) {
    const key = `${game.id}-${slot}`;
    setGenerating(key);
    setError(null);
    try {
      const gameWithSlot = { ...game, slot };
      const result = await generatePlay(gameWithSlot);
      setResults(prev => ({ ...prev, [key]:result }));
      setActiveResult(result);
      setActiveGame(gameWithSlot);
    } catch {
      setError("Generation failed. Check your Anthropic API key in Vercel environment variables.");
    } finally {
      setGenerating(null);
    }
  }

  function handleCardClick(game) {
    const result = results[`${game.id}-VEGAS`] || results[`${game.id}-PUBLIC`];
    if (result) { setActiveResult(result); setActiveGame(game); }
  }

  const today = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const timeStr = time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace", background:"#060810", minHeight:"100vh", color:"#e2e8f0", display:"flex", flexDirection:"column", minHeight:"100dvh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#060810;overflow-x:hidden;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
        button{font-family:inherit;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        .vv-sidebar{display:flex;}
        .vv-right-panel{display:flex;flex-direction:column;width:280px;flex-shrink:0;}
        .vv-right-stacked{display:none;}
        .vv-bottom-nav{display:none;}
        .vv-cards-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
        .vv-stat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;}
        .vv-nav-center{flex:1;display:flex;justify-content:center;}
        .vv-ticker-label{display:block;}
        @media(max-width:1024px){
          .vv-stat-grid{grid-template-columns:repeat(3,1fr)!important;}
          .vv-right-panel{display:none!important;}
          .vv-right-stacked{display:block!important;padding:0 16px 24px;}
        }
        @media(max-width:640px){
          .vv-sidebar{display:none!important;}
          .vv-bottom-nav{display:flex!important;position:fixed;bottom:0;left:0;right:0;height:58px;background:rgba(6,8,16,0.97);border-top:1px solid rgba(255,255,255,0.08);z-index:200;align-items:center;justify-content:space-around;padding:0 4px;backdrop-filter:blur(20px);}
          .vv-cards-grid{grid-template-columns:1fr!important;}
          .vv-stat-grid{grid-template-columns:repeat(2,1fr)!important;}
          .vv-nav-center{display:none!important;}
          .vv-ticker-label{display:none!important;}
          .vv-logo-label{display:none!important;}
          .vv-main-pad{padding:12px 12px 80px!important;}
          .vv-body-wrap{flex-direction:column!important;height:auto!important;overflow:visible!important;}
          .vv-main-scroll{overflow-y:visible!important;overflow-x:visible!important;height:auto!important;flex:none!important;}
        }
      `}</style>

      {/* TOP NAV BAR */}
      <div style={{ height:52, borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", background:"rgba(6,8,16,0.95)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:100, flexShrink:0 }}>
        {/* Logo zone */}
        <div style={{ width:200, padding:"0 20px", display:"flex", alignItems:"center", gap:10, borderRight:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#c9a227,#8b6914)", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#000" }}>V</div>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:"#f8fafc", letterSpacing:"0.06em" }}>VEGAS </span>
            <span style={{ fontSize:13, fontWeight:700, color:"#c9a227", letterSpacing:"0.06em" }}>VAULT</span>
            <span style={{ fontSize:10, color:"#4a5568", marginLeft:5 }}>AI</span>
          </div>
        </div>

        {/* Center tabs */}
        <div className="vv-nav-center" style={{ gap:0 }}>
          {["DASHBOARD","ALERTS 3","WATCHLIST 7"].map((tab,i) => (
            <div key={i} style={{ padding:"0 20px", height:52, display:"flex", alignItems:"center", gap:8, fontSize:11, fontWeight:i===0?600:400, color:i===0?"#c9a227":"#4a5568", borderBottom:i===0?"2px solid #c9a227":"2px solid transparent", cursor:"pointer", letterSpacing:"0.06em" }}>
              {i===1 && <span style={{ fontSize:8 }}>🔔</span>}
              {i===2 && <span style={{ fontSize:8 }}>☆</span>}
              {tab}
            </div>
          ))}
        </div>

        {/* Right icons */}
        <div style={{ display:"flex", alignItems:"center", gap:16, padding:"0 20px" }}>
          <span style={{ fontSize:16, color:"#2d3748", cursor:"pointer" }}>⌕</span>
          <span style={{ fontSize:16, color:"#2d3748", cursor:"pointer" }}>🔔</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#c9a227,#8b6914)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#000" }}>T</div>
            <span style={{ fontSize:11, color:"#64748b" }}>▼</span>
          </div>
        </div>
      </div>

      {/* BODY: sidebar + main + right panel */}
      <div className="vv-body-wrap" style={{ display:"flex", flex:1, minHeight:0 }}>

        {/* LEFT SIDEBAR */}
        <div className="vv-sidebar" style={{ width:200, background:"rgba(6,8,16,0.98)", borderRight:"1px solid rgba(255,255,255,0.05)", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ flex:1, padding:"12px 0" }}>
            {NAV_ITEMS.map((item,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", background:item.active?"rgba(201,162,39,0.08)":"transparent", borderLeft:item.active?"2px solid #c9a227":"2px solid transparent", cursor:"pointer", transition:"all 0.15s" }}>
                <span style={{ fontSize:12, color:item.active?"#c9a227":"#2d3748", width:16 }}>{item.icon}</span>
                <span style={{ fontSize:10, fontWeight:item.active?600:400, color:item.active?"#c9a227":"#475569", letterSpacing:"0.08em", flex:1 }}>{item.label}</span>
                {item.arrow && <span style={{ fontSize:9, color:"#2d3748" }}>▶</span>}
              </div>
            ))}
          </div>

          {/* AI Engine Status */}
          <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize:9, color:"#475569", letterSpacing:"0.1em", fontWeight:600, marginBottom:10 }}>AI ENGINE STATUS</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"#4ade80", fontWeight:600 }}>ONLINE</span>
              <span style={{ fontSize:10, color:"#4ade80", marginLeft:"auto" }}>100%</span>
            </div>
            <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:1, marginBottom:12 }}>
              <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,#10b981,#4ade80)", borderRadius:1 }} />
            </div>
            {/* Globe graphic */}
            <div style={{ display:"flex", justifyContent:"center" }}>
              <svg width={100} height={100} viewBox="0 0 100 100">
                <defs>
                  <radialGradient id="globeGrad" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#1e3a6e" />
                    <stop offset="100%" stopColor="#060c1a" />
                  </radialGradient>
                </defs>
                <circle cx={50} cy={50} r={45} fill="url(#globeGrad)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
                {[30,50,70].map((y,i)=><ellipse key={i} cx={50} cy={y} rx={45} ry={8} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="0.8" />)}
                <line x1={50} y1={5} x2={50} y2={95} stroke="rgba(59,130,246,0.15)" strokeWidth="0.8" />
                <line x1={5} y1={50} x2={95} y2={50} stroke="rgba(59,130,246,0.15)" strokeWidth="0.8" />
                {[[28,32],[55,45],[70,60],[40,65],[62,28]].map(([x,y],i)=>(
                  <circle key={i} cx={x} cy={y} r={2} fill="#3b82f6" opacity="0.7" />
                ))}
                <circle cx={50} cy={50} r={45} fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="0.5" />
              </svg>
            </div>
            <div style={{ fontSize:9, color:"#2d3748", textAlign:"center", marginTop:4 }}>Last updated: <span style={{ color:"#c9a227" }}>{timeStr}</span></div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="vv-main-scroll" style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", minWidth:0 }}>

          {/* Live odds ticker */}
          <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(10,14,24,0.9)", padding:"0" }}>
            <div style={{ display:"flex", alignItems:"center" }}>
              <div className="vv-ticker-label" style={{ padding:"8px 16px", fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#c9a227", borderRight:"1px solid rgba(255,255,255,0.06)", whiteSpace:"nowrap", flexShrink:0 }}>LIVE ODDS FEED</div>
              <div style={{ flex:1, overflow:"hidden", padding:"8px 0" }}>
                <OddsTicker />
              </div>
              <div style={{ padding:"0 16px", flexShrink:0 }}>
                <Sparkline color="#3b82f6" width={60} height={24} />
              </div>
            </div>
          </div>

          <div className="vv-main-pad" style={{ padding:"20px 20px 32px", flex:1 }}>

            {/* Greeting + stat cards */}
            <div style={{ marginBottom:20 }}>
              <div style={{ marginBottom:16 }}>
                <h1 style={{ fontSize:22, fontWeight:700, color:"#f8fafc", letterSpacing:"-0.02em" }}>{greeting}, Teztez4real.</h1>
                <p style={{ fontSize:12, color:"#475569", marginTop:4 }}>Vegas Vault AI is scanning <span style={{ color:"#3b82f6", cursor:"pointer" }}>12 sportsbooks...</span></p>
              </div>

              <div className="vv-stat-grid">
                {/* Today's games */}
                <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.1em", marginBottom:10, fontWeight:600 }}>TODAY'S GAMES</div>
                  <div style={{ fontSize:28, fontWeight:800, color:"#f8fafc", letterSpacing:"-0.02em", marginBottom:6 }}>{loading?"…":games.length}</div>
                  <div style={{ fontSize:10, color:"#2d3748" }}>{timeStr} CT</div>
                </div>

                {/* AI Picks generated */}
                <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.1em", marginBottom:10, fontWeight:600 }}>AI PICKS GENERATED</div>
                  <div style={{ fontSize:28, fontWeight:800, color:"#c9a227", letterSpacing:"-0.02em", marginBottom:8 }}>{generated} / {loading?"…":games.length*2}</div>
                  <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:1 }}>
                    <div style={{ height:"100%", width: games.length ? `${Math.min(100,(generated/(games.length*2))*100)}%` : "0%", background:"linear-gradient(90deg,#8b6914,#c9a227)", borderRadius:1, transition:"width 0.4s" }} />
                  </div>
                </div>

                {/* Win rate */}
                <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.1em", marginBottom:6, fontWeight:600 }}>WIN RATE (7D)</div>
                  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
                    <div style={{ fontSize:28, fontWeight:800, color:"#4ade80", letterSpacing:"-0.02em" }}>68%</div>
                    <Sparkline color="#4ade80" width={64} height={32} />
                  </div>
                </div>

                {/* Top tier */}
                <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.1em", marginBottom:10, fontWeight:600 }}>TOP TIER</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:24, fontWeight:800, color:"#f8fafc", letterSpacing:"-0.02em" }}>LOCK</div>
                    <span style={{ fontSize:22 }}>🔒</span>
                  </div>
                </div>

                {/* AI Confidence */}
                <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.1em", marginBottom:6, fontWeight:600 }}>AI CONFIDENCE</div>
                  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:800, color:"#c9a227" }}>HIGH</div>
                      <div style={{ fontSize:12, color:"#c9a227", opacity:0.7 }}>98.7%</div>
                    </div>
                    <RadarChart />
                  </div>
                </div>
              </div>
            </div>

            {/* Slate header + filters */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"#f8fafc" }}>Today's Slate</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:11, color:"#475569", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, padding:"4px 10px" }}>
                  {today} ▾
                </div>
                <div style={{ fontSize:14, color:"#2d3748", cursor:"pointer" }}>⊟</div>
              </div>
            </div>

            <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ fontSize:11, fontWeight:filter===f?700:400, padding:"5px 14px", borderRadius:6, border:`1px solid ${filter===f?"rgba(201,162,39,0.4)":"rgba(255,255,255,0.07)"}`, background:filter===f?"rgba(201,162,39,0.1)":"transparent", color:filter===f?"#c9a227":"#4a5568", cursor:"pointer", letterSpacing:"0.04em" }}>
                  {f}
                </button>
              ))}
            </div>

            {error && (
              <div style={{ background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#f87171", marginBottom:14 }}>{error}</div>
            )}

            {/* Cards */}
            {loading ? (
              <div style={{ textAlign:"center", padding:"60px 0", fontSize:11, color:"#2d3748", letterSpacing:"0.1em" }}>LOADING SLATE…</div>
            ) : (
              <div className="vv-cards-grid">
                {filteredGames.map(game => (
                  <GameCard key={game.id} game={game} results={results} generating={generating} onGenerate={handleGenerate} onCardClick={handleCardClick} />
                ))}
              </div>
            )}

            {/* Trell Alerts */}
            {trellAlerts.length > 0 && (
              <div style={{ marginTop:16, background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.05)", borderRadius:12, padding:16 }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#c9a227", marginBottom:12 }}>⚡ TRELL RULE ALERTS</div>
                {trellAlerts.map((alert,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<trellAlerts.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#f1f5f9" }}>{alert.player}</div>
                      <div style={{ fontSize:10, color:"#f87171", marginTop:2 }}>{alert.status} · {alert.direction}</div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:4, background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", color:"#f87171", letterSpacing:"0.08em" }}>ACTIVE</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


          {/* STACKED RIGHT PANEL — shows on tablet/mobile */}
          <div className="vv-right-stacked" style={{ padding:"0 16px 24px" }}>
            <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:14 }}>AI MARKET SCANNER</div>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <RadarChart />
                <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                  {[{label:"Reverse Line Movement",count:7,color:"#3b82f6"},{label:"Sharp Money Detected",count:5,color:"#10b981"},{label:"Public Heavy",count:6,color:"#94a3b8"},{label:"Vegas Trap Alert",count:3,color:"#f87171"}].map((item,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:9, color:"#4a5568" }}>{item.label}</span>
                      <span style={{ fontSize:15, fontWeight:800, color:item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:12 }}>AI INSIGHTS</div>
              {INSIGHTS.map((ins,i)=>(
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ width:20, height:20, borderRadius:5, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#3b82f6", flexShrink:0 }}>{ins.icon}</div>
                  <div>
                    <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.5 }}>{ins.text}</div>
                    <div style={{ fontSize:9, color:"#2d3748", marginTop:2 }}>{ins.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background:"#0b0f1a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:10 }}>AI CONFIDENCE MONITOR</div>
              <ConfidenceChart />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                <span style={{ fontSize:9, color:"#2d3748" }}>Overall AI Confidence</span>
                <span style={{ fontSize:18, fontWeight:800, color:"#4ade80" }}>98.7%</span>
              </div>
            </div>
          </div>

        {/* RIGHT PANEL */}
        <div className="vv-right-panel" style={{ background:"rgba(6,8,16,0.98)", borderLeft:"1px solid rgba(255,255,255,0.05)", overflowY:"auto", padding:"16px 16px 24px" }}>

          {/* AI Market Scanner */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:14 }}>AI MARKET SCANNER</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
              <RadarChart />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { label:"Reverse Line Movement", count:7, color:"#3b82f6" },
                { label:"Sharp Money Detected",  count:5, color:"#10b981" },
                { label:"Public Heavy",           count:6, color:"#94a3b8" },
                { label:"Vegas Trap Alert",       count:3, color:"#f87171" },
              ].map((item,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:9, color:"#4a5568", letterSpacing:"0.06em" }}>{item.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:item.color, letterSpacing:"-0.02em" }}>{item.count} <span style={{ fontSize:9, fontWeight:400, color:"#2d3748" }}>Games</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:16, marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:14 }}>AI INSIGHTS</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {INSIGHTS.map((ins,i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:20, height:20, borderRadius:5, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#3b82f6", flexShrink:0, marginTop:1 }}>{ins.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.5 }}>{ins.text}</div>
                    <div style={{ fontSize:9, color:"#2d3748", marginTop:3 }}>{ins.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:16 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#94a3b8", marginBottom:10 }}>AI CONFIDENCE MONITOR</div>
            <ConfidenceChart />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
              <span style={{ fontSize:9, color:"#2d3748" }}>Overall AI Confidence</span>
              <span style={{ fontSize:18, fontWeight:800, color:"#4ade80" }}>98.7%</span>
            </div>
          </div>
        </div>
      </div>


      {/* MOBILE BOTTOM NAV */}
      <div className="vv-bottom-nav">
        {[
          { icon:"⊞", label:"HOME"    },
          { icon:"◈", label:"SLATE"   },
          { icon:"◎", label:"ANALYZE" },
          { icon:"🔒", label:"LOCKS"   },
          { icon:"↺",  label:"HISTORY" },
        ].map((item,i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 12px", cursor:"pointer", opacity: i===0 ? 1 : 0.4 }}>
            <span style={{ fontSize:16, color: i===0 ? "#c9a227" : "#475569" }}>{item.icon}</span>
            <span style={{ fontSize:8, fontWeight:600, letterSpacing:"0.06em", color: i===0 ? "#c9a227" : "#475569" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {activeResult && activeGame && (
        <PlayResult result={activeResult} game={activeGame} onClose={() => { setActiveResult(null); setActiveGame(null); }} />
      )}
    </div>
  );
}
