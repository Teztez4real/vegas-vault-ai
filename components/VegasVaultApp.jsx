"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase as _supabase } from '@/lib/supabaseClient';

// ── SUPABASE CROSS-DEVICE SYNC ────────────────────────────────────────────────
async function syncLoad(userId, key) {
  try {
    const { data } = await _supabase.from('user_data').select('value').eq('user_id', userId).eq('key', key).single();
    return data?.value ? JSON.parse(data.value) : null;
  } catch { return null; }
}

async function syncSave(userId, key, value) {
  try {
    await _supabase.from('user_data').upsert({ user_id: userId, key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
  } catch(e) { console.warn('sync save failed:', e.message); }
}

async function syncDelete(userId, key) {
  try { await _supabase.from('user_data').delete().eq('user_id', userId).eq('key', key); } catch {}
}
function getSB() { return _supabase; }

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

const ADMIN_EMAIL = 'battlecortez@gmail.com';

// ── MOCK DATA ─────────────────────────────────────────────────────────────────

const MOCK_GAMES = [
  { id:1, sport:"MLB", slot:"PUBLIC", time:"11:15 AM CT", away:"Pittsburgh Pirates", home:"Toronto Blue Jays", awayCity:"PITTSBURGH", homeCity:"TORONTO", awayAbbr:"PIT", homeAbbr:"TOR", awayRecord:"26-26", homeRecord:"25-27", awayAwayRecord:"13-13", homeHomeRecord:"12-14", awayLast5:"2-3", homeLast5:"3-2", awayLast10:"5-5", homeLast10:"5-5", awayML:"+145", homeML:"-165", runLine:"Blue Jays -1.5 (+135)", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"4.12", homeBullpenERA:"3.89", awayOffense:"BA .241, OPS .698", homeOffense:"BA .252, OPS .731", h2hLast5:"Blue Jays 3-2", h2hAtHome:"Blue Jays 2-1 at Rogers last 3", injuries:"Check rotowire.com", lineMovement:"Blue Jays -155 to -165", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:2, sport:"MLB", slot:"VEGAS", time:"11:35 AM CT", away:"Detroit Tigers", home:"Baltimore Orioles", awayCity:"DETROIT", homeCity:"BALTIMORE", awayAbbr:"DET", homeAbbr:"BAL", awayRecord:"20-32", homeRecord:"22-29", awayAwayRecord:"9-18", homeHomeRecord:"11-13", awayLast5:"2-3", homeLast5:"3-2", awayLast10:"4-6", homeLast10:"5-5", awayML:"+138", homeML:"-158", runLine:"Orioles -1.5 (+152)", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"4.55", homeBullpenERA:"4.01", awayOffense:"BA .238, OPS .681", homeOffense:"BA .247, OPS .712", h2hLast5:"Orioles 3-2", h2hAtHome:"Orioles 2-1 at Camden last 3", injuries:"Check rotowire.com", lineMovement:"Stable", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:3, sport:"MLB", slot:"PUBLIC", time:"12:35 PM CT", away:"Minnesota Twins", home:"Boston Red Sox", awayCity:"MINNESOTA", homeCity:"BOSTON", awayAbbr:"MIN", homeAbbr:"BOS", awayRecord:"25-27", homeRecord:"22-29", awayAwayRecord:"12-14", homeHomeRecord:"10-15", awayLast5:"3-2", homeLast5:"2-3", awayLast10:"5-5", homeLast10:"4-6", awayML:"-118", homeML:"+100", runLine:"Twins -1.5 (+178)", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"3.98", homeBullpenERA:"4.34", awayOffense:"BA .248, OPS .715", homeOffense:"BA .243, OPS .701", h2hLast5:"Twins 3-2", h2hAtHome:"Red Sox 2-1 at Fenway last 3", injuries:"Check rotowire.com", lineMovement:"Twins -112 to -118", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:4, sport:"MLB", slot:"VEGAS", time:"12:35 PM CT", away:"Cleveland Guardians", home:"Philadelphia Phillies", awayCity:"CLEVELAND", homeCity:"PHILADELPHIA", awayAbbr:"CLE", homeAbbr:"PHI", awayRecord:"31-22", homeRecord:"25-26", awayAwayRecord:"15-12", homeHomeRecord:"12-14", awayLast5:"4-1", homeLast5:"2-3", awayLast10:"7-3", homeLast10:"4-6", awayML:"+102", homeML:"-122", runLine:"Phillies -1.5 (+158)", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"3.44", homeBullpenERA:"3.76", awayOffense:"BA .259, OPS .748", homeOffense:"BA .255, OPS .739", h2hLast5:"Guardians 4-1", h2hAtHome:"Phillies 2-1 at CBP last 3", injuries:"Check rotowire.com", lineMovement:"Phillies -115 to -122", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:5, sport:"MLB", slot:"PUBLIC", time:"12:35 PM CT", away:"Tampa Bay Rays", home:"New York Yankees", awayCity:"TAMPA BAY", homeCity:"NEW YORK", awayAbbr:"TB", homeAbbr:"NYY", awayRecord:"34-15", homeRecord:"30-22", awayAwayRecord:"16-9", homeHomeRecord:"15-11", awayLast5:"4-1", homeLast5:"3-2", awayLast10:"7-3", homeLast10:"6-4", awayML:"-108", homeML:"-112", runLine:"Even -1.5 lines", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"2.98", homeBullpenERA:"3.21", awayOffense:"BA .263, OPS .762", homeOffense:"BA .257, OPS .748", h2hLast5:"Rays 3-2", h2hAtHome:"Yankees 3-0 at Yankee Stadium last 3", injuries:"Check rotowire.com", lineMovement:"Very close — monitor", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
  { id:6, sport:"MLB", slot:"VEGAS", time:"12:40 PM CT", away:"St. Louis Cardinals", home:"Cincinnati Reds", awayCity:"ST. LOUIS", homeCity:"CINCINNATI", awayAbbr:"STL", homeAbbr:"CIN", awayRecord:"29-21", homeRecord:"26-25", awayAwayRecord:"14-11", homeHomeRecord:"13-12", awayLast5:"3-2", homeLast5:"3-2", awayLast10:"6-4", homeLast10:"5-5", awayML:"-128", homeML:"+108", runLine:"Cardinals -1.5 (+188)", awayPitcher:"TBD", homePitcher:"TBD", awayPitcherStats:"TBD", homePitcherStats:"TBD", awayBullpenERA:"3.67", homeBullpenERA:"4.12", awayOffense:"BA .252, OPS .729", homeOffense:"BA .248, OPS .714", h2hLast5:"Cardinals 3-2", h2hAtHome:"Reds 2-1 at GABP last 3", injuries:"Check rotowire.com", lineMovement:"Stable", seriesGame:"1", seriesLength:"3", date:"2026-05-23" },
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
  "1":    { bg:"rgba(74,222,128,0.12)",  border:"rgba(74,222,128,0.5)",  text:"#4ade80", label:"LOCK"   },
  "2":    { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.5)",  text:"#fbbf24", label:"TIER 2" },
  "3":    { bg:"rgba(148,163,184,0.08)", border:"rgba(148,163,184,0.3)", text:"#94a3b8", label:"TIER 3" },
  "PASS": { bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.5)", text:"#f87171", label:"PASS"   },
};
const CONF_STYLES = { HIGH:{color:"#4ade80"}, MEDIUM:{color:"#fbbf24"}, LOW:{color:"#f87171"} };

const NAV_ITEMS = [
  { icon:"⊞", label:"DASHBOARD",     active:true  },
  { icon:"📅", label:"TODAY'S SLATE", active:false },
  { icon:"◎",  label:"AI ANALYZER",  active:false },
  { icon:"🔒", label:"VAULT LOCKS",   active:false },
  { icon:"📊", label:"ODDS MOVEMENT", active:false },
  { icon:"💰", label:"SHARP MONEY",   active:false },
  { icon:"◇",  label:"PROPS AI",      active:false, arrow:true },
  { icon:"↺",  label:"HISTORY",       active:false },
  { icon:"⚙",  label:"SETTINGS",      active:false },
];

const ODDS_FEED = [
  {team:"LAD",line:"-1.5",odds:"-110",up:true},{team:"NYY",line:"+1.5",odds:"-105",up:false},
  {team:"HOU",line:"-1.5",odds:"-125",up:true},{team:"ATL",line:"+1.5",odds:"+102",up:false},
  {team:"SD", line:"-1.5",odds:"-115",up:true},{team:"PHI",line:"+1.5",odds:"-108",up:false},
  {team:"BOS",line:"+1.5",odds:"+118",up:true},{team:"CHC",line:"-1.5",odds:"-130",up:false},
  {team:"TOR",line:"-1.5",odds:"-145",up:true},{team:"TB", line:"+1.5",odds:"+125",up:false},
];

const INSIGHTS = [
  {icon:"◉",text:"Sharp money is on TOR, line moving from TOR -120 to -135",time:"2m ago"},
  {icon:"◈",text:"Public is 78% heavy on NYY — Potential fade spot",           time:"4m ago"},
  {icon:"○",text:"Weather edge detected in 3 games — Impacting totals",        time:"6m ago"},
  {icon:"◉",text:"Reverse line movement on SD — Sharp vs public split",        time:"11m ago"},
];

// ── MLB LOGO (ESPN CDN) ───────────────────────────────────────────────────────

// All 30 MLB teams — ESPN CDN slugs
const MLB_SLUGS = {
  "ARI":"ari","ATL":"atl","BAL":"bal","BOS":"bos",
  "CHC":"chc","CHW":"chw","CIN":"cin","CLE":"cle",
  "COL":"col","DET":"det","HOU":"hou","KC":"kc",
  "LAA":"laa","LAD":"lad","MIA":"mia","MIL":"mil",
  "MIN":"min","NYM":"nym","NYY":"nyy","OAK":"oak",
  "PHI":"phi","PIT":"pit","SD":"sd","SEA":"sea",
  "SF":"sf","STL":"stl","TB":"tb","TEX":"tex",
  "TOR":"tor","WSH":"wsh",
};

// Fallback brand colors for each team
const MLB_COLORS = {
  "ARI":"#A71930","ATL":"#CE1141","BAL":"#DF4601","BOS":"#BD3039",
  "CHC":"#0E3386","CHW":"#27251F","CIN":"#C6011F","CLE":"#0C2340",
  "COL":"#33006F","DET":"#0C2C56","HOU":"#002D62","KC":"#004687",
  "LAA":"#BA0021","LAD":"#005A9C","MIA":"#00A3E0","MIL":"#FFC52F",
  "MIN":"#002B5C","NYM":"#002D72","NYY":"#003087","OAK":"#003831",
  "PHI":"#E81828","PIT":"#FDB827","SD":"#2F241D","SEA":"#0C2C56",
  "SF":"#FD5A1E","STL":"#C41E3A","TB":"#092C5C","TEX":"#003278",
  "TOR":"#134A8E","WSH":"#AB0003",
};

function TeamLogo({ abbr, size=44, sport="MLB" }) {
  const [err, setErr] = useState(false);
  const slug = sport === "MLB" ? MLB_SLUGS[abbr] : null;

  if (slug && !err) {
    return (
      <img
        src={`https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`}
        alt={abbr}
        width={size} height={size}
        style={{ objectFit:"contain", flexShrink:0 }}
        onError={() => setErr(true)}
      />
    );
  }
  // Fallback colored box with initials
  const c = MLB_COLORS[abbr] || "#1e3a5f";
  return (
    <div style={{ width:size, height:size, borderRadius:8, background:`${c}22`, border:`1.5px solid ${c}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.3, fontWeight:900, color:c, flexShrink:0 }}>
      {abbr.slice(0,2)}
    </div>
  );
}

// ── ANALYSIS COMPONENTS ───────────────────────────────────────────────────────

function AnalysisRow({ index, label, value }) {
  return (
    <div style={{ padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"grid", gridTemplateColumns:"160px 1fr", gap:12, alignItems:"start" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
        <span style={{ width:18,height:18,borderRadius:4,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#3b82f6",fontWeight:700,flexShrink:0 }}>{index}</span>
        <span style={{ fontSize:9,color:"#3b82f6",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",lineHeight:1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize:12,color:"#cbd5e1",lineHeight:1.7 }}>{value}</div>
    </div>
  );
}

function ScamPlayBlock({ scam }) {
  if (!scam?.active) return (
    <div style={{ padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:8,display:"flex",alignItems:"center",gap:8 }}>
      <span style={{ color:"#4ade80" }}>✓</span>
      <span style={{ fontSize:11,color:"#4ade80" }}>No scam play — straightforward public side</span>
    </div>
  );
  return (
    <div style={{ background:"rgba(201,162,39,0.04)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 14px" }}>
      <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",background:"rgba(59,130,246,0.1)",padding:"3px 8px",borderRadius:4,display:"inline-block",marginBottom:10 }}>⚡ SCAM PLAY</div>
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:9,color:"#f87171",fontWeight:700,letterSpacing:"0.08em",marginBottom:3 }}>WHY IT LOOKS WRONG</div>
        <div style={{ fontSize:12,color:"#fca5a5",lineHeight:1.6 }}>{scam.whyItLooksWrong}</div>
      </div>
      <div>
        <div style={{ fontSize:9,color:"#4ade80",fontWeight:700,letterSpacing:"0.08em",marginBottom:3 }}>WHY IT'S ACTUALLY CORRECT</div>
        <div style={{ fontSize:12,color:"#86efac",lineHeight:1.6 }}>{scam.whyItsActuallyCorrect}</div>
      </div>
    </div>
  );
}

// ── PLAY RESULT MODAL ─────────────────────────────────────────────────────────

function PlayResult({ result, game, onClose, isResolved, resolvedResult }) {
  const [expanded, setExpanded] = useState(false);
  if (!result?.summary) return null;
  const tier = TIER_STYLES[result.summary.tier] || TIER_STYLES["3"];
  const conf = CONF_STYLES[result.summary.confidence] || CONF_STYLES.MEDIUM;
  const a = result.analysis;
  const isVegas = result.summary.slot === "VEGAS";
  const isTennis = game.sport === "Tennis";
  const baseballSteps = [
    {label:"Matchup Foundation",key:"matchupFoundation"},{label:"Records",key:"records"},
    {label:"Recent Form",key:"recentForm"},{label:"Head to Head",key:"headToHead"},
    {label:"Hitter & Lineup",key:"hitterLineup"},{label:"Pitching",key:"pitching"},
    {label:"Game Script",key:"gameScript"},{label:"Series Context",key:"seriesContext"},
    {label:"Trell Rule",key:"trellRule"},{label:"Pricing",key:"pricingComprehension"},
    {label:"Line Movement",key:"lineMovement"},{label:"Vegas vs Public",key:"vegasVsPublic"},
  ];
  const tennisSteps = [
    {label:"Matchup Foundation",key:"matchupFoundation"},{label:"Rankings & Tier",key:"rankingsTier"},
    {label:"Surface Analysis",key:"surfaceAnalysis"},{label:"Recent Form",key:"recentForm"},
    {label:"Tournament Context",key:"tournamentContext"},{label:"Fatigue & Schedule",key:"fatigueScheduling"},
    {label:"Head to Head",key:"headToHead"},{label:"Serve & Return",key:"serveReturn"},
    {label:"Mental & Psych",key:"mentalPsychological"},{label:"Injury Check",key:"injuryCheck"},
    {label:"Pricing Intelligence",key:"pricingIntelligence"},{label:"Game Script",key:"gameScript"},
  ];
  const steps = isTennis ? tennisSteps : baseballSteps;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(18px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#090d18",border:"1px solid rgba(255,255,255,0.09)",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 40px 100px rgba(0,0,0,0.9)" }}>
        <div style={{ padding:"14px 20px",borderBottom:"1px solid rgba(59,130,246,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:"#60a5fa",background:"rgba(96,165,250,0.1)",padding:"2px 8px",borderRadius:4 }}>{game.sport}</span>
            <span style={{ fontSize:12,color:"#475569" }}>{isTennis?`${game.player1} vs ${game.player2}`:`${game.away} @ ${game.home}`} · {game.time}</span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(59,130,246,0.1)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#64748b",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ padding:"22px 22px 18px" }}>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:18 }}>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.06em",padding:"4px 12px",borderRadius:6,background:tier.bg,border:`1px solid ${tier.border}`,color:tier.text }}>{tier.label}</span>
            <span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:isVegas?"rgba(248,113,113,0.08)":"rgba(96,165,250,0.08)",border:isVegas?"1px solid rgba(248,113,113,0.25)":"1px solid rgba(96,165,250,0.25)",color:isVegas?"#f87171":"#60a5fa",letterSpacing:"0.08em" }}>{isVegas?"VEGAS SLOT":"PUBLIC SLOT"}</span>
            {result.summary.isScamPlay&&<span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",color:"#3b82f6",letterSpacing:"0.08em" }}>⚡ SCAM PLAY</span>}
            <span style={{ fontSize:10,padding:"4px 12px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(59,130,246,0.14)",color:conf.color,marginLeft:"auto" }}>Confidence: <strong>{result.summary.confidence}</strong></span>
          </div>
          <div style={{ display:"flex",alignItems:"baseline",gap:12,marginBottom:10 }}>
            <span style={{ fontSize:30,fontWeight:800,color:"#f8fafc",letterSpacing:"-0.02em" }}>{result.summary.pick}</span>
            <span style={{ fontSize:17,fontWeight:600,color:"#3b82f6",background:"rgba(59,130,246,0.1)",padding:"2px 10px",borderRadius:6,border:"1px solid rgba(59,130,246,0.2)" }}>{result.summary.betType}</span>
          </div>
          <p style={{ fontSize:13,color:"#94a3b8",lineHeight:1.7,margin:0 }}>{result.summary.verdict}</p>
        </div>
        <div style={{ margin:"0 22px 18px",padding:"14px 16px",background:"rgba(201,162,39,0.04)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:10 }}>
          <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",marginBottom:8 }}>FINAL VERDICT</div>
          <p style={{ fontSize:13,color:"#e2e8f0",lineHeight:1.75,margin:0 }}>{result.finalVerdict}</p>

          {/* Auto-resolved result */}
          {isResolved && (
            <div style={{ marginTop:14,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:11,fontWeight:700,color:resolvedResult==='win'?"#4ade80":"#f87171",background:resolvedResult==='win'?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${resolvedResult==='win'?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"}`,borderRadius:8,padding:"5px 14px" }}>
                {resolvedResult==='win'?"✅ WIN":"❌ LOSS"}
              </span>
              <span style={{ fontSize:10,color:"#2d3a4a" }}>Auto-graded from final score</span>
            </div>
          )}
        </div>
        <div style={{ padding:"0 22px 18px" }}>
          <button onClick={()=>setExpanded(!expanded)} style={{ width:"100%",padding:"11px",background:expanded?"rgba(201,162,39,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${expanded?"rgba(59,130,246,0.2)":"rgba(59,130,246,0.12)"}`,borderRadius:10,fontSize:12,fontWeight:500,color:expanded?"#3b82f6":"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit" }}>
            <span style={{ fontSize:9,transform:expanded?"rotate(180deg)":"none",display:"inline-block",transition:"transform 0.2s" }}>▼</span>
            {expanded?"Collapse full breakdown":"View full Vegas Vault breakdown"}
          </button>
        </div>
        {expanded&&(
          <div style={{ padding:"0 22px 22px" }}>
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:4 }}>
              {steps.map((s,i)=><AnalysisRow key={s.key} index={i+1} label={s.label} value={a[s.key]||"—"} />)}
            </div>
            <div style={{ marginTop:18 }}>
              <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",marginBottom:10 }}>SCAM PLAY ANALYSIS</div>
              <ScamPlayBlock scam={a.scamPlay} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GAME CARD — matches reference image exactly ───────────────────────────────

function GameCard({ game, onGenerate, results, generating, onCardClick, liveScores, isSubscribed, finalized, isQueued, betReady, onShowAuth, watchlist, onToggleWatch }) {
  const resultPublic = results[`${game.id}-PUBLIC`];
  const resultWNBA   = results[`${game.id}-WNBA`];
  const resultVegas  = results[`${game.id}-VEGAS`];
  const hasAnyResult = resultPublic || resultVegas || resultWNBA;
  const bestResult   = resultVegas || resultPublic || resultWNBA;
  const tier = bestResult?.summary ? (TIER_STYLES[bestResult.summary.tier] || TIER_STYLES["3"]) : null;
  const isTennis = game.sport === "Tennis";
  const isLock = tier?.label === "LOCK";

  // ── LIVE SCORE LOOKUP ─────────────────────────────────────────────────────
  const liveKey1 = `${game.away}|${game.home}`;
  const liveKey2 = `${game.awayAbbr}|${game.homeAbbr}`;
  const awayLast = game.away?.split(' ').pop();
  const homeLast = game.home?.split(' ').pop();
  const liveKey3 = `${awayLast}|${homeLast}`;
  const live = liveScores?.[game.id] || liveScores?.[liveKey1] || liveScores?.[liveKey2] || liveScores?.[liveKey3];
  const isLive = live?.status === 'Live';
  const isFinal = live?.status === 'Final';
  const isDelayed = live?.isDelayed || false;
  const isPostponed = live?.isPostponed || false;
  const gameStarted = isLive || isFinal;

  const awayName = isTennis ? game.player1 : game.away;
  const homeName = isTennis ? game.player2 : game.home;
  const awayCity = game.awayCity || "";
  const homeCity = game.homeCity || "";
  // Full name → abbreviation lookup
  const NAME_TO_ABBR = {
    "Arizona Diamondbacks":"ARI","Atlanta Braves":"ATL","Baltimore Orioles":"BAL",
    "Boston Red Sox":"BOS","Chicago Cubs":"CHC","Chicago White Sox":"CHW",
    "Cincinnati Reds":"CIN","Cleveland Guardians":"CLE","Colorado Rockies":"COL",
    "Detroit Tigers":"DET","Houston Astros":"HOU","Kansas City Royals":"KC",
    "Los Angeles Angels":"LAA","Los Angeles Dodgers":"LAD","Miami Marlins":"MIA",
    "Milwaukee Brewers":"MIL","Minnesota Twins":"MIN","New York Mets":"NYM",
    "New York Yankees":"NYY","Oakland Athletics":"OAK","Philadelphia Phillies":"PHI",
    "Pittsburgh Pirates":"PIT","San Diego Padres":"SD","Seattle Mariners":"SEA",
    "San Francisco Giants":"SF","St. Louis Cardinals":"STL","Tampa Bay Rays":"TB",
    "Texas Rangers":"TEX","Toronto Blue Jays":"TOR","Washington Nationals":"WSH",
    // short names
    "Diamondbacks":"ARI","Braves":"ATL","Orioles":"BAL","Red Sox":"BOS",
    "Cubs":"CHC","White Sox":"CHW","Reds":"CIN","Guardians":"CLE","Rockies":"COL",
    "Tigers":"DET","Astros":"HOU","Royals":"KC","Angels":"LAA","Dodgers":"LAD",
    "Marlins":"MIA","Brewers":"MIL","Twins":"MIN","Mets":"NYM","Yankees":"NYY",
    "Athletics":"OAK","Phillies":"PHI","Pirates":"PIT","Padres":"SD",
    "Mariners":"SEA","Giants":"SF","Cardinals":"STL","Rays":"TB","Rangers":"TEX",
    "Blue Jays":"TOR","Nationals":"WSH",
  };
  const awayAbbr = game.awayAbbr || NAME_TO_ABBR[awayName] || NAME_TO_ABBR[awayName.split(" ").pop()] || awayName.slice(0,3).toUpperCase();
  const homeAbbr = game.homeAbbr || NAME_TO_ABBR[homeName] || NAME_TO_ABBR[homeName.split(" ").pop()] || homeName.slice(0,3).toUpperCase();
  const logoSport = game.sport;
  const awayRec  = isTennis ? `#${game.player1Ranking}` : game.awayRecord;
  const homeRec  = isTennis ? `#${game.player2Ranking}` : game.homeRecord;
  // Use real betting splits if available, otherwise hide
  const publicPct = game.publicBettingPct ?? null;
  const sharpPct  = game.sharpMoneyPct ?? (publicPct !== null ? 100 - publicPct : null);
  const hasRealSplits = publicPct !== null;
  const sportColor = game.sport==="MLB"?"#60a5fa":game.sport==="NBA"?"#fb923c":game.sport==="NFL"?"#34d399":"#a78bfa";
  const sportBg    = game.sport==="MLB"?"rgba(96,165,250,0.12)":game.sport==="NBA"?"rgba(251,146,60,0.12)":game.sport==="NFL"?"rgba(52,211,153,0.12)":"rgba(167,139,250,0.12)";

  return (
    <div
      onClick={()=>hasAnyResult&&onCardClick(game)}
      style={{
        background: isLock ? "linear-gradient(145deg,#0d1a10,#081210)" : "#0a0f1c",
        border: `1px solid ${isLock?"rgba(74,222,128,0.3)":hasAnyResult?(tier?.border||"rgba(59,130,246,0.2)"):"rgba(59,130,246,0.12)"}`,
        borderRadius:12, padding:"14px 16px",
        cursor:hasAnyResult?"pointer":"default",
        position:"relative", overflow:"hidden",
        boxShadow: isLock ? "0 0 30px rgba(74,222,128,0.08)" : "none",
      }}
    >
      {/* Gold glow top border for locks */}
      {isLock && <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#3b82f6 40%,#3b82f6 60%,transparent)" }} />}

      {/* Header row */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:sportColor,background:sportBg,padding:"2px 8px",borderRadius:4 }}>{game.sport}</span>
          {isLive && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#fff",background:"#dc2626",padding:"2px 8px",borderRadius:4,display:"flex",alignItems:"center",gap:4 }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:"#fff",display:"inline-block",animation:"pulse 1s infinite" }}/>
              LIVE
            </span>
          )}
          {isFinal && !isPostponed && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#64748b",background:"rgba(100,116,139,0.15)",padding:"2px 8px",borderRadius:4 }}>FINAL</span>
          )}
          {isDelayed && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#fbbf24",background:"rgba(251,191,36,0.12)",padding:"2px 8px",borderRadius:4 }}>⏸ DELAYED</span>
          )}
          {isPostponed && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#f87171",background:"rgba(248,113,113,0.12)",padding:"2px 8px",borderRadius:4 }}>⛔ POSTPONED</span>
          )}
          {/* Error badge — shown when analysis failed or couldn't parse */}
          {hasAnyResult && (bestResult?.error || bestResult?.parseError) && (
            <span style={{ fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:4,padding:"2px 8px",letterSpacing:"0.06em" }}>⚠ RE-ANALYZE</span>
          )}
          {betReady && !gameStarted && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#000",background:"linear-gradient(135deg,#3b82f6,#f59e0b)",padding:"2px 10px",borderRadius:4,animation:"pulse 1.5s infinite" }}>🎯 BET NOW</span>
          )}
          {!betReady && finalized && (finalized[`${game.id}-PUBLIC`] || finalized[`${game.id}-VEGAS`]) && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#3b82f6",background:"rgba(59,130,246,0.12)",padding:"2px 8px",borderRadius:4 }}>🔒 FINAL</span>
          )}
          {!betReady && isQueued && !finalized?.[`${game.id}-PUBLIC`] && (
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#60a5fa",background:"rgba(96,165,250,0.1)",padding:"2px 8px",borderRadius:4 }}>⟳ QUEUED</span>
          )}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:10,color:"#4a5568",fontVariantNumeric:"tabular-nums" }}>{game.time}</span>
          <span
            onClick={(e)=>{ e.stopPropagation(); if(onToggleWatch) onToggleWatch(game.id); }}
            title={watchlist?.includes(game.id) ? "Remove from watchlist" : "Add to watchlist"}
            style={{ fontSize:14,color:watchlist?.includes(game.id)?"#3b82f6":"#2a3545",cursor:"pointer",lineHeight:1,transition:"color 0.15s",userSelect:"none" }}
          >{watchlist?.includes(game.id)?"★":"☆"}</span>
        </div>
      </div>

      {/* Matchup — city + team name + logo layout */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 20px 1fr",alignItems:"center",gap:6,marginBottom:14 }}>
        {/* Away */}
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <TeamLogo abbr={awayAbbr} size={42} sport={logoSport} />
          <div>
            <div style={{ fontSize:9,color:"#4a6080",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontWeight:500 }}>{awayCity}</div>
            <div style={{ fontSize:16,fontWeight:800,color:"#f1f5f9",letterSpacing:"0.01em",textTransform:"uppercase",lineHeight:1 }}>{({"ARI":"DBACKS","ATL":"BRAVES","BAL":"ORIOLES","BOS":"RED SOX","CHC":"CUBS","CHW":"WHITE SOX","CIN":"REDS","CLE":"GUARDIANS","COL":"ROCKIES","DET":"TIGERS","HOU":"ASTROS","KC":"ROYALS","LAA":"ANGELS","LAD":"DODGERS","MIA":"MARLINS","MIL":"BREWERS","MIN":"TWINS","NYM":"METS","NYY":"YANKEES","OAK":"ATHLETICS","PHI":"PHILLIES","PIT":"PIRATES","SD":"PADRES","SEA":"MARINERS","SF":"GIANTS","STL":"CARDINALS","TB":"RAYS","TEX":"RANGERS","TOR":"BLUE JAYS","WSH":"NATIONALS"})[awayAbbr] || awayName.split(" ").pop().toUpperCase()}</div>
            <div style={{ fontSize:10,color:"#4a6080",marginTop:4,fontWeight:500 }}>{awayRec}</div>
          </div>
        </div>
        {/* @ */}
        <div style={{ textAlign:"center",fontSize:11,color:"#2a3545",fontWeight:700 }}>@</div>
        {/* Home */}
        <div style={{ display:"flex",alignItems:"center",gap:10,justifyContent:"flex-end" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9,color:"#4a6080",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontWeight:500 }}>{homeCity}</div>
            <div style={{ fontSize:16,fontWeight:800,color:"#f1f5f9",letterSpacing:"0.01em",textTransform:"uppercase",lineHeight:1 }}>{({"ARI":"DBACKS","ATL":"BRAVES","BAL":"ORIOLES","BOS":"RED SOX","CHC":"CUBS","CHW":"WHITE SOX","CIN":"REDS","CLE":"GUARDIANS","COL":"ROCKIES","DET":"TIGERS","HOU":"ASTROS","KC":"ROYALS","LAA":"ANGELS","LAD":"DODGERS","MIA":"MARLINS","MIL":"BREWERS","MIN":"TWINS","NYM":"METS","NYY":"YANKEES","OAK":"ATHLETICS","PHI":"PHILLIES","PIT":"PIRATES","SD":"PADRES","SEA":"MARINERS","SF":"GIANTS","STL":"CARDINALS","TB":"RAYS","TEX":"RANGERS","TOR":"BLUE JAYS","WSH":"NATIONALS"})[homeAbbr] || homeName.split(" ").pop().toUpperCase()}</div>
            <div style={{ fontSize:10,color:"#4a6080",marginTop:4,fontWeight:500 }}>{homeRec}</div>
          </div>
          <TeamLogo abbr={homeAbbr} size={42} sport={logoSport} />
        </div>
      </div>

      {/* LIVE SCORE DISPLAY */}
      {gameStarted && live && (
        <div style={{ marginBottom:12,background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:10,padding:"10px 14px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div style={{ textAlign:"center",flex:1 }}>
              <div style={{ fontSize:10,color:"#64748b",marginBottom:3 }}>{awayAbbr}</div>
              <div style={{ fontSize:28,fontWeight:900,color:"#f1f5f9",lineHeight:1 }}>{live.awayScore ?? '-'}</div>
            </div>
            <div style={{ textAlign:"center",padding:"0 12px" }}>
              {isLive ? (
                <div>
                  <div style={{ fontSize:10,color:"#dc2626",fontWeight:700 }}>{live.inningHalf?.slice(0,3).toUpperCase() || ''} {live.inning || ''}</div>
                  <div style={{ fontSize:9,color:"#4a5568",marginTop:2 }}>{live.outs ?? 0} out{live.outs===1?'':'s'}</div>
                </div>
              ) : (
                <div style={{ fontSize:10,color:"#64748b",fontWeight:600 }}>FINAL</div>
              )}
            </div>
            <div style={{ textAlign:"center",flex:1 }}>
              <div style={{ fontSize:10,color:"#64748b",marginBottom:3 }}>{homeAbbr}</div>
              <div style={{ fontSize:28,fontWeight:900,color:"#f1f5f9",lineHeight:1 }}>{live.homeScore ?? '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Public / Sharp money bar — only show real data */}
      {hasRealSplits && (
      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
          <span style={{ fontSize:8,color:"#1d4ed8",fontWeight:700,letterSpacing:"0.08em" }}>PUBLIC BETTING {publicPct}%</span>
          <span style={{ fontSize:8,color:"#059669",fontWeight:700,letterSpacing:"0.08em" }}>SHARP MONEY {sharpPct}%</span>
        </div>
        <div style={{ height:3,borderRadius:2,overflow:"hidden",display:"flex",background:"rgba(255,255,255,0.04)" }}>
          <div style={{ width:`${publicPct}%`,background:"linear-gradient(90deg,#1e40af,#3b82f6)",borderRadius:"2px 0 0 2px" }} />
          <div style={{ width:`${sharpPct}%`,background:"linear-gradient(90deg,#047857,#10b981)",borderRadius:"0 2px 2px 0" }} />
        </div>
      </div>
      )}

      {/* Sportsbook-style odds row */}
      {!isTennis && (game.awayML || game.homeML || game.spread || game.total) && (() => {
        const awayOdds = game.dkAwayML!=null?(typeof game.dkAwayML==='string'?game.dkAwayML:(game.dkAwayML>0?'+'+game.dkAwayML:String(game.dkAwayML))):game.awayML||'—';
        const homeOdds = game.dkHomeML!=null?(typeof game.dkHomeML==='string'?game.dkHomeML:(game.dkHomeML>0?'+'+game.dkHomeML:String(game.dkHomeML))):game.homeML||'—';
        const spreadVal = game.dkSpread||game.spread||'—';
        const totalVal = String(game.dkTotal||game.total||'—');
        const hasMovement = game.lineMovement && !['No significant movement','N/A','No significant movement detected'].includes(game.lineMovement);
        const awayColor = awayOdds.startsWith('-') ? '#f87171' : '#4ade80';
        const homeColor = homeOdds.startsWith('-') ? '#f87171' : '#4ade80';
        const awaySpread = spreadVal !== '—' ? (spreadVal.startsWith('-') ? '+'+spreadVal.slice(1) : '-'+spreadVal.replace('+','')) : '—';
        return (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:5 }}>
              <div style={{ fontSize:8,fontWeight:700,color:'#1d6fa5',background:'rgba(29,111,165,0.15)',border:'1px solid rgba(29,111,165,0.3)',borderRadius:3,padding:'1px 6px',letterSpacing:'0.06em' }}>DK</div>
              <span style={{ fontSize:8,color:'#2d3a4a',letterSpacing:'0.06em' }}>DRAFTKINGS ODDS</span>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5 }}>
              {/* Moneyline */}
              <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.14)',borderRadius:8,overflow:'hidden' }}>
                <div style={{ padding:'3px 0',textAlign:'center',fontSize:8,color:'#3a4a5e',letterSpacing:'0.08em',fontWeight:600,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>MONEYLINE</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>
                  <div style={{ padding:'7px 6px',textAlign:'center',borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>{game.awayAbbr||game.away?.split(' ').pop()}</div>
                    <div style={{ fontSize:14,fontWeight:700,color:awayColor,letterSpacing:'-0.02em' }}>{awayOdds}</div>
                  </div>
                  <div style={{ padding:'7px 6px',textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>{game.homeAbbr||game.home?.split(' ').pop()}</div>
                    <div style={{ fontSize:14,fontWeight:700,color:homeColor,letterSpacing:'-0.02em' }}>{homeOdds}</div>
                  </div>
                </div>
              </div>
              {/* Run Line / Spread */}
              <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.14)',borderRadius:8,overflow:'hidden' }}>
                <div style={{ padding:'3px 0',textAlign:'center',fontSize:8,color:'#3a4a5e',letterSpacing:'0.08em',fontWeight:600,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>{game.sport==='MLB'?'RUN LINE':'SPREAD'}</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>
                  <div style={{ padding:'7px 6px',textAlign:'center',borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>{game.awayAbbr||game.away?.split(' ').pop()}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#94a3b8' }}>{awaySpread}</div>
                  </div>
                  <div style={{ padding:'7px 6px',textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>{game.homeAbbr||game.home?.split(' ').pop()}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#94a3b8' }}>{spreadVal}</div>
                  </div>
                </div>
              </div>
              {/* Total */}
              <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.14)',borderRadius:8,overflow:'hidden' }}>
                <div style={{ padding:'3px 0',textAlign:'center',fontSize:8,color:'#3a4a5e',letterSpacing:'0.08em',fontWeight:600,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.02)' }}>TOTAL</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>
                  <div style={{ padding:'7px 6px',textAlign:'center',borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>OVER</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#60a5fa' }}>{totalVal !== '—' ? 'o'+totalVal : '—'}</div>
                  </div>
                  <div style={{ padding:'7px 6px',textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#475569',marginBottom:3,fontWeight:600 }}>UNDER</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#60a5fa' }}>{totalVal !== '—' ? 'u'+totalVal : '—'}</div>
                  </div>
                </div>
              </div>
            </div>
            {hasMovement && (
              <div style={{ marginTop:5,padding:'4px 8px',background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:6,fontSize:9,color:'#f87171',fontWeight:600 }}>
                ⚡ {game.lineMovement}
              </div>
            )}
          </div>
        );
      })()}

      {/* Lock badge */}
      {isLock && (
        <div style={{ display:"flex",justifyContent:"center",marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"5px 18px",fontSize:12,fontWeight:800,color:"#3b82f6",letterSpacing:"0.08em" }}>
            🔒 LOCK
          </div>
        </div>
      )}

      {/* Result strip */}
      {hasAnyResult && !isLock && (
        <div style={{ display:"flex",gap:6,marginBottom:10 }}>
          {([["PUBLIC",resultPublic],["VEGAS",resultVegas],["WNBA",resultWNBA]]).map(([slot,result])=>{
            if(!result)return null;
            if(game.slot && slot !== game.slot) return null;
            if (!result?.summary) return null;
            const ts=TIER_STYLES[result.summary.tier]||TIER_STYLES["3"];
            const iv=slot==="VEGAS"; const iw=slot==="WNBA";
            return(
              <div key={slot} style={{ flex:1,background:iw?"rgba(192,132,252,0.05)":iv?"rgba(248,113,113,0.05)":"rgba(96,165,250,0.05)",border:iw?"1px solid rgba(192,132,252,0.2)":iv?"1px solid rgba(248,113,113,0.15)":"1px solid rgba(96,165,250,0.15)",borderRadius:7,padding:"6px 8px" }}>
                <div style={{ fontSize:8,fontWeight:700,letterSpacing:"0.06em",color:iw?"#c084fc":iv?"#f87171":"#60a5fa",marginBottom:3 }}>{slot}</div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ fontSize:11,fontWeight:700,color:"#f8fafc" }}>{result.summary.pick.split(" ").pop()}</span>
                  <span style={{ fontSize:8,fontWeight:700,padding:"2px 5px",borderRadius:4,background:ts.bg,color:ts.text,border:`1px solid ${ts.border}` }}>{ts.label}</span>
                </div>
                <div style={{ fontSize:9,color:"#64748b",marginTop:1 }}>{result.summary.betType}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      {isPostponed ? (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"10px 0",background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.15)",borderRadius:8 }}>
          <span style={{ fontSize:10,fontWeight:700,color:"#f87171",letterSpacing:"0.08em" }}>⛔ POSTPONED — Analysis unavailable</span>
        </div>
      ) : isDelayed ? (
        <div style={{ display:"flex",gap:8 }}>
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 0",background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8 }}>
            <span style={{ fontSize:10,fontWeight:700,color:"#fbbf24",letterSpacing:"0.06em" }}>⏸ DELAYED</span>
          </div>
        </div>
      ) : gameStarted ? (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"10px 0",background:"rgba(220,38,38,0.05)",border:"1px solid rgba(220,38,38,0.15)",borderRadius:8 }}>
          <span style={{ fontSize:10,fontWeight:700,color:"#dc2626",letterSpacing:"0.08em" }}>
            {isLive ? "🔴 GAME IN PROGRESS — LOCKED" : "⬛ FINAL — ANALYSIS LOCKED"}
          </span>
        </div>
      ) : !isSubscribed ? (
        <div onClick={()=>{ if(onShowAuth) onShowAuth(); else window.location.href='/settings'; }} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",background:"rgba(7,9,26,0.6)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,cursor:"pointer" }}>
          <span style={{ fontSize:13 }}>🔒</span>
          <span style={{ fontSize:10,fontWeight:700,color:"#3b82f6",letterSpacing:"0.08em" }}>SUBSCRIBE TO UNLOCK</span>
        </div>
      ) : (
        (() => {
          const key = `${game.id}-${game.slot}`;
          const isGen = generating === key;
          const hasRes = !!results[key];
          const isVeg = game.slot === 'VEGAS';
          const isWNBA = game.sport === 'WNBA';
          const slotColor = isWNBA ? '#c084fc' : isVeg ? '#f87171' : '#60a5fa';
          const slotBg = isWNBA ? 'rgba(192,132,252,0.08)' : isVeg ? 'rgba(248,113,113,0.08)' : 'rgba(96,165,250,0.08)';
          const slotBorder = isWNBA ? 'rgba(192,132,252,0.25)' : isVeg ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)';
          if (isGen) return (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",background:slotBg,border:`1px solid ${slotBorder}`,borderRadius:8 }}>
              <div style={{ width:12,height:12,borderRadius:"50%",border:`2px solid ${slotBorder}`,borderTop:`2px solid ${slotColor}`,animation:"spin 0.8s linear infinite" }}/>
              <span style={{ fontSize:10,fontWeight:600,color:slotColor,letterSpacing:"0.06em" }}>ANALYZING {game.slot}…</span>
            </div>
          );
          if (hasRes) return (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 0",background:slotBg,border:`1px solid ${slotBorder}`,borderRadius:8 }}>
              <span style={{ fontSize:9,fontWeight:700,color:slotColor,letterSpacing:"0.08em" }}>
                {finalized?.[key] ? `🔒 ${game.slot} — FINAL` : `✓ ${game.slot} — ANALYZED`}
              </span>
            </div>
          );
          return (
            game.sport === 'WNBA' ? (
              <div onClick={()=>onGenerate(game, 'WNBA')} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 0",background:"rgba(192,132,252,0.08)",border:"1px solid rgba(192,132,252,0.25)",borderRadius:8,cursor:"pointer" }}>
                <span style={{ fontSize:9,fontWeight:700,color:"#c084fc",letterSpacing:"0.08em" }}>▶ ANALYZE WNBA</span>
              </div>
            ) : (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px 0",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(59,130,246,0.1)",borderRadius:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"#3b82f6",animation:"pulse 1.5s ease-in-out infinite" }}/>
              <span style={{ fontSize:9,fontWeight:600,color:"#3a4a5e",letterSpacing:"0.08em" }}>QUEUED FOR ANALYSIS</span>
            </div>
            )
          );
        })()
      )}
    </div>
  );
}

// ── SVG COMPONENTS ────────────────────────────────────────────────────────────

function Sparkline({ color="#4ade80", width=80, height=36 }) {
  const pts=[18,22,14,28,20,32,24,36,28,30,38,32].map((v,i)=>`${i*(width/11)},${height-(v/40)*height}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" /></svg>;
}

function RadarChart({ size=160 }) {
  const cx=size/2,cy=size/2,r=size*0.37;
  const rings=[0.3,0.55,0.8,1];
  const dots=[{a:-90,d:0.85,c:"#3b82f6"},{a:-18,d:0.72,c:"#a78bfa"},{a:54,d:0.6,c:"#10b981"},{a:126,d:0.82,c:"#f59e0b"},{a:198,d:0.68,c:"#f87171"}];
  const toXY=(a,d)=>({x:cx+Math.cos(a*Math.PI/180)*r*d,y:cy+Math.sin(a*Math.PI/180)*r*d});
  const poly=dots.map(d=>toXY(d.a,d.d));
  const polyStr=poly.map(p=>`${p.x},${p.y}`).join(" ");
  const spokes=[0,45,90,135,180,225,270,315];
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((f,i)=><circle key={i} cx={cx} cy={cy} r={r*f} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="1"/>)}
      {spokes.map((a,i)=><line key={i} x1={cx} y1={cy} x2={cx+Math.cos(a*Math.PI/180)*r} y2={cy+Math.sin(a*Math.PI/180)*r} stroke="rgba(59,130,246,0.08)" strokeWidth="1"/>)}
      <polygon points={polyStr} fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"/>
      {dots.map((d,i)=>{const p=toXY(d.a,d.d);return<circle key={i} cx={p.x} cy={p.y} r={3.5} fill={d.c} opacity="0.95"/>;})}
    </svg>
  );
}

function ConfidenceChart({ history }) {
  const base = [20,35,28,45,38,52,42,60,55,58,65,70,62,75,70];
  const data = history && history.length > 1 ? history : base;
  const pts = data.map((v,i)=>`${i*(200/(data.length-1))},${70-(v/100)*60}`).join(" ");
  return(
    <svg width="100%" height="56" viewBox="0 0 200 70" preserveAspectRatio="none">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity="0.25"/><stop offset="100%" stopColor="#4ade80" stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,70 ${pts} 200,70`} fill="url(#cg)"/>
      <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GlobeSVG({ timeStr }) {
  return(
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <defs><radialGradient id="gg" cx="38%" cy="32%"><stop offset="0%" stopColor="#1a3a6e"/><stop offset="100%" stopColor="#050a14"/></radialGradient></defs>
        <circle cx={55} cy={55} r={50} fill="url(#gg)" stroke="rgba(59,130,246,0.25)" strokeWidth="1"/>
        {[35,55,75].map((y,i)=><ellipse key={i} cx={55} cy={y} rx={50} ry={9} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="0.8"/>)}
        <line x1={55} y1={5} x2={55} y2={105} stroke="rgba(59,130,246,0.12)" strokeWidth="0.8"/>
        <line x1={5} y1={55} x2={105} y2={55} stroke="rgba(59,130,246,0.12)" strokeWidth="0.8"/>
        {[[30,35],[60,48],[75,65],[42,70],[65,30],[38,52]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={2.2} fill="#3b82f6" opacity="0.75"/>)}
        <circle cx={55} cy={55} r={50} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="0.5"/>
      </svg>
      <div style={{ fontSize:9,color:"#2d3a4a",textAlign:"center" }}>Last updated: <span style={{ color:"#3b82f6" }}>{timeStr}</span></div>
    </div>
  );
}

function OddsTicker({ feed }) {
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el)return;
    let pos=0; const speed=0.5;
    const getHalf=()=>el.scrollWidth/2;
    const tick=()=>{pos+=speed;if(pos>=getHalf())pos=0;el.scrollLeft=pos;requestAnimationFrame(tick);};
    const id=requestAnimationFrame(tick); return()=>cancelAnimationFrame(id);
  },[feed]);
  const items=[...feed,...feed];
  return(
    <div ref={ref} style={{ overflowX:"hidden",display:"flex",whiteSpace:"nowrap" }}>
      {items.map((o,i)=>(
        <div key={i} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"0 18px",borderRight:"1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"#cbd5e1" }}>{o.team}{o.line}</span>
          <span style={{ fontSize:11,fontWeight:600,color:o.odds&&o.odds.startsWith("+")?"#10b981":"#e2e8f0" }}>{o.odds}</span>
          <span style={{ fontSize:9,color:o.up?"#10b981":"#f87171" }}>{o.up?"▲":"▼"}</span>
        </div>
      ))}
    </div>
  );
}

// ── RIGHT PANEL CONTENT (reused for desktop + stacked mobile) ─────────────────

function RightPanelContent({ marketScanner, insights, aiConfidence, confHistory }) {
  return(
    <>
      {/* AI Market Scanner */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:"#64748b",marginBottom:14,display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:3,height:10,background:"#3b82f6",borderRadius:2,display:"inline-block" }}/>
          AI MARKET SCANNER
        </div>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:14 }}>
          <RadarChart size={160} />
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {[
            {label:"Reverse Line Movement",count:marketScanner.reverseLineMovement,sub:"Games",color:"#64748b"},
            {label:"Sharp Money Detected",  count:marketScanner.sharpMoneyDetected, sub:"Games",color:"#10b981"},
            {label:"Public Heavy",           count:marketScanner.publicHeavy,        sub:"Games",color:"#64748b"},
            {label:"Vegas Trap Alert",       count:marketScanner.vegasTrapAlert,     sub:"Games",color:"#f87171"},
          ].map((item,i)=>(
            <div key={i}>
              <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",marginBottom:1 }}>{item.label}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:5 }}>
                <span style={{ fontSize:22,fontWeight:800,color:item.color,letterSpacing:"-0.02em",lineHeight:1 }}>{item.count}</span>
                <span style={{ fontSize:9,color:"#2d3a4a" }}>{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:16,marginBottom:20 }}>
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:"#64748b",marginBottom:14,display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:3,height:10,background:"#3b82f6",borderRadius:2,display:"inline-block" }}/>
          AI INSIGHTS
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {insights.map((ins,i)=>(
            <div key={i} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
              <div style={{ width:22,height:22,borderRadius:6,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#3b82f6",flexShrink:0,marginTop:1 }}>{ins.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,color:"#94a3b8",lineHeight:1.55 }}>{ins.text}</div>
                <div style={{ fontSize:9,color:"#2d3a4a",marginTop:3 }}>{ins.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:16 }}>
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:"#64748b",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:3,height:10,background:"#4ade80",borderRadius:2,display:"inline-block" }}/>
          AI CONFIDENCE MONITOR
        </div>
        <ConfidenceChart history={confHistory} />
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 }}>
          <span style={{ fontSize:9,color:"#2d3a4a" }}>Overall AI Confidence</span>
          <span style={{ fontSize:22,fontWeight:800,color:aiConfidence===null?"#4ade80":aiConfidence>=75?"#4ade80":aiConfidence>=50?"#fbbf24":"#f87171",letterSpacing:"-0.02em" }}>{aiConfidence!==null?`${aiConfidence}%`:"—"}</span>
        </div>
      </div>
    </>
  );
}


// ── TOP PLAY BANNER ──────────────────────────────────────────────────────────
function TopPlayBanner({ topPlay, loading, results, games, pickHistory, isSubscribed, onShowAuth, onForceRefresh, isAdmin }) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !topPlay) {
    return (
      <div style={{ background:'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(201,162,39,0.03))',border:'1px solid rgba(59,130,246,0.3)',borderRadius:14,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12 }}>
        <div style={{ width:28,height:28,borderRadius:'50%',border:'2px solid rgba(59,130,246,0.3)',borderTop:'2px solid #3b82f6',animation:'spin 0.8s linear infinite',flexShrink:0 }}/>
        <div>
          <div style={{ fontSize:11,fontWeight:700,color:'#3b82f6',letterSpacing:'0.08em' }}>⭐ TOP PLAY OF THE DAY</div>
          <div style={{ fontSize:11,color:'#3a4a5e',marginTop:2 }}>AI is analyzing the best game for today...</div>
        </div>
      </div>
    );
  }

  if (!topPlay?.result) return null;

  const summary = topPlay.result?.summary;
  if (!summary) return null;

  const isVegas = topPlay.slot === 'VEGAS';
  const slotColor = isVegas ? '#f87171' : '#60a5fa';
  const slotBg    = isVegas ? 'rgba(248,113,113,0.1)' : 'rgba(96,165,250,0.1)';

  // Look up win/loss result from pickHistory
  const [tpAway, tpHome] = (topPlay.game_key||'').split('|');
  const matchingGame = games?.find(g => g.away === tpAway && g.home === tpHome);
  const tpHistoryEntry = pickHistory?.find(p =>
    matchingGame && p.key === `${matchingGame.id}-${topPlay.slot}` && p.result
  );
  const tpResult = tpHistoryEntry?.result || null; // 'win' | 'loss' | null
  const tierColors = { '1':'#3b82f6', '2':'#60a5fa', '3':'#475569', 'PASS':'#f87171' };
  const tierColor  = tierColors[summary.tier] || '#3b82f6';
  const isPass     = summary.tier === 'PASS' || summary.tier === '3';

  // Extract final verdict — look in multiple places
  const verdict = topPlay.result?.finalVerdict || topPlay.result?.analysis?.finalVerdict || summary.verdict || '';
  const scamPlay = topPlay.result?.scamPlay || topPlay.result?.analysis?.scamPlay;

  return (
    <div className="vv-top-play" style={{ background:`linear-gradient(135deg,rgba(59,130,246,0.1),rgba(201,162,39,0.04))`,border:'1px solid rgba(59,130,246,0.4)',borderRadius:14,marginBottom:20,overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.4)',borderRadius:8,padding:'4px 10px',display:'flex',alignItems:'center',gap:5 }}>
            <span style={{ fontSize:12 }}>⭐</span>
            <span style={{ fontSize:9,fontWeight:800,color:'#3b82f6',letterSpacing:'0.08em' }}>TOP PLAY</span>
          </div>
          <span style={{ fontSize:9,fontWeight:700,color:slotColor,background:slotBg,borderRadius:4,padding:'2px 8px',letterSpacing:'0.08em' }}>{topPlay.slot}</span>
          {!isPass && <span style={{ fontSize:9,fontWeight:700,color:tierColor,background:'rgba(59,130,246,0.08)',borderRadius:4,padding:'2px 8px' }}>
            {summary.tier === '1' ? '🔒 LOCK' : `Tier ${summary.tier}`}
          </span>}
          {isPass && <span style={{ fontSize:9,fontWeight:700,color:'#f87171',background:'rgba(248,113,113,0.1)',borderRadius:4,padding:'2px 8px' }}>🚫 NO PLAY</span>}
          {tpResult === 'win' && (
            <span style={{ fontSize:11,fontWeight:800,color:'#4ade80',background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.4)',borderRadius:6,padding:'3px 10px' }}>✅ WIN</span>
          )}
          {tpResult === 'loss' && (
            <span style={{ fontSize:11,fontWeight:800,color:'#f87171',background:'rgba(248,113,113,0.12)',border:'1px solid rgba(248,113,113,0.4)',borderRadius:6,padding:'3px 10px' }}>❌ LOSS</span>
          )}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {isAdmin && (
            <button onClick={(e)=>{e.stopPropagation();onForceRefresh();}} style={{ background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'4px 10px',fontSize:9,color:'#3a4a5e',cursor:'pointer',fontFamily:'inherit' }}>↺ Re-analyze</button>
          )}
          <button onClick={()=>setExpanded(e=>!e)} style={{ background:'transparent',border:'none',color:'#3b82f6',fontSize:16,cursor:'pointer',padding:'0 4px' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Game info — always visible */}
      <div style={{ padding:'0 14px 14px',borderBottom:'1px solid rgba(59,130,246,0.15)' }}>
        <div style={{ fontSize:16,fontWeight:800,color:'#f1f5f9',letterSpacing:'-0.01em' }}>
          {topPlay.away_abbr||topPlay.away?.split(' ').pop()} @ {topPlay.home_abbr||topPlay.home?.split(' ').pop()}
        </div>
        <div style={{ fontSize:10,color:'#3a4a5e',marginTop:2 }}>{topPlay.time}</div>
      </div>

      {/* SUBSCRIBED — full content */}
      {isSubscribed ? (
        <>
          {!isPass && (
            <div style={{ padding:'12px 14px',borderBottom:'1px solid rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
              <div style={{ background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:10,padding:'10px 16px',textAlign:'center',minWidth:120 }}>
                <div style={{ fontSize:9,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:3 }}>THE PLAY</div>
                <div style={{ fontSize:14,fontWeight:800,color:'#3b82f6' }}>{summary.pick}</div>
                <div style={{ fontSize:10,color:'#94a3b8',marginTop:1 }}>{summary.betType}</div>
              </div>
              {tpResult && (
                <div style={{ fontSize:20,fontWeight:900,color:tpResult==='win'?'#4ade80':'#f87171' }}>
                  {tpResult==='win' ? '✅ WIN' : '❌ LOSS'}
                </div>
              )}
            </div>
          )}

          {/* Verdict */}
          {verdict && !isPass && (
            <div style={{ padding:'12px 14px',borderBottom:expanded?'1px solid rgba(59,130,246,0.1)':'none' }}>
              <div style={{ fontSize:11,color:'#94a3b8',lineHeight:1.6 }}>
                {expanded ? verdict : verdict.slice(0,200)+(verdict.length>200?'...':'')}
              </div>
            </div>
          )}
          {isPass && (
            <div style={{ padding:'12px 14px' }}>
              <div style={{ fontSize:11,color:'#f87171',lineHeight:1.6 }}>{verdict||'No clear edge today. Best play is to sit out.'}</div>
            </div>
          )}

          {/* Expanded full analysis */}
          {expanded && !isPass && (
            <div style={{ padding:'14px',background:'rgba(0,0,0,0.2)' }}>
              {scamPlay && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9,fontWeight:700,color:isVegas?'#f87171':'#60a5fa',letterSpacing:'0.1em',marginBottom:6 }}>
                    {isVegas?'🎰 SCAM PLAY BREAKDOWN':'📋 ANALYSIS'}
                  </div>
                  {scamPlay.whyItLooksWrong && (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:9,color:'#f87171',fontWeight:700,marginBottom:3 }}>❌ WHY IT LOOKS WRONG:</div>
                      <div style={{ fontSize:11,color:'#94a3b8',lineHeight:1.5 }}>{scamPlay.whyItLooksWrong}</div>
                    </div>
                  )}
                  {scamPlay.whyItsActuallyCorrect && (
                    <div>
                      <div style={{ fontSize:9,color:'#4ade80',fontWeight:700,marginBottom:3 }}>✅ WHY IT'S ACTUALLY CORRECT:</div>
                      <div style={{ fontSize:11,color:'#94a3b8',lineHeight:1.5 }}>{scamPlay.whyItsActuallyCorrect}</div>
                    </div>
                  )}
                </div>
              )}
              {summary.gameScript && (
                <div style={{ marginBottom:10,padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize:9,color:'#3a4a5e',letterSpacing:'0.08em',marginBottom:3 }}>GAME SCRIPT</div>
                  <div style={{ fontSize:11,color:'#94a3b8' }}>{summary.gameScript}</div>
                </div>
              )}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
                {summary.confidence && (
                  <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:8,padding:'8px',textAlign:'center' }}>
                    <div style={{ fontSize:8,color:'#3a4a5e',marginBottom:2 }}>CONFIDENCE</div>
                    <div style={{ fontSize:11,fontWeight:700,color:summary.confidence==='HIGH'?'#4ade80':summary.confidence==='MEDIUM'?'#3b82f6':'#f87171' }}>{summary.confidence}</div>
                  </div>
                )}
                {summary.betType && (
                  <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:8,padding:'8px',textAlign:'center' }}>
                    <div style={{ fontSize:8,color:'#3a4a5e',marginBottom:2 }}>BET TYPE</div>
                    <div style={{ fontSize:11,fontWeight:700,color:'#e2e8f0' }}>{summary.betType}</div>
                  </div>
                )}
                {topPlay.slot && (
                  <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:8,padding:'8px',textAlign:'center' }}>
                    <div style={{ fontSize:8,color:'#3a4a5e',marginBottom:2 }}>SLOT</div>
                    <div style={{ fontSize:11,fontWeight:700,color:slotColor }}>{topPlay.slot}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* NON-SUBSCRIBER — locked */
        <div onClick={onShowAuth} style={{ padding:'20px 14px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',background:'rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:22 }}>🔒</span>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:'#3b82f6',letterSpacing:'0.04em' }}>Subscribe to Unlock</div>
              <div style={{ fontSize:11,color:'#3a4a5e',marginTop:2 }}>Get the Top Play + all game analysis</div>
            </div>
          </div>
          <div style={{ background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',borderRadius:8,padding:'8px 24px',fontSize:11,fontWeight:700,color:'#000',letterSpacing:'0.06em' }}>
            SUBSCRIBE NOW
          </div>
        </div>
      )}
    </div>
  );
}

// ── ALERTS VIEW ───────────────────────────────────────────────────────────────
function AlertsView({ betReadyAlerts, trellAlerts, games, results, pickHistory, watchlist }) {
  const allAlerts = [
    ...Object.entries(betReadyAlerts)
      .filter(([key]) => {
        const game = games.find(g => key.startsWith(g.id+'-'));
        return game && watchlist.includes(game.id);
      })
      .map(([key, data]) => ({
        type: 'BET_READY', key, data,
        game: games.find(g => key.startsWith(g.id+'-')),
        slot: key.split('-').pop(),
        title: '🔔 Bet Ready',
        color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)',
      })),
    ...trellAlerts
      .filter(a => {
        if (!a.gameId) return true; // global trell alerts always show
        return watchlist.includes(a.gameId);
      })
      .map((a, i) => ({
        type: 'TRELL', key: `trell-${i}`, data: a,
        title: '⚡ Trell Rule Alert', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)',
      })),
  ];

  const pendingPicks = pickHistory.filter(p => !p.result);
  const recentWins = pickHistory.filter(p => p.result==='win').slice(-3);

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>🔔 Alerts</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>{allAlerts.length} active alerts · {pendingPicks.length} pending picks</p>
      </div>

      {allAlerts.length === 0 && (
        <div style={{ textAlign:'center',padding:'60px 20px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.05)',marginBottom:16 }}>
          <div style={{ fontSize:32,marginBottom:12 }}>🔕</div>
          <div style={{ fontSize:14,fontWeight:600,color:'#2d3a4a',marginBottom:6 }}>No active alerts</div>
          <div style={{ fontSize:12,color:'#1e2a3a' }}>Alerts fire when games are about to start,<br/>Trell Rule activates, or sharp money moves.</div>
        </div>
      )}

      {allAlerts.map((alert, i) => (
        <div key={alert.key} style={{ background:alert.bg,border:`1px solid ${alert.border}`,borderRadius:12,padding:'14px 16px',marginBottom:10 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
            <span style={{ fontSize:12,fontWeight:700,color:alert.color }}>{alert.title}</span>
          </div>
          {alert.game && <div style={{ fontSize:12,color:'#e2e8f0',fontWeight:600 }}>{alert.game.away} @ {alert.game.home}</div>}
          {alert.data?.message && <div style={{ fontSize:11,color:'#94a3b8',marginTop:4 }}>{alert.data.message}</div>}
          {alert.type==='BET_READY' && alert.game && (
            <div style={{ fontSize:11,color:'#94a3b8',marginTop:4 }}>{alert.slot} slot · {alert.game.time}</div>
          )}
          {alert.type==='TRELL' && typeof alert.data === 'object' && (
            <div style={{ fontSize:11,color:'#94a3b8',marginTop:4 }}>{alert.data.team} — {alert.data.note}</div>
          )}
        </div>
      ))}

      {/* Recent Wins */}
      {recentWins.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10 }}>RECENT WINS</div>
          {recentWins.reverse().map((p,i) => (
            <div key={i} style={{ background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11,fontWeight:600,color:'#e2e8f0' }}>{p.pick}</div>
                <div style={{ fontSize:10,color:'#3a4a5e' }}>{p.game} · {p.slot}</div>
              </div>
              <div style={{ fontSize:13,fontWeight:800,color:'#4ade80' }}>✅ WIN</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Picks */}
      {pendingPicks.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10 }}>PENDING PICKS ({pendingPicks.length})</div>
          {pendingPicks.map((p,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:10,padding:'10px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11,fontWeight:600,color:'#e2e8f0' }}>{p.pick}</div>
                <div style={{ fontSize:10,color:'#3a4a5e' }}>{p.game} · {p.slot}</div>
              </div>
              <div style={{ fontSize:11,color:'#3a4a5e',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:6,padding:'4px 10px' }}>PENDING</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WATCHLIST VIEW ────────────────────────────────────────────────────────────
function WatchlistView({ watchlist, toggleWatch, games, results, finalized }) {
  const watchedGames = games.filter(g => watchlist.includes(g.id));
  const unwatchedGames = games.filter(g => !watchlist.includes(g.id));

  const NOTIF_TYPES = [
    { icon:'🔔', label:'Bet Ready', desc:'30 min before game starts' },
    { icon:'⚡', label:'Trell Rule', desc:'Star player in/out' },
    { icon:'📈', label:'Line Movement', desc:'Sharp money detected' },
    { icon:'🔒', label:'Finalized Play', desc:'AI locks in the pick' },
    { icon:'🚨', label:'Injury Alert', desc:'Key player update' },
  ];

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>★ My Games</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>Choose which games to receive notifications for. AI tracks all games — you only get alerted on yours.</p>
      </div>

      {/* Notification types legend */}
      <div style={{ background:'rgba(201,162,39,0.05)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:12,padding:'12px 16px',marginBottom:20 }}>
        <div style={{ fontSize:9,fontWeight:700,color:'#3b82f6',letterSpacing:'0.1em',marginBottom:8 }}>YOU GET NOTIFIED FOR WATCHLISTED GAMES WHEN:</div>
        <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
          {NOTIF_TYPES.map((n,i) => (
            <div key={i} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:8,padding:'5px 10px' }}>
              <span style={{ fontSize:11 }}>{n.icon}</span>
              <div>
                <div style={{ fontSize:9,fontWeight:700,color:'#e2e8f0' }}>{n.label}</div>
                <div style={{ fontSize:8,color:'#3a4a5e' }}>{n.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Watched games */}
      <div style={{ fontSize:10,fontWeight:700,color:'#3b82f6',letterSpacing:'0.1em',marginBottom:10 }}>
        MY GAMES ({watchedGames.length}) <span style={{ color:'#3a4a5e',fontWeight:400 }}>— notifications ON</span>
      </div>

      {watchedGames.length === 0 ? (
        <div style={{ textAlign:'center',padding:'30px 20px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.05)',marginBottom:20 }}>
          <div style={{ fontSize:24,marginBottom:8 }}>☆</div>
          <div style={{ fontSize:13,fontWeight:600,color:'#2d3a4a',marginBottom:4 }}>No games selected yet</div>
          <div style={{ fontSize:11,color:'#1e2a3a' }}>Add games below — or tap ☆ on any card from the dashboard.</div>
        </div>
      ) : (
        <div style={{ marginBottom:20 }}>
          {watchedGames.map((game) => {
            const hasResult = results[`${game.id}-PUBLIC`] || results[`${game.id}-VEGAS`];
            const isFin = finalized?.[`${game.id}-PUBLIC`] || finalized?.[`${game.id}-VEGAS`];
            const lmLower = (game.lineMovement||'').toLowerCase();
            const isSharp = lmLower.includes('sharp') || lmLower.includes('steam') || lmLower.includes('reverse') || !!game.rlm;
            return (
              <div key={game.id} style={{ background:'rgba(201,162,39,0.04)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:12,padding:'14px 16px',marginBottom:8 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                    <span style={{ fontSize:9,fontWeight:700,color:game.slot==='VEGAS'?'#f87171':'#60a5fa',background:game.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{game.sport}·{game.slot}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:'#f1f5f9' }}>{game.awayAbbr||game.away?.split(' ').pop()} @ {game.homeAbbr||game.home?.split(' ').pop()}</span>
                    <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
                  </div>
                  <button onClick={()=>toggleWatch(game.id)} title="Remove from watchlist" style={{ background:'transparent',border:'none',color:'#3b82f6',fontSize:18,cursor:'pointer',lineHeight:1,padding:'0 2px' }}>★</button>
                </div>
                {/* Status badges */}
                <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                  <span style={{ fontSize:9,color:(game.awayML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.awayML}</span>
                  <span style={{ fontSize:9,color:'#2d3a4a' }}>·</span>
                  <span style={{ fontSize:9,color:(game.homeML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.homeML}</span>
                  {isSharp && <span style={{ fontSize:9,fontWeight:700,color:'#f87171',background:'rgba(248,113,113,0.1)',borderRadius:4,padding:'1px 6px' }}>⚡ SHARP</span>}
                  {hasResult && !isFin && <span style={{ fontSize:9,fontWeight:700,color:'#60a5fa',background:'rgba(96,165,250,0.08)',borderRadius:4,padding:'1px 6px' }}>✓ ANALYZED</span>}
                  {isFin && <span style={{ fontSize:9,fontWeight:700,color:'#3b82f6',background:'rgba(59,130,246,0.1)',borderRadius:4,padding:'1px 6px' }}>🔒 FINALIZED</span>}
                  <span style={{ fontSize:9,color:'#1e2a3a',marginLeft:'auto' }}>{game.lineMovement?.slice(0,40)||'No data'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All other games to add */}
      {unwatchedGames.length > 0 && (
        <>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10 }}>
            ALL GAMES ({unwatchedGames.length}) <span style={{ fontWeight:400 }}>— tap to add</span>
          </div>
          {unwatchedGames.map((game) => (
            <div key={game.id} onClick={()=>toggleWatch(game.id)} style={{ background:'rgba(255,255,255,0.01)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:10,padding:'11px 14px',marginBottom:6,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0 }}>
                <span style={{ fontSize:9,fontWeight:700,color:game.slot==='VEGAS'?'#f87171':'#60a5fa',background:game.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px',flexShrink:0 }}>{game.slot}</span>
                <span style={{ fontSize:11,fontWeight:600,color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
                <span style={{ fontSize:10,color:'#2d3a4a',flexShrink:0 }}>{game.time}</span>
              </div>
              <span style={{ fontSize:16,color:'#2d3a4a',marginLeft:8 }}>☆</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── SHARP MONEY VIEW ──────────────────────────────────────────────────────────
function SharpMoneyView({ games, marketScanner }) {
  const sharpGames = games.filter(g => {
    const lm = (g.lineMovement||'').toLowerCase();
    return lm.includes('sharp') || lm.includes('steam') || lm.includes('reverse') || g.rlm;
  });
  const movingGames = games.filter(g => {
    const lm = g.lineMovement||'';
    return lm.includes('moved toward') && !sharpGames.includes(g);
  });

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>💰 Sharp Money</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>Real-time sharp action · FanDuel vs DraftKings vs BetOnline</p>
      </div>

      {/* Market Scanner Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:20 }}>
        {[
          { label:'SHARP SIGNALS', value:marketScanner.sharpMoneyDetected, color:'#f87171', icon:'⚡' },
          { label:'REVERSE LINE', value:marketScanner.reverseLineMovement, color:'#3b82f6', icon:'↩' },
          { label:'PUBLIC HEAVY', value:marketScanner.publicHeavy, color:'#60a5fa', icon:'👥' },
          { label:'VEGAS TRAPS', value:marketScanner.vegasTrapAlert, color:'#a78bfa', icon:'🎰' },
        ].map((s,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:12,padding:'14px 16px' }}>
            <div style={{ fontSize:9,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:6 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize:28,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:9,color:'#2d3a4a',marginTop:2 }}>games today</div>
          </div>
        ))}
      </div>

      {/* Sharp games */}
      {sharpGames.length > 0 && (
        <>
          <div style={{ fontSize:10,fontWeight:700,color:'#f87171',letterSpacing:'0.1em',marginBottom:10 }}>⚡ SHARP ACTION DETECTED</div>
          {sharpGames.map((game,i) => (
            <div key={game.id||i} style={{ background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:12,padding:'14px 16px',marginBottom:10 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:9,fontWeight:700,color:game.slot==='VEGAS'?'#f87171':'#60a5fa',background:game.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{game.slot}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{game.awayAbbr||game.away?.split(' ').pop()} @ {game.homeAbbr||game.home?.split(' ').pop()}</span>
                  <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
                </div>
                <span style={{ fontSize:9,fontWeight:700,color:'#f87171',background:'rgba(248,113,113,0.1)',borderRadius:4,padding:'2px 8px' }}>⚡ SHARP</span>
              </div>
              {game.rlm && <div style={{ fontSize:11,fontWeight:700,color:'#f87171',marginBottom:4 }}>Sharp side: {game.rlm}</div>}
              <div style={{ fontSize:10,color:'#94a3b8' }}>{game.lineMovement}</div>
              {(game.homeEV > 0 || game.awayEV > 0) && (
                <div style={{ marginTop:6,fontSize:10 }}>
                  {game.awayEV > 0 && <span style={{ color:'#4ade80',marginRight:12 }}>+EV: {game.away?.split(' ').pop()} +{game.awayEV}%</span>}
                  {game.homeEV > 0 && <span style={{ color:'#4ade80' }}>+EV: {game.home?.split(' ').pop()} +{game.homeEV}%</span>}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Moving lines */}
      {movingGames.length > 0 && (
        <>
          <div style={{ fontSize:10,fontWeight:700,color:'#3b82f6',letterSpacing:'0.1em',marginBottom:10,marginTop:20 }}>📈 LINE MOVEMENT</div>
          {movingGames.map((game,i) => (
            <div key={game.id||i} style={{ background:'rgba(201,162,39,0.05)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:12,padding:'14px 16px',marginBottom:10 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{game.awayAbbr||game.away?.split(' ').pop()} @ {game.homeAbbr||game.home?.split(' ').pop()}</span>
                <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
              </div>
              <div style={{ fontSize:10,color:'#94a3b8' }}>{game.lineMovement}</div>
            </div>
          ))}
        </>
      )}

      {sharpGames.length === 0 && movingGames.length === 0 && (
        <div style={{ textAlign:'center',padding:'40px 20px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize:28,marginBottom:10 }}>💰</div>
          <div style={{ fontSize:13,color:'#2d3a4a' }}>No sharp signals detected yet.<br/>Lines are stable across all games.</div>
        </div>
      )}
    </div>
  );
}

// ── VAULT LOCKS VIEW ──────────────────────────────────────────────────────────
function VaultLocksView({ results, games, finalized }) {
  const locks = Object.entries(results)
    .filter(([key, val]) => { const s = typeof val === 'string' ? val : JSON.stringify(val||''); return s.includes('Tier 1') || s.includes('LOCK') || s.includes('🔒'); })
    .map(([key, val]) => {
      const [gameId, slot] = key.split('-');
      const game = games.find(g => String(g.id) === gameId);
      return { key, slot, game, analysis: val };
    });

  // Extract pick line from analysis
  function extractPick(analysis) {
    const lines = analysis.split('\n');
    for (const line of lines) {
      if (line.includes('FINAL PICK') || line.includes('Final Pick') || line.includes('BET:') || line.includes('PLAY:')) {
        return line.replace(/[*#]/g,'').trim().slice(0,80);
      }
    }
    return 'See full analysis';
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>🔒 Vault Locks</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>{locks.length} Tier 1 locks identified today</p>
      </div>

      {locks.length === 0 ? (
        <div style={{ textAlign:'center',padding:'60px 20px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize:32,marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:14,fontWeight:600,color:'#2d3a4a',marginBottom:6 }}>No locks generated yet</div>
          <div style={{ fontSize:12,color:'#1e2a3a' }}>Generate game analyses — Tier 1 picks appear here automatically.</div>
        </div>
      ) : locks.map((lock,i) => (
        <div key={lock.key} style={{ background:'rgba(201,162,39,0.06)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:12,padding:'16px',marginBottom:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
            <span style={{ fontSize:16 }}>🔒</span>
            <span style={{ fontSize:9,fontWeight:700,color:lock.slot==='VEGAS'?'#f87171':'#60a5fa',background:lock.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{lock.slot}</span>
            {lock.game && <span style={{ fontSize:12,fontWeight:700,color:'#f1f5f9' }}>{lock.game.away?.split(' ').pop()} @ {lock.game.home?.split(' ').pop()}</span>}
            {lock.game && <span style={{ fontSize:10,color:'#3a4a5e' }}>{lock.game.time}</span>}
          </div>
          <div style={{ fontSize:12,fontWeight:700,color:'#3b82f6',marginBottom:6 }}>{extractPick(lock.analysis)}</div>
          {finalized?.[lock.key] && <span style={{ fontSize:9,color:'#475569',background:'rgba(255,255,255,0.04)',borderRadius:4,padding:'2px 6px' }}>FINALIZED</span>}
        </div>
      ))}
    </div>
  );
}

// ── TODAY'S SLATE VIEW ────────────────────────────────────────────────────────
function TodaySlateView({ games, results, generating, onGenerate, liveScores, isSubscribed, finalized, onShowAuth, preAnalyzeQueue, betReadyAlerts }) {
  const [sportFilter, setSportFilter] = useState('ALL');
  const wnbaGames = games.filter(g => g.sport === 'WNBA');
  const mainGames = games.filter(g => g.sport !== 'WNBA');
  const sports = ['ALL', ...new Set(mainGames.map(g=>g.sport).filter(Boolean))];
  const filtered = sportFilter==='ALL' ? mainGames : mainGames.filter(g=>g.sport===sportFilter);

  function SlateGameRow({ game }) {
    return (
      <div key={game.id} style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:12,padding:'14px 16px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {game.sport !== 'WNBA' && (
              <span style={{ fontSize:9,fontWeight:700,color:game.slot==='VEGAS'?'#f87171':'#60a5fa',background:game.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{game.sport}·{game.slot}</span>
            )}
            <span style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
          </div>
          <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
        </div>
        <div style={{ display:'flex',gap:16,fontSize:10,color:'#475569' }}>
          <span>Away ML: <span style={{ color:(game.awayML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.awayML||'N/A'}</span></span>
          <span>Home ML: <span style={{ color:(game.homeML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.homeML||'N/A'}</span></span>
          {game.spread && game.spread!=='N/A' && <span>Spread: {game.spread}</span>}
          {game.total && game.total!=='N/A' && <span>O/U: {game.total}</span>}
        </div>
        {game.homePitcher && game.homePitcher!=='TBD' && (
          <div style={{ marginTop:6,fontSize:10,color:'#3a4a5e' }}>SP: {game.awayPitcher} vs {game.homePitcher}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>📅 Today\'s Slate</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>{games.length} games · full schedule</p>
      </div>

      {/* Sport filter pills — excludes WNBA since it has its own section */}
      <div style={{ display:'flex',gap:6,marginBottom:16,flexWrap:'wrap' }}>
        {sports.map(s => (
          <button key={s} onClick={()=>setSportFilter(s)} style={{ padding:'5px 14px',background:sportFilter===s?'rgba(59,130,246,0.15)':'transparent',border:`1px solid ${sportFilter===s?'rgba(59,130,246,0.4)':'rgba(59,130,246,0.14)'}`,borderRadius:20,fontSize:10,fontWeight:sportFilter===s?700:400,color:sportFilter===s?'#3b82f6':'#3a4a5e',cursor:'pointer',fontFamily:'inherit',letterSpacing:'0.06em' }}>{s}</button>
        ))}
      </div>

      {/* Main slate */}
      <div style={{ display:'grid',gap:10,marginBottom: wnbaGames.length ? 28 : 0 }}>
        {filtered.map(game => <SlateGameRow key={game.id} game={game} />)}
      </div>

      {/* WNBA Section */}
      {wnbaGames.length > 0 && (
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.05)' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:11,fontWeight:700,color:'#c084fc',letterSpacing:'0.08em' }}>WNBA</span>
              <span style={{ fontSize:9,color:'#7c3aed',background:'rgba(192,132,252,0.1)',border:'1px solid rgba(192,132,252,0.25)',borderRadius:4,padding:'2px 7px',fontWeight:600 }}>{wnbaGames.length} GAMES</span>
            </div>
            <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.05)' }}/>
          </div>
          <div style={{ background:'rgba(192,132,252,0.03)',border:'1px solid rgba(192,132,252,0.1)',borderRadius:12,padding:'12px',marginBottom:8,fontSize:10,color:'#7c3aed' }}>
            ⚡ Auto-analyzing · Pure sharp edge framework · No slot pattern
          </div>
          <div style={{ display:'grid',gap:10 }}>
            {wnbaGames.map(game => (
              <div key={game.id} style={{ background:'rgba(192,132,252,0.03)',border:'1px solid rgba(192,132,252,0.12)',borderRadius:12,padding:'14px 16px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:9,fontWeight:700,color:'#c084fc',background:'rgba(192,132,252,0.1)',border:'1px solid rgba(192,132,252,0.25)',borderRadius:4,padding:'1px 6px',letterSpacing:'0.06em' }}>WNBA</span>
                    <span style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
                  </div>
                  <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
                </div>
                <div style={{ display:'flex',gap:16,fontSize:10,color:'#475569' }}>
                  <span>Away ML: <span style={{ color:(game.awayML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.awayML||'N/A'}</span></span>
                  <span>Home ML: <span style={{ color:(game.homeML||'').startsWith('-')?'#f87171':'#4ade80' }}>{game.homeML||'N/A'}</span></span>
                  {game.spread && game.spread!=='N/A' && <span>Spread: {game.spread}</span>}
                  {game.total && game.total!=='N/A' && <span>O/U: {game.total}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI ANALYZER VIEW ──────────────────────────────────────────────────────────
function AIAnalyzerView({ games, results, generating, onGenerate, isSubscribed }) {
  const analyzed = games.filter(g => results[`${g.id}-PUBLIC`] || results[`${g.id}-VEGAS`]);
  const pending = games.filter(g => !results[`${g.id}-PUBLIC`] && !results[`${g.id}-VEGAS`]);

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>◎ AI Analyzer</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>{analyzed.length} analyzed · {pending.length} pending</p>
      </div>

      {/* Progress */}
      <div style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:12,padding:'16px',marginBottom:20 }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
          <span style={{ fontSize:10,color:'#3a4a5e',letterSpacing:'0.08em' }}>ANALYSIS PROGRESS</span>
          <span style={{ fontSize:10,color:'#3b82f6',fontWeight:700 }}>{games.length>0?Math.round((analyzed.length/games.length)*100):0}%</span>
        </div>
        <div style={{ height:4,background:'rgba(255,255,255,0.04)',borderRadius:2 }}>
          <div style={{ height:'100%',width:games.length?`${Math.min(100,(analyzed.length/games.length)*100)}%`:'0%',background:'linear-gradient(90deg,#1d4ed8,#3b82f6)',borderRadius:2,transition:'width 0.4s' }}/>
        </div>
        <div style={{ display:'flex',gap:16,marginTop:10,fontSize:10,color:'#3a4a5e' }}>
          <span>✅ {analyzed.length} analyzed</span>
          <span>⏳ {pending.length} pending</span>
          <span>🎮 {games.length} total</span>
        </div>
      </div>

      {analyzed.length > 0 && (
        <>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10 }}>ANALYZED GAMES</div>
          {analyzed.map((game,i) => {
            const pubRes = results[`${game.id}-PUBLIC`];
            const vegRes = results[`${game.id}-VEGAS`];
            const _r = typeof (pubRes||vegRes) === 'string' ? (pubRes||vegRes) : JSON.stringify(pubRes||vegRes||''); const isTier1 = _r.includes('Tier 1') || _r.includes('LOCK');
            return (
              <div key={game.id} style={{ background:'rgba(255,255,255,0.02)',border:`1px solid ${isTier1?'rgba(59,130,246,0.3)':'rgba(59,130,246,0.1)'}`,borderRadius:12,padding:'14px 16px',marginBottom:10 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    {isTier1 && <span style={{ fontSize:12 }}>🔒</span>}
                    <span style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
                    <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
                  </div>
                  <div style={{ display:'flex',gap:6 }}>
                    {pubRes && <span style={{ fontSize:9,background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:4,padding:'1px 6px',color:'#60a5fa' }}>PUBLIC ✓</span>}
                    {vegRes && <span style={{ fontSize:9,background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:4,padding:'1px 6px',color:'#f87171' }}>VEGAS ✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {pending.length > 0 && (
        <>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10,marginTop:analyzed.length>0?20:0 }}>AWAITING ANALYSIS</div>
          {pending.map((game,i) => (
            <div key={game.id} style={{ background:'rgba(255,255,255,0.01)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:12,padding:'14px 16px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:9,fontWeight:700,color:game.slot==='VEGAS'?'#f87171':'#60a5fa',background:game.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{game.slot}</span>
                <span style={{ fontSize:11,fontWeight:600,color:'#94a3b8' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
                <span style={{ fontSize:10,color:'#3a4a5e' }}>{game.time}</span>
              </div>
              {isSubscribed && (
                <div style={{ display:'flex',gap:6 }}>
                  <button onClick={()=>onGenerate(game,'PUBLIC')} disabled={!!generating} style={{ padding:'5px 10px',background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:6,fontSize:9,color:'#60a5fa',cursor:generating?'not-allowed':'pointer',fontFamily:'inherit' }}>PUBLIC</button>
                  <button onClick={()=>onGenerate(game,'VEGAS')} disabled={!!generating} style={{ padding:'5px 10px',background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:6,fontSize:9,color:'#f87171',cursor:generating?'not-allowed':'pointer',fontFamily:'inherit' }}>VEGAS</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── PROPS AI VIEW ─────────────────────────────────────────────────────────────
function PropsAIView({ games, isSubscribed }) {
  const propTypes = ['Player HR', 'Pitcher Ks', 'Player Hits', 'RBI Props', 'First 5 Innings', 'Team Totals'];

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>◇ Props AI</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>Player props & alternate lines analysis</p>
      </div>

      <div style={{ background:'rgba(201,162,39,0.06)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:12,padding:'16px',marginBottom:20 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'#3b82f6',marginBottom:6 }}>🚧 Coming Soon</div>
        <div style={{ fontSize:12,color:'#64748b' }}>Props AI is being built out. It will analyze player props, first-inning lines, team totals, and alternate spreads using the Vegas Vault model.</div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10 }}>
        {propTypes.map((prop,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:10,padding:'14px',textAlign:'center',opacity:0.5 }}>
            <div style={{ fontSize:11,fontWeight:700,color:'#475569',marginBottom:4 }}>{prop}</div>
            <div style={{ fontSize:9,color:'#2d3a4a',letterSpacing:'0.08em' }}>COMING SOON</div>
          </div>
        ))}
      </div>

      {games.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'#3a4a5e',letterSpacing:'0.1em',marginBottom:10 }}>TODAY\'S GAMES ({games.length})</div>
          {games.filter(g=>g.sport==='MLB').slice(0,6).map((game,i) => (
            <div key={game.id||i} style={{ background:'rgba(255,255,255,0.01)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontSize:11,color:'#64748b' }}>{game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</span>
              <div style={{ display:'flex',gap:6 }}>
                {['HR','Ks','Hits'].map(t => (
                  <span key={t} style={{ fontSize:9,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(59,130,246,0.1)',borderRadius:4,padding:'2px 6px',color:'#2d3a4a' }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function VegasVaultApp() {
  const [games, setGames]             = useState([]);
  const [trellAlerts, setTrellAlerts] = useState([]);
  const [oddsFeed, setOddsFeed]       = useState(ODDS_FEED);
  const [marketScanner, setMarketScanner] = useState({ reverseLineMovement:7, sharpMoneyDetected:5, publicHeavy:6, vegasTrapAlert:3 });
  const [insights, setInsights]       = useState(INSIGHTS);
  const [results, setResults] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem('vv_results');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [finalized, setFinalized] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem('vv_finalized');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [preAnalyzing, setPreAnalyzing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOddsMovement, setShowOddsMovement] = useState(false);
  const [topPlay, setTopPlay] = useState(null);
  const [topPlayLoading, setTopPlayLoading] = useState(false);
  const [activeNav, setActiveNav] = useState('DASHBOARD');
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [watchlist, setWatchlist] = useState([]);
  const [betReadyAlerts, setBetReadyAlerts] = useState({});
  const [preAnalyzeQueue, setPreAnalyzeQueue] = useState([]);
  const [liveScores, setLiveScores]   = useState({});
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [authUser, setAuthUser]         = useState(null);
  const [showAuth, setShowAuth]         = useState(false);
  const [authMode, setAuthMode]         = useState('login');
  const [authEmail, setAuthEmail]       = useState('');
  const [authPw, setAuthPw]             = useState('');
  const [authLoading, setAuthLoading]   = useState(false);
  const [authError, setAuthError]       = useState('');
  const [showPw, setShowPw]             = useState(false);

  useEffect(() => {
    // Don't pre-set from localStorage — let Supabase session be the source of truth
    try {
      const sb = getSB();
      if (!sb) return;
      sb.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          setAuthUser(session.user);
          if (session.user.email === ADMIN_EMAIL) { localStorage.setItem('vv_admin','1'); setIsSubscribed(true); }
          // Load synced data from Supabase
          const uid = session.user.id;
          const [wl, res, fin, hist] = await Promise.all([
            syncLoad(uid, 'watchlist'),
            syncLoad(uid, 'results'),
            syncLoad(uid, 'finalized'),
            syncLoad(uid, 'pick_history'),
          ]);
          if (wl) setWatchlist(wl);
          else { try { const s = localStorage.getItem('vv_watchlist'); if(s) setWatchlist(JSON.parse(s)); } catch {} }
          if (res) setResults(res);
          if (fin) setFinalized(fin);
          if (hist) setPickHistory(hist);
        }
      });
      const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          if (session.user.email === ADMIN_EMAIL) { localStorage.setItem('vv_admin','1'); setIsSubscribed(true); }
          else {
            const sub = typeof window !== 'undefined' && localStorage.getItem('vv_subscribed');
            if (sub) setIsSubscribed(true);
          }
        } else {
          setAuthUser(null);
          // Keep subscribed if localStorage flags still present (e.g. active Stripe sub)
          const admin = typeof window !== 'undefined' && localStorage.getItem('vv_admin');
          const sub   = typeof window !== 'undefined' && localStorage.getItem('vv_subscribed');
          if (!admin && !sub) setIsSubscribed(false);
        }
      });
      return () => subscription.unsubscribe();
    } catch(e) {}
  }, []);

  async function doAuth() {
    setAuthLoading(true); setAuthError('');
    try {
      const sb = getSB();
      if (!sb) { setAuthError('Auth unavailable'); setAuthLoading(false); return; }
      if (authMode === 'signup') {
        const { error } = await sb.auth.signUp({ email: authEmail, password: authPw });
        if (error) { setAuthError(error.message); } else { setAuthMode('plans'); }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email: authEmail, password: authPw });
        if (error) { setAuthError(error.message); }
        else {
          setAuthUser(data.user);
          if (data.user?.email === ADMIN_EMAIL) { localStorage.setItem('vv_admin','1'); setIsSubscribed(true); }
          setShowAuth(false); setAuthEmail(''); setAuthPw('');
        }
      }
    } catch(e) { setAuthError('Something went wrong. Try again.'); }
    setAuthLoading(false);
  }

  async function doSignOut() {
    try { const sb = getSB(); if (sb) await sb.auth.signOut(); } catch(e) {}
    setAuthUser(null); localStorage.removeItem('vv_admin'); localStorage.removeItem('vv_subscribed'); setIsSubscribed(false);
  }

  async function doSubscribe(plan) {
    try {
      const sb = getSB();
      const session = sb ? (await sb.auth.getSession()).data?.session : null;
      const res = await fetch('/api/stripe/checkout', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(session?.access_token||'')}, body:JSON.stringify({plan}) });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch(e) {}
  }
  const [bookmakerCount, setBookmakerCount] = useState(12);
  const [winRate, setWinRate] = useState(null);
  const [pickHistory, setPickHistory] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem('vv_pick_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [aiConfidence, setAiConfidence] = useState(null);
  const [confHistory, setConfHistory] = useState([]);
  const [generating, setGenerating]   = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [activeGame, setActiveGame]   = useState(null);
  const [filter, setFilter]           = useState("ALL");
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [time, setTime]               = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasSlotPattern, setHasSlotPattern] = useState(false);

  useEffect(()=>{
    setLoading(true);
    fetch(`/api/today?date=${selectedDate}`).then(r=>r.json())
      .then(data=>{
        const loadedGames = data.games||MOCK_GAMES;
        setGames(loadedGames);
        setTrellAlerts(data.trellAlerts||[]);
        if (data.oddsFeed?.length) setOddsFeed(data.oddsFeed);
        if (data.marketScanner) setMarketScanner(data.marketScanner);
        if (data.insights?.length) setInsights(data.insights);
        if (data.bookmakerCount > 0) setBookmakerCount(data.bookmakerCount);
        setHasSlotPattern(!!data.hasSlotPattern);
        if (!data.hasSlotPattern) setTopPlay(null);
        setLoading(false);

        // Fetch top play after games are loaded — only if slot pattern exists
        if (!data.hasSlotPattern) { setTopPlayLoading(false); return; }
        setTopPlayLoading(true);
        fetch(`/api/topplay?date=${selectedDate}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data?.topPlay?.result) return;
            const tp = data.topPlay;
            setTopPlay(tp);
            // Inject analysis into results state
            const [away, home] = (tp.game_key||'').split('|');
            const matchingGame = loadedGames.find(g => g.away===away && g.home===home);
            if (matchingGame) {
              const key = `${matchingGame.id}-${tp.slot}`;
              setResults(prev => ({ ...prev, [key]: tp.result }));
            }
          })
          .catch(() => {})
          .finally(() => setTopPlayLoading(false));
      })
      .catch(()=>{setGames(MOCK_GAMES);setLoading(false);});
  },[selectedDate]);

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  // ── BET READY ALERTS — 30 min before game, Tier 1 & 2 picks ─────────────────
  useEffect(() => {
    if (!games || Object.keys(results).length === 0) return;

    const checkBetReady = () => {
      const now = Date.now();
      for (const game of games) {
        // Only notify for games the client watchlisted
        if (!watchlist.includes(game.id)) continue;

        // Skip started games
        const live = liveScores[`${game.away}|${game.home}`] || liveScores[`${game.awayAbbr}|${game.homeAbbr}`];
        if (live?.status === 'Live' || live?.status === 'Final') continue;

        // Check if game starts in 30 mins or less
        if (!game.rawTime) continue;
        const gameTime = new Date(game.rawTime).getTime();
        const minsUntil = (gameTime - now) / 60000;
        if (minsUntil > 30 || minsUntil < 0) continue;

        for (const slot of ['PUBLIC', 'VEGAS']) {
          const key = `${game.id}-${slot}`;
          const pick = results[key];
          if (!pick?.summary) continue;

          // Only Tier 1 and Tier 2
          const tier = pick.summary.tier;
          if (tier !== '1' && tier !== '2') continue;
          if (pick.summary.tierLabel === 'PASS') continue;

          // Skip if already alerted
          if (betReadyAlerts[key]) continue;

          // Mark as bet ready
          setBetReadyAlerts(prev => ({ ...prev, [key]: true }));

          // Send notification
          const tierLabel = tier === '1' ? '🔒 LOCK' : '⭐ Tier 2';
          const minsStr = Math.round(minsUntil);
          sendNotification(
            `${tierLabel} — BET NOW: ${game.away} @ ${game.home}`,
            `${slot} pick: ${pick.summary.pick} ${pick.summary.betType} | Game starts in ${minsStr} min`
          );
        }
      }
    };

    checkBetReady();
    const interval = setInterval(checkBetReady, 60000); // check every minute
    return () => clearInterval(interval);
  }, [games, results, liveScores, betReadyAlerts, watchlist]);

  // ── AUTO-RESOLVE PICKS FROM LIVE SCORES ──────────────────────────────────────
  useEffect(() => {
    if (!games || Object.keys(liveScores).length === 0) return;
    for (const game of games) {
      const liveKey1 = `${game.away}|${game.home}`;
      const liveKey2 = `${game.awayAbbr}|${game.homeAbbr}`;
      const live = liveScores[liveKey1] || liveScores[liveKey2];
      if (!live || live.status !== 'Final') continue;

      for (const slot of ['PUBLIC', 'VEGAS']) {
        const key = `${game.id}-${slot}`;
        const pick = results[key];
        if (!pick?.summary?.pick) continue;

        // Check if already resolved
        const alreadyResolved = pickHistory.some(p => p.key === key);
        if (alreadyResolved) continue;

        // Determine win/loss based on pick vs final score
        const pickTeam = pick.summary.pick;
        const betType = pick.summary.betType || 'ML';
        const awayScore = live.awayScore;
        const homeScore = live.homeScore;
        if (awayScore === null || homeScore === null) continue;

        const awayWon = awayScore > homeScore;
        const homeWon = homeScore > awayScore;
        const margin = Math.abs(homeScore - awayScore);
        const awayTeamWon = awayWon;
        const homeTeamWon = homeWon;
        const pickIsAway = pickTeam === game.away || game.away?.includes(pickTeam) || pickTeam?.includes(game.away?.split(' ').pop());
        const pickIsHome = !pickIsAway;

        let result = null;
        if (betType === 'ML') {
          result = (pickIsAway && awayTeamWon) || (pickIsHome && homeTeamWon) ? 'win' : 'loss';
        } else if (betType.includes('-1.5') || betType.includes('run line')) {
          result = (pickIsAway && awayTeamWon && margin >= 2) || (pickIsHome && homeTeamWon && margin >= 2) ? 'win' : 'loss';
        } else if (betType.includes('+1.5')) {
          result = (pickIsAway && (awayTeamWon || margin <= 1)) || (pickIsHome && (homeTeamWon || margin <= 1)) ? 'win' : 'loss';
        } else if (betType.toUpperCase().includes('OVER')) {
          const total = parseFloat(betType.replace(/[^0-9.]/g, ''));
          result = (awayScore + homeScore) > total ? 'win' : 'loss';
        } else if (betType.toUpperCase().includes('UNDER')) {
          const total = parseFloat(betType.replace(/[^0-9.]/g, ''));
          result = (awayScore + homeScore) < total ? 'win' : 'loss';
        } else {
          result = (pickIsAway && awayTeamWon) || (pickIsHome && homeTeamWon) ? 'win' : 'loss';
        }

        if (result) {
          const historyEntry = {
            key, slot, game: `${game.away} @ ${game.home}`,
            pick: pickTeam, betType, result,
            score: `${game.awayAbbr} ${awayScore} - ${homeScore} ${game.homeAbbr}`,
            resolvedAt: new Date().toISOString(),
            date: game.date,
          };
          setPickHistory(prev => [...prev, historyEntry]);

          // Notification
          const emoji = result === 'win' ? '✅' : '❌';
          sendNotification(
            `${emoji} ${result.toUpperCase()} — ${game.away} @ ${game.home}`,
            `${slot} pick: ${pickTeam} ${betType} | Final: ${game.awayAbbr} ${awayScore}-${homeScore} ${game.homeAbbr}`
          );
        }
      }
    }
  }, [liveScores, games]);

  // ── FINALIZATION: re-analyze when lines move, mark FINAL ─────────────────────
  const lastLineRef = useRef({});

  // ── SERVICE WORKER + PUSH NOTIFICATIONS ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Register service worker for mobile push
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch { return false; }
  }

  async function testNotification() {
    const granted = await requestNotificationPermission();
    if (!granted) {
      alert('Notifications are blocked. On iOS: go to Settings > Safari > [this site] > Notifications and allow. On Android: tap the lock icon in the address bar and allow notifications.');
      return;
    }
    await sendNotification(
      '🔒 Vegas Vault AI — Test',
      'Notifications are working! You will receive alerts for your watchlisted games.'
    );
  }

  function clearAllPlays() {
    setResults({});
    setFinalized({});
    if (authUser?.id) { syncDelete(authUser.id, 'results'); syncDelete(authUser.id, 'finalized'); }
    setPreAnalyzeQueue([]);
    setBetReadyAlerts({});
    try {
      localStorage.removeItem('vv_results');
      localStorage.removeItem('vv_finalized');
    } catch {}
  }

  function toggleWatch(gameId) {
    setWatchlist(prev => {
      const updated = prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId];
      try { localStorage.setItem('vv_watchlist', JSON.stringify(updated)); } catch {}
      if (authUser?.id) syncSave(authUser.id, 'watchlist', updated);
      return updated;
    });
  }

  async function sendNotification(title, body) {
    if (typeof window === 'undefined') return;
    await requestNotificationPermission();
    if (Notification.permission !== 'granted') return;
    // Use service worker notification if available (works on mobile)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg?.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          tag: 'vv-play',
          requireInteraction: false,
        });
        return;
      }
    }
    // Fallback: standard browser notification
    new Notification(title, { body, icon: '/favicon.ico' });
  }

  useEffect(() => {
    if (Object.keys(results).length > 0) requestNotificationPermission();
  }, [results]);

  useEffect(() => {
    if (!games || games.length === 0) return;
    const checkInterval = setInterval(async () => {
      for (const game of games) {
        // Only send notifications for watchlisted games (AI still tracks all games)
        const isWatchlisted = watchlist.includes(game.id);

        // Skip live/final games
        const live = liveScores[`${game.away}|${game.home}`] || liveScores[`${game.awayAbbr}|${game.homeAbbr}`];
        if (live?.status === 'Live' || live?.status === 'Final') continue;

        for (const slot of ['PUBLIC', 'VEGAS']) {
          const key = `${game.id}-${slot}`;
          const existing = results[key];
          if (!existing || finalized[key]) continue;

          // Check if line has moved significantly
          const currentML = game.homeML;
          const lastML = lastLineRef.current[key];
          if (lastML && currentML && currentML !== 'N/A') {
            const current = parseInt(currentML);
            const last = parseInt(lastML);
            if (!isNaN(current) && !isNaN(last) && Math.abs(current - last) >= 5) {
              // Significant line movement — re-analyze and finalize
              try {
                const fresh = await generatePlay({ ...game, slot });
                if (fresh?.summary) {
                  const finalResult = { ...fresh, finalized: true, finalizedAt: new Date().toISOString() };
                  setResults(prev => ({ ...prev, [key]: finalResult }));
                  setFinalized(prev => ({ ...prev, [key]: true }));
                  const pick = fresh.summary?.pick || 'Pick';
                  const tier = fresh.summary?.tierLabel || '';
                  // Only push notification if game is in client's watchlist
                  if (isWatchlisted) {
                    sendNotification(
                      `🔒 ${tier} FINALIZED — ${game.away} @ ${game.home}`,
                      `${slot} slot: ${pick} | Line moved ${Math.abs(current - last)} pts`
                    );
                  }
                }
              } catch {}
            }
          }
          lastLineRef.current[key] = currentML;

          // Auto-finalize Tier 1 LOCK plays (AI is confident)
          if (existing?.summary?.tierLabel === 'LOCK' && existing?.summary?.confidence === 'HIGH' && !finalized[key]) {
            setFinalized(prev => ({ ...prev, [key]: true }));
            setResults(prev => ({ ...prev, [key]: { ...existing, finalized: true, finalizedAt: new Date().toISOString() } }));
            if (isWatchlisted) {
              sendNotification(
                `🔒 LOCK FINALIZED — ${game.away} @ ${game.home}`,
                `${slot}: ${existing.summary?.pick} — AI has high confidence in this play`
              );
            }
          }
        }
      }
    }, 5 * 60 * 1000); // check every 5 minutes

    return () => clearInterval(checkInterval);
  }, [games, results, finalized, liveScores, watchlist]);

  // ── PERSIST RESULTS TO LOCALSTORAGE ──────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('vv_results', JSON.stringify(results)); } catch {}
    if (authUser?.id) syncSave(authUser.id, 'results', results);
  }, [results]);

  useEffect(() => {
    try { localStorage.setItem('vv_finalized', JSON.stringify(finalized)); } catch {}
    if (authUser?.id) syncSave(authUser.id, 'finalized', finalized);
  }, [finalized]);

  // Persist pick history
  useEffect(() => {
    try { localStorage.setItem('vv_pick_history', JSON.stringify(pickHistory)); } catch {}
    if (authUser?.id) syncSave(authUser.id, 'pick_history', pickHistory);
  }, [pickHistory]);

  // ── WIN RATE & AI CONFIDENCE ──────────────────────────────────────────────────
  useEffect(() => {
    const allResults = Object.values(results);
    if (allResults.length === 0) { setAiConfidence(null); return; }

    // AI Confidence = % of results that are Tier 1 or 2
    const strongPicks = allResults.filter(r => r.summary?.tier === '1' || r.summary?.tier === '2').length;
    const confPct = Math.round((strongPicks / allResults.length) * 100);
    setAiConfidence(confPct);
    setConfHistory(prev => [...prev.slice(-14), confPct]);
  }, [results]);

  // Win rate = real results from pick history (last 7 days)
  useEffect(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = pickHistory.filter(p => p.resolvedAt && new Date(p.resolvedAt).getTime() > sevenDaysAgo);
    if (recent.length === 0) { setWinRate(null); return; }
    const wins = recent.filter(p => p.result === 'win').length;
    setWinRate(Math.round((wins / recent.length) * 100));
  }, [pickHistory]);

  // ── AUTO-ANALYSIS: queue every game by its assigned slot ───────────────────
  // Track if we've queued for today already — prevents re-queue on every liveScores poll
  const queuedDateRef = useRef(null);

  useEffect(() => {
    if (!games || games.length === 0) return;
    // Only queue once per date — don't re-queue just because liveScores updated
    if (queuedDateRef.current === selectedDate) return;
    // Wait for slots to be assigned
    // WNBA always analyzes — no slot pattern required
    const wnbaGames = games.filter(g => g.sport === 'WNBA');
    if (!hasSlotPattern && wnbaGames.length === 0) return;
    if (!hasSlotPattern && wnbaGames.length > 0) {
      // Only queue WNBA games
      const wnbaQueue = wnbaGames.filter(g => !results[g.id+'-WNBA'] && !finalized[g.id+'-WNBA']).map(g => ({ game: g, slot: 'WNBA', key: g.id+'-WNBA' }));
      if (wnbaQueue.length) setPreAnalyzeQueue(q => [...q, ...wnbaQueue.filter(nq => !q.find(eq => eq.key === nq.key))]);
      return;
    }

    const toAnalyze = [];
    for (const game of games) {
      if (!game.slot || (game.slot !== 'PUBLIC' && game.slot !== 'VEGAS')) continue;
      const key = `${game.id}-${game.slot}`;
      if (!results[key]) toAnalyze.push({ game, slot: game.slot, key });
    }
    if (toAnalyze.length > 0) {
      queuedDateRef.current = selectedDate;
      setPreAnalyzeQueue(toAnalyze);
    }
  }, [games, selectedDate]);

  // Track whether analysis-complete notification has been sent today
  const analysisDoneNotifKey = `vv_analysis_notif_${selectedDate}`;

  // Process pre-analysis queue — runs next unanalyzed game whenever queue changes
  useEffect(() => {
    if (preAnalyzeQueue.length === 0) return;
    if (preAnalyzing) return;

    // Find next game that hasn't been analyzed yet
    const next = preAnalyzeQueue.find(item => !results[item.key]);
    if (!next) {
      // All done — fire notification and clear
      setPreAnalyzeQueue([]);
      const alreadyNotified = typeof window !== 'undefined' && localStorage.getItem(analysisDoneNotifKey);
      if (!alreadyNotified) {
        setResults(current => {
          const allResults = Object.values(current);
          const locks  = allResults.filter(r => r?.summary?.tier === '1').length;
          const tier2s = allResults.filter(r => r?.summary?.tier === '2').length;
          const passes = allResults.filter(r => r?.summary?.tier === 'PASS' || r?.summary?.tier === '3').length;
          let body = '';
          if (locks > 0)  body  = `🔒 ${locks} LOCK${locks>1?'S':''} identified`;
          if (tier2s > 0) body += `${body?' · ':''}⭐ ${tier2s} Tier 2 play${tier2s>1?'s':''}`;
          if (passes > 0) body += `${body?' · ':''}${passes} pass${passes>1?'es':''}`;
          sendNotification('✅ Vegas Vault AI — Analysis Complete', body || `Today's ${allResults.length} games analyzed.`);
          try { localStorage.setItem(analysisDoneNotifKey, '1'); } catch {}
          return current;
        });
      }
      return;
    }

    console.log('Analyzing:', next.game.away, '@', next.game.home, next.slot);
    setPreAnalyzing(true);

    generatePlay({ ...next.game, slot: next.slot })
      .then(result => {
        if (!result?.summary) {
          result = { ...result, summary:{ tier:'3', tierLabel:'Tier 3', pick:'No Pick', betType:'N/A', confidence:'LOW', verdict:'Analysis incomplete.', isScamPlay:false, slot:next.slot } };
        }
        setResults(prev => ({ ...prev, [next.key]: result }));
        // AI decides when to finalize
        if (result?.summary?.readyToFinalize === true) {
          setFinalized(prev => ({ ...prev, [next.key]: true }));
        }
        setPreAnalyzeQueue(q => q.filter(item => item.key !== next.key));
      })
      .catch(err => {
        console.error('Analysis failed for', next.key, err?.message);
        // Remove from queue so we don't get stuck
        setPreAnalyzeQueue(q => q.filter(item => item.key !== next.key));
      })
      .finally(() => {
        setPreAnalyzing(false);
      });

  }, [preAnalyzeQueue, preAnalyzing]);

  // ── LIVE SCORES — poll every 30s ─────────────────────────────────────────
  useEffect(() => {
    function fetchScores() {
      fetch(`/api/livescores?date=${selectedDate}`).then(r => r.json()).then(data => {
        const map = {};
        (data.scores || []).forEach(s => {
          // Index by gamePk, full name, abbreviation, and partial name combos
          if (s.gamePk) map[s.gamePk] = s;
          map[`${s.away}|${s.home}`] = s;
          map[`${s.awayAbbr}|${s.homeAbbr}`] = s;
          // Also index by last word of team name (e.g. "Tigers"|"Orioles")
          const awayLast = s.away?.split(' ').pop();
          const homeLast = s.home?.split(' ').pop();
          if (awayLast && homeLast) map[`${awayLast}|${homeLast}`] = s;
        });
        setLiveScores(map);
      }).catch(() => {});
    }
    fetchScores();
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // ── LINE MOVEMENT POLLING — every 5 minutes ───────────────────────────────
  useEffect(() => {
    function fetchLines() {
      fetch(`/api/lines?date=${selectedDate}&sport=mlb`)
        .then(r => r.json())
        .then(data => {
          if (!data.movements) return;
          const normT = (n) => (n||'').toLowerCase().replace(/^(the |los |san |new |st\. |st |fort |las )/, '').replace(/[^a-z]/g,'');
          setGames(prev => prev.map(game => {
            const key = `${game.away}|${game.home}`;
            const normKey = `${normT(game.away)}|${normT(game.home)}`;
            const mv = data.movements[key] || Object.values(data.movements).find(m => `${normT(m.away)}|${normT(m.home)}` === normKey);
            if (!mv) return game;
            // Build formatted opening ML strings
            const fmtN = (n) => n == null ? null : (n > 0 ? `+${n}` : `${n}`);
            return {
              ...game,
              lineMovement:  mv.lineMovement  || game.lineMovement,
              rlm:           mv.rlm           ?? game.rlm,
              moveType:      mv.moveType      || game.moveType,
              homeDiff:      mv.homeDiff      ?? game.homeDiff,
              awayDiff:      mv.awayDiff      ?? game.awayDiff,
              openingHomeML: fmtN(mv.openHome) || mv.openHome || game.openingHomeML,
              openingAwayML: fmtN(mv.openAway) || mv.openAway || game.openingAwayML,
              pinHomeML:     mv.pinHomeML     || game.pinHomeML,
              dkAwayML:      mv.dkAwayML      || game.dkAwayML,
              dkHomeML:      mv.dkHomeML      || game.dkHomeML,
              dkSpread:      mv.dkSpread      || game.dkSpread,
              dkTotal:       mv.dkTotal       || game.dkTotal,
              // Live price updates from Sharp API
              awayML:        fmtN(mv.currentAwayML) || mv.awayML || game.awayML,
              homeML:        fmtN(mv.currentHomeML) || mv.homeML || game.homeML,
              spread:        mv.spread        || game.spread,
              total:         mv.total         || game.total,
              publicBettingPct: mv.publicBettingPct ?? game.publicBettingPct,
              sharpMoneyPct:    mv.sharpMoneyPct    ?? game.sharpMoneyPct,
            };
          }));
        })
        .catch(() => {}); // fail silently — don't break the UI
    }

    // Initial fetch after games load
    const initTimeout = setTimeout(fetchLines, 3000);
    const linesInterval = setInterval(fetchLines, 5 * 60 * 1000); // every 5 min
    return () => { clearTimeout(initTimeout); clearInterval(linesInterval); };
  }, [selectedDate]);

  const generated = Object.keys(results).length;
  const FILTERS = ["ALL","MLB","NBA","NFL","WNBA"];
  const filteredGames = games.filter(g=>{
    if(filter==="MLB")return g.sport==="MLB";
    if(filter==="NBA")return g.sport==="NBA";
    if(filter==="NFL")return g.sport==="NFL";
    if(filter==="WNBA")return g.sport==="WNBA";
    return g.sport !== 'WNBA';
  });
  const wnbaFilteredGames = games.filter(g => g.sport === 'WNBA').sort((a,b) => new Date(a.rawTime||a.time) - new Date(b.rawTime||b.time));

  async function handleGenerate(game,slot){
    const key=`${game.id}-${slot}`;
    setGenerating(key); setError(null);
    try{
      const result=await generatePlay({...game,slot});
      // Ensure result always has a valid summary before storing
      if (!result.summary) {
        result.summary = {
          tier:'3', tierLabel:'Tier 3', pick:'No Pick',
          betType:'N/A', confidence:'LOW',
          verdict:'Analysis returned no summary. Please re-analyze.',
          isScamPlay:false, slot,
        };
      }
      setResults(prev=>({...prev,[key]:result}));
      // AI decides when to finalize — only finalize if AI signals readiness
      if (result?.summary?.readyToFinalize === true && !result.error) {
        const finalResult = { ...result, finalized: true, finalizedAt: new Date().toISOString() };
        setResults(prev=>({...prev,[key]:finalResult}));
        setFinalized(prev=>({...prev,[key]:true}));
      }
      // Only open the modal if analysis has real content
      if (!result.error && !result.parseError) {
        setActiveResult(result); setActiveGame({...game,slot});
      }
    }catch(e){
      setError(`Generation failed: ${e.message}`);
      // Store an error result so the card shows something
      const errResult = {
        summary:{ tier:'3', tierLabel:'Tier 3', pick:'Failed', betType:'N/A', confidence:'LOW',
          verdict:`Analysis failed: ${e.message}. Tap to re-analyze.`, isScamPlay:false, slot },
        error: e.message,
      };
      setResults(prev=>({...prev,[key]:errResult}));
    }
    finally{ setGenerating(null); }
  }

  function handleCardClick(game){
    const result=results[`${game.id}-VEGAS`]||results[`${game.id}-PUBLIC`]||results[`${game.id}-WNBA`];
    if(result){setActiveResult(result);setActiveGame(game);}
  }

  // Date navigation helpers
  function changeDate(offset) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
    setResults({}); localStorage.removeItem('vv_results'); // clear results when changing date
  }
  function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    if (dateStr === tomorrow) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  }

  const today = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const timeStr = time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const hour = new Date().getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif",background:"#060a18",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#060a18;overflow-x:hidden;font-family:'Inter',-apple-system,sans-serif;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.25);border-radius:2px;}
        button{font-family:inherit;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.35;}}
        .vv-sidebar{display:flex;}
        .vv-right{display:flex;flex-direction:column;}
        .vv-right-stacked{display:none;}
        .vv-bottom-nav{display:none;}
        .vv-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
        .vv-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;}
        .vv-nav-center{display:flex;}
        .vv-ticker-lbl{display:block;}
        @media(max-width:1100px){
          .vv-stats{grid-template-columns:repeat(3,1fr)!important;}
          .vv-right{display:none!important;}
          .vv-right-stacked{display:block!important;}
        }
        @media(max-width:700px){
          .vv-sidebar{display:none!important;}
          .vv-bottom-nav{display:flex!important;position:fixed;bottom:0;left:0;right:0;height:60px;background:rgba(7,9,26,0.98);border-top:1px solid rgba(59,130,246,0.14);z-index:200;align-items:center;justify-content:space-around;backdrop-filter:blur(20px);padding:0 4px;}
          .vv-cards{grid-template-columns:1fr!important;}
          .vv-stats{grid-template-columns:repeat(2,1fr)!important;}
          .vv-top-play{margin-left:-2px!important;margin-right:-2px!important;}
          .vv-top-play-grid{grid-template-columns:1fr!important;}
          .vv-nav-center{display:none!important;}
          .vv-ticker-lbl{display:none!important;}
          .vv-nav-logo span.lbl{display:none!important;}
          .vv-main-inner{padding:10px 10px 78px!important;}
          .vv-top-nav-actions{gap:4px!important;}
          .vv-admin-btns{display:flex!important;gap:4px!important;flex-wrap:wrap;}
          .vv-slate-header{flex-wrap:wrap!important;gap:6px!important;}
          .vv-today-title{font-size:14px!important;white-space:nowrap;}
        }
      `}</style>

      {/* ── TOP NAV ── */}
      <div style={{ height:52,borderBottom:"1px solid rgba(59,130,246,0.1)",display:"flex",alignItems:"center",background:"rgba(7,9,26,0.96)",backdropFilter:"blur(24px)",position:"sticky",top:0,zIndex:100,flexShrink:0 }}>
        <div className="vv-nav-logo" style={{ width:200,padding:"0 18px",display:"flex",alignItems:"center",gap:10,borderRight:"1px solid rgba(59,130,246,0.1)",flexShrink:0 }}>
          <div style={{ width:30,height:30,background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#000",flexShrink:0 }}>V</div>
          <div>
            <span className="lbl" style={{ fontSize:13,fontWeight:700,color:"#f8fafc",letterSpacing:"0.06em" }}>VEGAS </span>
            <span className="lbl" style={{ fontSize:13,fontWeight:700,color:"#3b82f6",letterSpacing:"0.06em" }}>VAULT</span>
            <span className="lbl" style={{ fontSize:10,color:"#3a4a5e",marginLeft:4 }}>AI</span>
          </div>
        </div>

        <div className="vv-nav-center" style={{ flex:1,justifyContent:"center" }}>
          {[
            {t:"DASHBOARD",icon:null},
            {t:"ALERTS",icon:"🔔",badge:()=>{
              const wr = Object.keys(betReadyAlerts).filter(k=>{ const g=games.find(g=>k.startsWith(g.id+'-')); return g&&watchlist.includes(g.id); }).length;
              const wt = trellAlerts.filter(a=>!a.gameId||watchlist.includes(a.gameId)).length;
              return wr+wt;
            }},
            {t:"WATCHLIST",icon:"☆",badge:()=>watchlist.length||0},
          ].map((tab,i)=>{
            const isActive = activeTab===tab.t;
            const badgeVal = tab.badge ? tab.badge() : 0;
            return (
              <div key={i} onClick={()=>setActiveTab(tab.t)} style={{ padding:"0 22px",height:52,display:"flex",alignItems:"center",gap:7,fontSize:11,fontWeight:isActive?700:400,color:isActive?"#3b82f6":"#3a4a5e",borderBottom:isActive?"2px solid #3b82f6":"2px solid transparent",cursor:"pointer",letterSpacing:"0.07em",whiteSpace:"nowrap" }}>
                {tab.icon&&<span style={{ fontSize:11 }}>{tab.icon}</span>}
                {tab.t}
                {badgeVal>0&&<span style={{ background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,padding:"1px 6px",fontSize:9,color:"#3b82f6",fontWeight:700 }}>{badgeVal}</span>}
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"0 18px",flexShrink:0 }}>
          {authUser ? (
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              {authUser.email===ADMIN_EMAIL&&<span className="vv-admin-btns" style={{ display:"flex",alignItems:"center",gap:5 }}>
                <span style={{ fontSize:9,fontWeight:700,color:"#3b82f6",background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:4,padding:"2px 7px",letterSpacing:"0.08em" }}>ADMIN</span>
              </span>}
              <div style={{ width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#000",cursor:"pointer" }} onClick={()=>window.location.href='/settings'}>
                {(authUser.email?.[0]||'U').toUpperCase()}
              </div>
              <button onClick={doSignOut} style={{ fontSize:10,color:"#475569",background:"transparent",border:"1px solid rgba(59,130,246,0.14)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit" }}>Sign Out</button>
            </div>
          ) : (
            <button onClick={()=>{setShowAuth(true);setAuthMode('login');setAuthError('');}} style={{ display:"flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",border:"none",borderRadius:8,padding:"7px 16px",fontSize:11,fontWeight:700,color:"#000",cursor:"pointer",letterSpacing:"0.06em",fontFamily:"inherit" }}>
              🔒 Login / Sign Up
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:"flex",flex:1,minHeight:0 }}>

        {/* LEFT SIDEBAR */}
        <div className="vv-sidebar" style={{ width:200,background:"rgba(7,9,26,0.99)",borderRight:"1px solid rgba(255,255,255,0.05)",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
          <div style={{ flex:1,padding:"10px 0" }}>
            {NAV_ITEMS.map((item,i)=>(
              <div key={i} onClick={()=>{
                if(item.label==='HISTORY'){setShowHistory(true);}
                else if(item.label==='ODDS MOVEMENT'){setShowOddsMovement(true);}
                else if(item.label==='SETTINGS'){window.location.href='/settings';}
                else { setActiveNav(item.label); setActiveTab('DASHBOARD'); }
              }} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 20px",background:activeNav===item.label?"rgba(201,162,39,0.07)":"transparent",borderLeft:activeNav===item.label?"2px solid #3b82f6":"2px solid transparent",cursor:"pointer" }}>
                <span style={{ fontSize:13,color:item.active?"#3b82f6":"#2d3a4a",width:18,flexShrink:0 }}>{item.icon}</span>
                <span style={{ fontSize:10,fontWeight:item.active?700:400,color:item.active?"#3b82f6":"#3a4a5e",letterSpacing:"0.08em",flex:1 }}>{item.label}</span>
                {item.arrow&&<span style={{ fontSize:9,color:"#2d3a4a" }}>▶</span>}
              </div>
            ))}
          </div>
          {/* AI Engine Status */}
          <div style={{ padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:10 }}>AI ENGINE STATUS</div>
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:8 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s infinite",flexShrink:0 }}/>
              <span style={{ fontSize:10,color:"#4ade80",fontWeight:700 }}>ONLINE</span>
              <span style={{ fontSize:10,color:"#4ade80",marginLeft:"auto" }}>100%</span>
            </div>
            <div style={{ height:2,background:"rgba(255,255,255,0.04)",borderRadius:1,marginBottom:14 }}>
              <div style={{ height:"100%",width:"100%",background:"linear-gradient(90deg,#059669,#4ade80)",borderRadius:1 }}/>
            </div>
            <GlobeSVG timeStr={timeStr}/>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",minWidth:0 }}>

          {/* Odds ticker */}
          <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(9,12,28,0.9)" }}>
            <div style={{ display:"flex",alignItems:"center" }}>
              <div className="vv-ticker-lbl" style={{ padding:"8px 16px",fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",borderRight:"1px solid rgba(255,255,255,0.05)",whiteSpace:"nowrap",flexShrink:0 }}>LIVE ODDS FEED</div>
              <div style={{ flex:1,overflow:"hidden",padding:"8px 0" }}><OddsTicker feed={oddsFeed}/></div>
              <div style={{ padding:"0 14px",flexShrink:0 }}><Sparkline color="#3b82f6" width={56} height={22}/></div>
            </div>
          </div>

          <div className="vv-main-inner" style={{ padding:"18px 18px 28px",flex:1 }}>

            {/* ── VIEW ROUTER ── */}
            {activeTab==='ALERTS' ? (
              <AlertsView betReadyAlerts={betReadyAlerts} trellAlerts={trellAlerts} games={games} results={results} pickHistory={pickHistory} watchlist={watchlist}/>
            ) : activeTab==='WATCHLIST' ? (
              <WatchlistView watchlist={watchlist} toggleWatch={toggleWatch} games={games} results={results} finalized={finalized}/>
            ) : activeNav==='SHARP MONEY' ? (
              <SharpMoneyView games={games} marketScanner={marketScanner}/>
            ) : activeNav==='VAULT LOCKS' ? (
              <VaultLocksView results={results} games={games} finalized={finalized}/>
            ) : activeNav==='AI ANALYZER' ? (
              <AIAnalyzerView games={games} results={results} generating={generating} onGenerate={handleGenerate} isSubscribed={isSubscribed}/>
            ) : activeNav==="TODAY'S SLATE" ? (
              <TodaySlateView games={games} results={results} generating={generating} onGenerate={handleGenerate} liveScores={liveScores} isSubscribed={isSubscribed} finalized={finalized} onShowAuth={()=>{setShowAuth(true);setAuthMode('login');setAuthError('');}} preAnalyzeQueue={preAnalyzeQueue} betReadyAlerts={betReadyAlerts}/>
            ) : activeNav==='PROPS AI' ? (
              <PropsAIView games={games} isSubscribed={isSubscribed}/>
            ) : (
            <>
            {/* Greeting */}
            <div style={{ marginBottom:18 }}>
              <h1 style={{ fontSize:22,fontWeight:700,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:4 }}>{greeting}, Teztez4real.</h1>
              <p style={{ fontSize:12,color:"#3a4a5e" }}>Vegas Vault AI is scanning <span style={{ color:"#3b82f6",cursor:"pointer" }}>{bookmakerCount > 0 ? `${bookmakerCount} sportsbooks` : "sportsbooks"}...</span></p>
            </div>

            {/* Stat cards */}
            <div className="vv-stats">
              {/* Today's games */}
              <div style={{ background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:10 }}>TODAY'S GAMES</div>
                <div style={{ fontSize:30,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.03em",marginBottom:4 }}>{loading?"…":games.length}</div>
                <div style={{ fontSize:10,color:"#2d3a4a" }}>{timeStr} CT</div>
              </div>
              {/* AI Picks */}
              <div style={{ background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:10 }}>AI PICKS GENERATED</div>
                <div style={{ fontSize:30,fontWeight:800,color:"#3b82f6",letterSpacing:"-0.03em",marginBottom:8 }}>{generated} <span style={{ fontSize:18,color:"#5a4a1a" }}>/ {loading?"…":games.length*2}</span></div>
                <div style={{ height:2,background:"rgba(255,255,255,0.04)",borderRadius:1 }}>
                  <div style={{ height:"100%",width:games.length?`${Math.min(100,(generated/(games.length*2))*100)}%`:"0%",background:"linear-gradient(90deg,#1d4ed8,#3b82f6)",borderRadius:1,transition:"width 0.4s" }}/>
                </div>
              </div>
              {/* Win rate */}
              <div style={{ background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:6 }}>WIN RATE (7D)</div>
                <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between" }}>
                  <div style={{ fontSize:30,fontWeight:800,color:"#4ade80",letterSpacing:"-0.03em" }}>{winRate !== null ? `${winRate}%` : "—"}</div>
                  <Sparkline color="#4ade80" width={70} height={34}/>
                </div>
              </div>
              {/* Top tier */}
              <div style={{ background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:10 }}>TOP TIER</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div style={{ fontSize:26,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em" }}>LOCK</div>
                  <span style={{ fontSize:24 }}>🔒</span>
                </div>
              </div>
              {/* AI Confidence */}
              <div style={{ background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",fontWeight:700,marginBottom:4 }}>AI CONFIDENCE</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div><div style={{ fontSize:20,fontWeight:800,color:aiConfidence===null?"#3b82f6":aiConfidence>=75?"#4ade80":aiConfidence>=50?"#fbbf24":"#f87171" }}>{aiConfidence===null?"—":aiConfidence>=75?"HIGH":aiConfidence>=50?"MED":"LOW"}</div><div style={{ fontSize:11,color:"#4a5568" }}>{aiConfidence!==null?`${aiConfidence}%`:"Analyze to score"}</div></div>
                  <RadarChart size={64}/>
                </div>
              </div>
            </div>

            {/* TOP PLAY OF THE DAY */}
            {hasSlotPattern && selectedDate === new Date().toISOString().split("T")[0] && (topPlay || topPlayLoading) && (
              <TopPlayBanner
                topPlay={topPlay}
                loading={topPlayLoading}
                results={results}
                games={games}
                pickHistory={pickHistory}
                isSubscribed={isSubscribed}
                onShowAuth={()=>{setShowAuth(true);setAuthMode('login');setAuthError('');}}
                onForceRefresh={async ()=>{
                  setTopPlayLoading(true);
                  try {
                    const {data:{session:s}} = await _supabase.auth.getSession();
                    const postRes = await fetch('/api/topplay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:s?.access_token,date:selectedDate})});
                    if (!postRes.ok) {
                      const err = await postRes.json();
                      console.error('topplay POST failed:', err);
                    }
                    const res = await fetch(`/api/topplay?date=${selectedDate}&force=1`);
                    const data = await res.json();
                    if(data.topPlay) setTopPlay(data.topPlay);
                  } catch(e){ console.error('forceRefresh error:', e); }
                  setTopPlayLoading(false);
                }}
                isAdmin={authUser?.email==='battlecortez@gmail.com'}
              />
            )}

            {/* Slate header */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <h2 className="vv-today-title" style={{ fontSize:16,fontWeight:700,color:"#f1f5f9",whiteSpace:"nowrap" }}>Today's Slate</h2>
                {preAnalyzeQueue.length > 0 && (
                  <div style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:6,padding:"2px 8px" }}>
                    <div style={{ width:5,height:5,borderRadius:"50%",background:"#60a5fa" }}/>
                    <span style={{ fontSize:9,color:"#60a5fa",fontWeight:600,letterSpacing:"0.06em" }}>AI ANALYZING {preAnalyzeQueue.length} PLAYS</span>
                  </div>
                )}
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <button onClick={()=>changeDate(-1)} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(59,130,246,0.14)",borderRadius:6,color:"#64748b",fontSize:13,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>‹</button>
                <div style={{ fontSize:11,color:"#3b82f6",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:6,padding:"4px 12px",minWidth:80,textAlign:"center" }}>{formatDisplayDate(selectedDate)}</div>
                <button onClick={()=>changeDate(1)} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(59,130,246,0.14)",borderRadius:6,color:"#64748b",fontSize:13,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>›</button>
              </div>
                <span style={{ fontSize:14,color:"#2d3a4a",cursor:"pointer" }}>⊟</span>
              </div>
            </div>

            {/* Filter pills */}
            <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" }}>
              {FILTERS.map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11,fontWeight:filter===f?700:400,padding:"5px 14px",borderRadius:6,border:`1px solid ${filter===f?"rgba(59,130,246,0.5)":"rgba(59,130,246,0.12)"}`,background:filter===f?"rgba(59,130,246,0.1)":"transparent",color:filter===f?"#3b82f6":"#3a4a5e",cursor:"pointer",letterSpacing:"0.05em",fontFamily:"inherit" }}>{f}</button>
              ))}
            </div>

            {error&&<div style={{ background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f87171",marginBottom:14 }}>{error}</div>}

            {/* BET NOW ALERT BANNER */}
            {Object.keys(betReadyAlerts).length > 0 && (
              <div style={{ marginBottom:12,background:"linear-gradient(135deg,rgba(59,130,246,0.12),rgba(245,158,11,0.08))",border:"1px solid rgba(59,130,246,0.35)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12 }}>
                <span style={{ fontSize:22 }}>🎯</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:800,color:"#3b82f6",letterSpacing:"0.06em" }}>BETS READY TO PLACE</div>
                  <div style={{ fontSize:11,color:"#1d4ed8",marginTop:2 }}>{Object.keys(betReadyAlerts).length} pick{Object.keys(betReadyAlerts).length>1?'s':''} starting within 30 minutes — check your cards below</div>
                </div>
              </div>
            )}

            {/* Game cards */}
            {loading?(
              <div style={{ textAlign:"center",padding:"60px 0",fontSize:11,color:"#2d3a4a",letterSpacing:"0.06em" }}>LOADING SLATE…</div>
            ):(
              <div className="vv-cards">
                {filteredGames.map(game=>(
                  <GameCard key={game.id} game={game} results={results} generating={generating} onGenerate={handleGenerate} onCardClick={handleCardClick} liveScores={liveScores} isSubscribed={isSubscribed} finalized={finalized} isQueued={preAnalyzeQueue.some(q=>q.game.id===game.id)} betReady={betReadyAlerts[`${game.id}-PUBLIC`]||betReadyAlerts[`${game.id}-VEGAS`]} onShowAuth={()=>{setShowAuth(true);setAuthMode('login');setAuthError('');}} watchlist={watchlist} onToggleWatch={toggleWatch}/>
                ))}
              </div>
            )}



            {/* Trell alerts */}
            {trellAlerts.length>0&&(
              <div style={{ marginTop:14,background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:14 }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",marginBottom:10 }}>⚡ TRELL RULE ALERTS</div>
                {trellAlerts.map((alert,i)=>(
                  <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<trellAlerts.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                    <div>
                      <div style={{ fontSize:12,fontWeight:600,color:"#f1f5f9" }}>{alert.player}</div>
                      <div style={{ fontSize:10,color:"#f87171",marginTop:2 }}>{alert.status} · {alert.direction}</div>
                    </div>
                    <span style={{ fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:4,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",color:"#f87171",letterSpacing:"0.08em" }}>ACTIVE</span>
                  </div>
                ))}
              </div>
            )}

            {/* Stacked right panel (tablet/mobile) */}
            {(activeTab==='DASHBOARD' && activeNav==='DASHBOARD') && (
            <div className="vv-right-stacked" style={{ marginTop:16,background:"#080d1c",border:"1px solid rgba(59,130,246,0.1)",borderRadius:12,padding:16 }}>
              <RightPanelContent marketScanner={marketScanner} insights={insights} aiConfidence={aiConfidence} confHistory={confHistory}/>
            </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (desktop) */}
        <div className="vv-right" style={{ width:290,background:"rgba(7,9,26,0.99)",borderLeft:"1px solid rgba(255,255,255,0.05)",overflowY:"auto",flexShrink:0,padding:"16px 16px 24px" }}>
          <RightPanelContent marketScanner={marketScanner} insights={insights} aiConfidence={aiConfidence} confHistory={confHistory}/>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="vv-bottom-nav">
        {[
          { icon:'⊞', label:'HOME', action:()=>{ setActiveTab('DASHBOARD'); setActiveNav('DASHBOARD'); }, active: activeTab==='DASHBOARD' && activeNav==='DASHBOARD' },
          { icon:'📅', label:'SLATE', action:()=>setActiveNav("TODAY'S SLATE"), active: activeNav==="TODAY'S SLATE" },
          { icon:'📊', label:'ODDS', action:()=>setShowOddsMovement(true), active:false },
          { icon:'⚙',  label:'SETTINGS', action:()=>window.location.href='/settings', active:false },
          { icon:'↺',  label:'HISTORY', action:()=>setShowHistory(true), active:false, badge: pickHistory.length > 0 },
        ].map((item,i) => (
          <div key={i} onClick={item.action} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",cursor:"pointer",flex:1,position:"relative" }}>
            <span style={{ fontSize:18,color:item.active?"#3b82f6":"#475569" }}>{item.icon}</span>
            {item.badge && <div style={{ position:"absolute",top:4,right:'25%',width:7,height:7,borderRadius:"50%",background:"#3b82f6" }}/>}
            <span style={{ fontSize:8,fontWeight:item.active?700:500,letterSpacing:"0.06em",color:item.active?"#3b82f6":"#475569" }}>{item.label}</span>
          </div>
        ))}
        {/* Login button replaces last item when not logged in */}
        {!authUser && (
          <div onClick={()=>{setShowAuth(true);setAuthMode('login');setAuthError('');}} style={{ position:"absolute",right:8,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",cursor:"pointer" }}>
            <span style={{ fontSize:18,color:"#3b82f6" }}>🔐</span>
            <span style={{ fontSize:8,fontWeight:600,letterSpacing:"0.06em",color:"#3b82f6" }}>LOGIN</span>
          </div>
        )}
      </div>

      {activeResult&&activeGame&&(
        <PlayResult
          result={activeResult}
          game={activeGame}
          onClose={()=>{setActiveResult(null);setActiveGame(null);}}
          isResolved={pickHistory.some(p=>p.key===`${activeGame.id}-${activeGame.slot||'PUBLIC'}`)}
          resolvedResult={pickHistory.find(p=>p.key===`${activeGame.id}-${activeGame.slot||'PUBLIC'}`)?.result}
        />
      )}

      {/* ── ODDS MOVEMENT PANEL ─────────────────────────────────────────────── */}
      {showOddsMovement&&(
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex" }}>
          <div onClick={()=>setShowOddsMovement(false)} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)" }}/>
          <div style={{ position:"relative",marginLeft:"auto",width:"100%",maxWidth:620,height:"100%",background:"#060a18",borderLeft:"1px solid rgba(59,130,246,0.12)",overflowY:"auto",display:"flex",flexDirection:"column" }}>

            {/* Header */}
            <div style={{ padding:"18px 20px",borderBottom:"1px solid rgba(59,130,246,0.1)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#060a18",zIndex:10 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:"#f1f5f9",letterSpacing:"0.04em" }}>📊 ODDS MOVEMENT</div>
                <div style={{ fontSize:10,color:"#3a4a5e",marginTop:2 }}>Live FanDuel vs DraftKings vs BetMGM vs Caesars vs Bet365 · {games.length} games today</div>
              </div>
              <button onClick={()=>setShowOddsMovement(false)} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(59,130,246,0.14)",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#64748b",fontSize:14,fontFamily:"inherit" }}>✕</button>
            </div>

            {/* Summary bar */}
            {(()=>{
              const mlbGames = games.filter(g=>g.sport==="MLB");
              const moving = mlbGames.filter(g=>g.lineMovement && !g.lineMovement.includes("stable") && !g.lineMovement.includes("Stable") && g.lineMovement!=="TBD" && g.lineMovement!=="Odds API not connected").length;
              const sharp  = mlbGames.filter(g=>(g.lineMovement||"").includes("SHARP SIGNAL") || (g.rlm)).length;
              const posEV  = mlbGames.filter(g=>g.homeEV > 0 || g.awayEV > 0).length;
              const stable = mlbGames.filter(g=>(g.lineMovement||"").toLowerCase().includes("stable")).length;
              return (
                <div style={{ padding:"14px 20px",borderBottom:"1px solid rgba(59,130,246,0.1)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
                  {[
                    { label:"MOVING", value:moving, color:"#3b82f6", sub:"lines" },
                    { label:"SHARP",  value:sharp,  color:"#f87171", sub:"signals" },
                    { label:"+EV",    value:posEV,  color:"#4ade80", sub:"spots" },
                    { label:"STABLE", value:stable, color:"#475569", sub:"lines" },
                  ].map((s,i)=>(
                    <div key={i} style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 8px",textAlign:"center" }}>
                      <div style={{ fontSize:8,color:"#3a4a5e",letterSpacing:"0.06em",marginBottom:3 }}>{s.label}</div>
                      <div style={{ fontSize:24,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</div>
                      <div style={{ fontSize:8,color:"#2d3a4a",marginTop:2 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Games list */}
            <div style={{ flex:1,padding:"14px 20px 40px" }}>
              {games.length===0 ? (
                <div style={{ textAlign:"center",padding:"60px 20px" }}>
                  <div style={{ fontSize:32,marginBottom:12 }}>📊</div>
                  <div style={{ fontSize:14,fontWeight:600,color:"#2d3a4a" }}>No games loaded yet</div>
                </div>
              ) : games.map((game,i)=>{
                const lm = game.lineMovement || "No data";
                const lmLower = lm.toLowerCase();
                const isSharp   = lm.includes("SHARP SIGNAL") || !!game.rlm;
                const isMoving  = lm.includes("moved toward") && !isSharp;
                const isStable  = lmLower.includes("stable");
                const hasEV     = game.homeEV > 0 || game.awayEV > 0;

                const borderColor = isSharp?"rgba(248,113,113,0.4)":isMoving?"rgba(59,130,246,0.35)":hasEV?"rgba(74,222,128,0.25)":"rgba(255,255,255,0.05)";
                const badge = isSharp ? { label:"⚡ SHARP",color:"#f87171",bg:"rgba(248,113,113,0.12)" }
                            : isMoving? { label:"📈 MOVING",color:"#3b82f6",bg:"rgba(59,130,246,0.1)" }
                            : hasEV   ? { label:"+EV",color:"#4ade80",bg:"rgba(74,222,128,0.08)" }
                            : { label:"STABLE",color:"#475569",bg:"rgba(255,255,255,0.04)" };

                // Opening vs current movement arrows
                const awayOpen = game.openingAwayML;
                const homeOpen = game.openingHomeML;
                const awayCur  = game.awayML;
                const homeCur  = game.homeML;
                const awayMoved = awayOpen && awayCur && awayOpen!=="N/A" && awayCur!=="N/A" && awayOpen!==awayCur;
                const homeMoved = homeOpen && homeCur && homeOpen!=="N/A" && homeCur!=="N/A" && homeOpen!==homeCur;

                // EV display
                const homeEVStr = game.homeEV != null ? (game.homeEV > 0 ? `+${game.homeEV}%` : `${game.homeEV}%`) : null;
                const awayEVStr = game.awayEV != null ? (game.awayEV > 0 ? `+${game.awayEV}%` : `${game.awayEV}%`) : null;
                const homeEVColor = game.homeEV > 0 ? "#4ade80" : game.homeEV < 0 ? "#f87171" : "#475569";
                const awayEVColor = game.awayEV > 0 ? "#4ade80" : game.awayEV < 0 ? "#f87171" : "#475569";

                return (
                  <div key={game.id||i} style={{ background:"rgba(255,255,255,0.02)",border:`1px solid ${borderColor}`,borderRadius:12,padding:"14px 16px",marginBottom:10 }}>

                    {/* Top row: matchup + badge */}
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                        <span style={{ fontSize:9,fontWeight:700,color:game.slot==="VEGAS"?"#f87171":"#60a5fa",background:game.slot==="VEGAS"?"rgba(248,113,113,0.1)":"rgba(96,165,250,0.1)",borderRadius:4,padding:"1px 6px",letterSpacing:"0.06em" }}>{game.sport||"MLB"} · {game.slot||"PUBLIC"}</span>
                        <span style={{ fontSize:12,fontWeight:700,color:"#e2e8f0" }}>{game.awayAbbr||game.away?.split(" ").pop()} @ {game.homeAbbr||game.home?.split(" ").pop()}</span>
                        <span style={{ fontSize:10,color:"#3a4a5e" }}>{game.time}</span>
                      </div>
                      <span style={{ fontSize:9,fontWeight:700,color:badge.color,background:badge.bg,borderRadius:4,padding:"2px 8px",letterSpacing:"0.07em",whiteSpace:"nowrap" }}>{badge.label}</span>
                    </div>

                    {/* ML: Open → Current with movement indicator */}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 24px 1fr",gap:6,marginBottom:8 }}>
                      {/* Away */}
                      <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px 10px" }}>
                        <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.07em",marginBottom:3 }}>{game.awayAbbr||game.away?.split(" ").pop()}</div>
                        <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
                          {awayMoved && <span style={{ fontSize:10,color:"#475569",textDecoration:"line-through" }}>{awayOpen}</span>}
                          <span style={{ fontSize:16,fontWeight:800,color:(awayCur||"").startsWith("-")?"#f87171":"#4ade80" }}>{awayCur||"N/A"}</span>
                          {awayMoved && <span style={{ fontSize:10 }}>{parseInt(awayCur)>parseInt(awayOpen)?"▲":"▼"}</span>}
                        </div>
                        {awayEVStr && <div style={{ fontSize:9,fontWeight:700,color:awayEVColor,marginTop:2 }}>EV {awayEVStr}</div>}
                      </div>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#2d3a4a",fontWeight:700 }}>@</div>
                      {/* Home */}
                      <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px 10px" }}>
                        <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.07em",marginBottom:3 }}>{game.homeAbbr||game.home?.split(" ").pop()}</div>
                        <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
                          {homeMoved && <span style={{ fontSize:10,color:"#475569",textDecoration:"line-through" }}>{homeOpen}</span>}
                          <span style={{ fontSize:16,fontWeight:800,color:(homeCur||"").startsWith("-")?"#f87171":"#4ade80" }}>{homeCur||"N/A"}</span>
                          {homeMoved && <span style={{ fontSize:10 }}>{parseInt(homeCur)>parseInt(homeOpen)?"▲":"▼"}</span>}
                        </div>
                        {homeEVStr && <div style={{ fontSize:9,fontWeight:700,color:homeEVColor,marginTop:2 }}>EV {homeEVStr}</div>}
                      </div>
                    </div>

                    {/* Line movement summary */}
                    <div style={{ padding:"8px 10px",background:isSharp?"rgba(248,113,113,0.06)":isMoving?"rgba(201,162,39,0.05)":"rgba(255,255,255,0.02)",borderRadius:8,border:`1px solid ${isSharp?"rgba(248,113,113,0.15)":isMoving?"rgba(59,130,246,0.1)":"rgba(255,255,255,0.04)"}`,marginBottom:game.rlm||game.runLine?8:0 }}>
                      <span style={{ fontSize:10,color:isSharp?"#f87171":isMoving?"#3b82f6":"#64748b" }}>{lm}</span>
                    </div>

                    {/* RLM alert */}
                    {game.rlm && (
                      <div style={{ padding:"6px 10px",background:"rgba(248,113,113,0.08)",borderRadius:6,border:"1px solid rgba(248,113,113,0.2)",marginBottom:4 }}>
                        <span style={{ fontSize:10,fontWeight:700,color:"#f87171" }}>⚡ SHARP SIDE: {game.rlm}</span>
                      </div>
                    )}

                    {/* Run line / spread */}
                    {game.runLine && game.runLine!=="N/A" && (
                      <div style={{ fontSize:9,color:"#3a4a5e",marginTop:4 }}>Spread: <span style={{ color:"#475569" }}>{game.runLine}</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY PANEL ────────────────────────────────────────────────────── */}
      {showHistory&&(
        <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex" }}>
          {/* Backdrop */}
          <div onClick={()=>setShowHistory(false)} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)" }}/>
          {/* Panel */}
          <div style={{ position:"relative",marginLeft:"auto",width:"100%",maxWidth:560,height:"100%",background:"#060a18",borderLeft:"1px solid rgba(59,130,246,0.12)",overflowY:"auto",display:"flex",flexDirection:"column" }}>

            {/* Header */}
            <div style={{ padding:"18px 20px",borderBottom:"1px solid rgba(59,130,246,0.1)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#060a18",zIndex:10 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:"#f1f5f9",letterSpacing:"0.04em" }}>MY PICKS HISTORY</div>
                <div style={{ fontSize:10,color:"#3a4a5e",marginTop:2 }}>{pickHistory.length} total picks tracked</div>
              </div>
              <button onClick={()=>setShowHistory(false)} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(59,130,246,0.14)",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#64748b",fontSize:14,fontFamily:"inherit" }}>✕</button>
            </div>

            {/* Stats bar */}
            {pickHistory.length > 0 && (()=>{
              const wins = pickHistory.filter(p=>p.result==='win').length;
              const losses = pickHistory.filter(p=>p.result==='loss').length;
              const total = wins + losses;
              const rate = total > 0 ? Math.round((wins/total)*100) : 0;
              const sevenDays = pickHistory.filter(p=>p.resolvedAt && Date.now()-new Date(p.resolvedAt).getTime() < 7*86400000);
              const w7 = sevenDays.filter(p=>p.result==='win').length;
              const l7 = sevenDays.filter(p=>p.result==='loss').length;
              const r7 = (w7+l7) > 0 ? Math.round((w7/(w7+l7))*100) : 0;
              return (
                <div style={{ padding:"16px 20px",borderBottom:"1px solid rgba(59,130,246,0.1)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
                  {[
                    { label:"ALL TIME", value:`${rate}%`, sub:`${wins}W-${losses}L`, color: rate>=60?"#4ade80":rate>=50?"#fbbf24":"#f87171" },
                    { label:"LAST 7D", value:`${r7}%`, sub:`${w7}W-${l7}L`, color: r7>=60?"#4ade80":r7>=50?"#fbbf24":"#f87171" },
                    { label:"TOTAL PICKS", value:total, sub:"tracked", color:"#94a3b8" },
                    { label:"BEST STREAK", value:(()=>{ let s=0,m=0; for(const p of [...pickHistory].reverse()){ if(p.result==='win'){s++;m=Math.max(m,s);}else s=0;} return m; })()+"W", sub:"in a row", color:"#3b82f6" },
                  ].map((stat,i)=>(
                    <div key={i} style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"12px 10px",textAlign:"center" }}>
                      <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.06em",marginBottom:4 }}>{stat.label}</div>
                      <div style={{ fontSize:22,fontWeight:800,color:stat.color,lineHeight:1 }}>{stat.value}</div>
                      <div style={{ fontSize:9,color:"#2d3a4a",marginTop:3 }}>{stat.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Picks list */}
            <div style={{ flex:1,padding:"12px 20px 100px" }}>
              {pickHistory.length === 0 ? (
                <div style={{ textAlign:"center",padding:"60px 20px" }}>
                  <div style={{ fontSize:32,marginBottom:12 }}>📊</div>
                  <div style={{ fontSize:14,fontWeight:600,color:"#2d3a4a",marginBottom:6 }}>No picks tracked yet</div>
                  <div style={{ fontSize:12,color:"#1e2a3a" }}>Generate plays and mark them Win or Loss<br/>to start tracking your performance.</div>
                </div>
              ) : (
                [...pickHistory].reverse().map((pick, i) => {
                  const isWin = pick.result === 'win';
                  const isLoss = pick.result === 'loss';
                  const isPending = !pick.result;
                  return (
                    <div key={i} style={{ background:"rgba(255,255,255,0.02)",border:`1px solid ${isWin?"rgba(74,222,128,0.2)":isLoss?"rgba(248,113,113,0.2)":"rgba(255,255,255,0.05)"}`,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                          <span style={{ fontSize:10,fontWeight:700,color:pick.slot==="VEGAS"?"#f87171":"#60a5fa",background:pick.slot==="VEGAS"?"rgba(248,113,113,0.1)":"rgba(96,165,250,0.1)",borderRadius:4,padding:"1px 6px",letterSpacing:"0.06em" }}>{pick.slot||"PUBLIC"}</span>
                          <span style={{ fontSize:11,fontWeight:600,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{pick.pick}</span>
                          <span style={{ fontSize:10,color:"#475569" }}>{pick.betType}</span>
                        </div>
                        <div style={{ fontSize:11,color:"#3a4a5e",marginBottom:2 }}>{pick.game}</div>
                        {pick.score && <div style={{ fontSize:10,color:"#2d3a4a" }}>Final: {pick.score}</div>}
                        <div style={{ fontSize:9,color:"#1e2a3a",marginTop:4 }}>{pick.resolvedAt ? new Date(pick.resolvedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : pick.date}</div>
                      </div>
                      <div style={{ flexShrink:0,textAlign:"center" }}>
                        {isWin && <div style={{ fontSize:13,fontWeight:800,color:"#4ade80",background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8,padding:"6px 14px" }}>✅ WIN</div>}
                        {isLoss && <div style={{ fontSize:13,fontWeight:800,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"6px 14px" }}>❌ LOSS</div>}
                        {isPending && <div style={{ fontSize:11,color:"#3a4a5e",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(59,130,246,0.1)",borderRadius:8,padding:"6px 14px" }}>PENDING</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Clear history button */}
            {pickHistory.length > 0 && (
              <div style={{ padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.05)",position:"sticky",bottom:0,background:"#060a18" }}>
                <button onClick={()=>{ if(window.confirm('Clear all pick history?')){ setPickHistory([]); localStorage.removeItem('vv_pick_history'); }}} style={{ width:"100%",padding:"10px 0",background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.15)",borderRadius:8,fontSize:11,color:"#f87171",cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em" }}>
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAuth&&(
        <div onClick={e=>e.target===e.currentTarget&&setShowAuth(false)} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#0a0d1a",border:"1px solid rgba(59,130,246,0.14)",borderRadius:20,width:"100%",maxWidth:500,maxHeight:"95vh",overflowY:"auto",boxShadow:"0 40px 100px rgba(0,0,0,0.9)" }}>
            <div style={{ padding:"28px 28px 24px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
                <div style={{ display:"flex",gap:0,borderBottom:"1px solid rgba(59,130,246,0.12)" }}>
                  {["login","signup","plans"].filter(m=>authMode==="plans"?m==="plans":m!=="plans").map(m=>(
                    <button key={m} onClick={()=>{setAuthMode(m);setAuthError('');}} style={{ padding:"6px 18px",background:"none",border:"none",borderBottom:authMode===m?"2px solid #3b82f6":"2px solid transparent",fontSize:11,fontWeight:authMode===m?700:400,color:authMode===m?"#3b82f6":"#475569",cursor:"pointer",letterSpacing:"0.08em",fontFamily:"inherit",marginBottom:-1 }}>
                      {m==="login"?"SIGN IN":m==="signup"?"SIGN UP":"SUBSCRIBE"}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowAuth(false)} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(59,130,246,0.14)",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#64748b",fontSize:13,fontFamily:"inherit" }}>✕</button>
              </div>

              {authMode==="plans" ? (
                <div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Choose Your Plan</div>
                  <div style={{ fontSize:12,color:"#475569",marginBottom:22 }}>Unlock full AI analysis on every game.</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
                    {[{id:"weekly",label:"WEEKLY",price:"$19.99",period:"/week",features:["Full AI model","All games","Auto plays","Trell Rule alerts"],hl:false},{id:"monthly",label:"MONTHLY",price:"$49.99",period:"/month",features:["Everything weekly","Priority generation","Model updates","Early access"],hl:true,badge:"Best Value"}].map(p=>(
                      <div key={p.id} style={{ background:p.hl?"rgba(201,162,39,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${p.hl?"rgba(59,130,246,0.3)":"rgba(59,130,246,0.12)"}`,borderRadius:12,padding:"16px 14px",position:"relative" }}>
                        {p.badge&&<div style={{ position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",background:"#3b82f6",color:"#000",fontSize:8,fontWeight:800,padding:"2px 10px",borderRadius:10,whiteSpace:"nowrap" }}>{p.badge}</div>}
                        <div style={{ fontSize:10,fontWeight:700,color:p.hl?"#3b82f6":"#94a3b8",letterSpacing:"0.06em",marginBottom:6 }}>{p.label}</div>
                        <div style={{ display:"flex",alignItems:"baseline",gap:3,marginBottom:10 }}><span style={{ fontSize:20,fontWeight:900,color:"#f1f5f9" }}>{p.price}</span><span style={{ fontSize:10,color:"#475569" }}>{p.period}</span></div>
                        <ul style={{ listStyle:"none",marginBottom:12 }}>{p.features.map((f,i)=><li key={i} style={{ fontSize:10,color:"#64748b",marginBottom:3,display:"flex",gap:6 }}><span style={{ color:"#3b82f6" }}>✓</span>{f}</li>)}</ul>
                        <button onClick={()=>doSubscribe(p.id)} style={{ width:"100%",padding:"8px 0",background:p.hl?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"rgba(255,255,255,0.05)",border:p.hl?"none":"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:10,fontWeight:700,color:p.hl?"#000":"#94a3b8",cursor:"pointer",fontFamily:"inherit" }}>Subscribe</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setShowAuth(false)} style={{ width:"100%",padding:"8px 0",background:"transparent",border:"1px solid rgba(59,130,246,0.12)",borderRadius:8,fontSize:10,color:"#475569",cursor:"pointer",fontFamily:"inherit" }}>Maybe later — continue to dashboard</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:20,fontWeight:700,color:"#f1f5f9",marginBottom:4 }}>{authMode==="login"?"Welcome back,":"Create your account,"}</div>
                  <div style={{ fontSize:12,color:"#475569",marginBottom:20 }}>{authMode==="login"?"Sign in to access your ":"Join "}<span style={{ color:"#3b82f6" }}>Vegas Vault AI</span>{authMode==="login"?" dashboard.":"and start winning."}</div>
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:9,color:"#475569",letterSpacing:"0.08em",fontWeight:700,marginBottom:5 }}>EMAIL ADDRESS</div>
                    <input type="email" placeholder="you@example.com" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} style={{ width:"100%",padding:"11px 13px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box" }}/>
                  </div>
                  <div style={{ marginBottom:16,position:"relative" }}>
                    <div style={{ fontSize:9,color:"#475569",letterSpacing:"0.08em",fontWeight:700,marginBottom:5 }}>PASSWORD</div>
                    <input type={showPw?"text":"password"} placeholder="Enter your password" value={authPw} onChange={e=>setAuthPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()} style={{ width:"100%",padding:"11px 40px 11px 13px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box" }}/>
                    <button onClick={()=>setShowPw(!showPw)} style={{ position:"absolute",right:11,top:29,background:"none",border:"none",cursor:"pointer",color:"#3a4a5e",fontSize:14 }}>{showPw?"🙈":"👁"}</button>
                  </div>
                  {authError&&<div style={{ marginBottom:12,padding:"9px 13px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,fontSize:11,color:"#f87171" }}>{authError}</div>}
                  <button onClick={doAuth} disabled={authLoading} style={{ width:"100%",padding:"13px 0",background:authLoading?"rgba(59,130,246,0.4)":"linear-gradient(135deg,#3b82f6,#1d4ed8)",border:"none",borderRadius:11,fontSize:12,fontWeight:700,color:"#000",cursor:authLoading?"not-allowed":"pointer",letterSpacing:"0.08em",fontFamily:"inherit",marginBottom:12 }}>
                    {authLoading?"Please wait…":authMode==="login"?"LOG IN TO VAULT →":"CREATE ACCOUNT →"}
                  </button>
                  <div style={{ textAlign:"center",fontSize:10,color:"#2d3a4a" }}>🔒 Bank-level encryption. Your data is always protected.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
