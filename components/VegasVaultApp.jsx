"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase as _supabase } from '@/lib/supabaseClient';
import NewLookShell from '@/components/NewLookShell';
import '@/app/new-look.css';

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

// NBA team slugs for ESPN CDN
const NBA_SLUGS = {
  "ATL":"atl","BOS":"bos","BKN":"bkn","CHA":"cha","CHI":"chi",
  "CLE":"cle","DAL":"dal","DEN":"den","DET":"det","GSW":"gs",
  "HOU":"hou","IND":"ind","LAC":"lac","LAL":"lal","MEM":"mem",
  "MIA":"mia","MIL":"mil","MIN":"min","NOP":"no","NYK":"ny",
  "OKC":"okc","ORL":"orl","PHI":"phi","PHX":"phx","POR":"por",
  "SAC":"sac","SAS":"sa","TOR":"tor","UTA":"utah","WAS":"wsh",
  // Handle full name fallbacks
  "Hawks":"atl","Celtics":"bos","Nets":"bkn","Hornets":"cha","Bulls":"chi",
  "Cavaliers":"cle","Mavericks":"dal","Nuggets":"den","Pistons":"det","Warriors":"gs",
  "Rockets":"hou","Pacers":"ind","Clippers":"lac","Lakers":"lal","Grizzlies":"mem",
  "Heat":"mia","Bucks":"mil","Timberwolves":"min","Pelicans":"no","Knicks":"ny",
  "Thunder":"okc","Magic":"orl","76ers":"phi","Suns":"phx","Trail":"por",
  "Kings":"sac","Spurs":"sa","Raptors":"tor","Jazz":"utah","Wizards":"wsh",
};

// WNBA team slugs for ESPN CDN
const WNBA_SLUGS = {
  "ATL":"atl","CHI":"chi","CON":"conn","DAL":"dal","IND":"ind",
  "LVA":"lv","LAS":"lv","LAL":"la","MIN":"min","NYL":"ny",
  "PHO":"phx","SEA":"sea","WAS":"wsh",
  // Handle full name fallbacks
  "Dream":"atl","Sky":"chi","Sun":"conn","Wings":"dal","Fever":"ind",
  "Aces":"lv","Sparks":"la","Lynx":"min","Liberty":"ny",
  "Mercury":"phx","Storm":"sea","Mystics":"wsh","Tempo":"tor",
};

function TeamLogo({ abbr, size=44, sport="MLB" }) {
  const [err, setErr] = useState(false);
  
  let slug = null;
  let espnSport = null;
  
  if (sport === "MLB") {
    slug = MLB_SLUGS[abbr];
    espnSport = "mlb";
  } else if (sport === "NBA") {
    slug = NBA_SLUGS[abbr];
    espnSport = "nba";
  } else if (sport === "WNBA") {
    slug = WNBA_SLUGS[abbr];
    espnSport = "wnba";
  }

  if (slug && espnSport && !err) {
    return (
      <img
        src={`https://a.espncdn.com/i/teamlogos/${espnSport}/500/${slug}.png`}
        alt={abbr}
        width={size} height={size}
        style={{ objectFit:"contain", flexShrink:0 }}
        onError={() => setErr(true)}
      />
    );
  }
  // Fallback colored box with initials
  const col = MLB_COLORS[abbr] || "#1e3a5f";
  return (
    <div style={{ width:size, height:size, borderRadius:8, background:`${col}22`, border:`1.5px solid ${col}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.3, fontWeight:900, color:col, flexShrink:0 }}>
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
  // Handle string format from new 4-stage engine
  if (typeof scam === 'string' && scam && scam !== 'N/A') return (
    <div style={{ background:"rgba(201,162,39,0.04)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"12px 14px" }}>
      <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.08em",color:"#3b82f6",background:"rgba(59,130,246,0.1)",padding:"3px 8px",borderRadius:4,display:"inline-block",marginBottom:8 }}>⚡ SCAM PLAY</div>
      <div style={{ fontSize:12,color:"#e2e8f0",lineHeight:1.65 }}>{scam}</div>
    </div>
  );
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
  const a = result.analysis || result.summary || {};
  const isVegas = result.summary.slot === "VEGAS";
  const isTennis = game.sport === "Tennis";

  // Always show LIVE price from game odds, not the stale price from AI analysis
  const getLivePrice = () => {
    if (!result.summary?.pick || !result.summary?.betType) return result.summary?.betType || '';
    const pick = result.summary.pick;
    const betType = result.summary.betType || '';
    const isAway = pick.toLowerCase().includes((game.away || '').split(' ').pop().toLowerCase()) ||
                   pick.toLowerCase().includes((game.awayAbbr || '').toLowerCase());
    const isHome = !isAway;

    // Strip stale price from betType (e.g. "ML -102" → "ML", "+1.5 -110" → "+1.5")
    const betBase = betType.replace(/\s*[+-]\d{2,4}$/, '').trim();

    if (betBase === 'ML' || betBase === 'Moneyline') {
      const livePrice = isAway ? game.awayML : game.homeML;
      return livePrice && livePrice !== 'N/A' ? `ML ${livePrice}` : betType;
    }
    if (betBase.includes('+1.5') || betBase.includes('Run Line +1.5')) {
      const livePrice = isAway ? game.awayRunLine || game.spread : game.homeRunLine;
      return `+1.5`;
    }
    if (betBase.includes('-1.5') || betBase.includes('Run Line -1.5')) {
      return `-1.5`;
    }
    return betType;
  };
  const liveBetType = getLivePrice();
  const isWNBA = game.sport === "WNBA";
  const isNBA = game.sport === "NBA";
  const isNFL = game.sport === "NFL";
  // New 4-stage fields (shown first, only if they have data)
  const stageFields = [
    {label:"Price vs Data",key:"priceVsDataAudit"},
    {label:"Matchup",key:"matchupFoundation"},
    {label:"Recent Form",key:"recentForm"},
    {label:"Head to Head",key:"headToHead"},
    {label:"Pitching",key:"pitching"},
    {label:"Hitter & Lineup",key:"hitterLineup"},
    {label:"Series Context",key:"seriesContext"},
    {label:"Pace & Ratings",key:"paceRatings"},
    {label:"QB Matchup",key:"qbMatchup"},
    {label:"Injuries",key:"injuries"},
    {label:"Weather",key:"weather"},
    {label:"Situational",key:"situational"},
    {label:"Trell Rule",key:"trellRule"},
    {label:"Sharp Money",key:"sharpMoney"},
    {label:"Propaganda",key:"propaganda"},
    {label:"Game Script",key:"gameScript"},
    {label:"Market Logic",key:"marketLogic"},
    {label:"Edge Strength",key:"edgeStrength"},
  ];
  // Legacy fields for old analyses
  const legacyFields = [
    {label:"Records",key:"records"},
    {label:"Hitter & Lineup",key:"hitterLineup"},
    {label:"Series Context",key:"seriesContext"},
    {label:"Pricing",key:"pricingComprehension"},
    {label:"Line Movement",key:"lineMovement"},
    {label:"Vegas vs Public",key:"vegasVsPublic"},
    {label:"Rankings & Tier",key:"rankingsTier"},
    {label:"Surface Analysis",key:"surfaceAnalysis"},
    {label:"Tournament Context",key:"tournamentContext"},
    {label:"Fatigue & Schedule",key:"fatigueScheduling"},
    {label:"Serve & Return",key:"serveReturn"},
    {label:"Mental & Psych",key:"mentalPsychological"},
    {label:"Injury Check",key:"injuryCheck"},
    {label:"Pricing Intelligence",key:"pricingIntelligence"},
  ];
  // Combine — stageFields first, then any legacy fields that have data
  const steps = [...stageFields, ...legacyFields];
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
            {game?.sport !== "WNBA" && <span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:isVegas?"rgba(248,113,113,0.08)":"rgba(96,165,250,0.08)",border:isVegas?"1px solid rgba(248,113,113,0.25)":"1px solid rgba(96,165,250,0.25)",color:isVegas?"#f87171":"#60a5fa",letterSpacing:"0.08em" }}>{isVegas?"VEGAS SLOT":"PUBLIC SLOT"}</span>}
            {result.summary.isScamPlay&&<span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",color:"#3b82f6",letterSpacing:"0.08em" }}>⚡ SCAM PLAY</span>}
            <span style={{ fontSize:10,padding:"4px 12px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(59,130,246,0.14)",color:conf.color,marginLeft:"auto" }}>Confidence: <strong>{result.summary.confidence}</strong></span>
          </div>
          {/* PRIMARY PLAY */}
          <div style={{ marginBottom:8,padding:"10px 12px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10 }}>
            <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:"#3b82f6",marginBottom:4 }}>PRIMARY PLAY</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:12 }}>
              <span style={{ fontSize:28,fontWeight:800,color:"#f8fafc",letterSpacing:"-0.02em" }}>{result.summary.pick}</span>
              <span style={{ fontSize:16,fontWeight:600,color:"#3b82f6" }}>{liveBetType}</span>
            </div>
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
              {steps.filter(s => a[s.key] && a[s.key] !== "—" && a[s.key] !== "N/A" && a[s.key] !== "null").map((s,i)=><AnalysisRow key={s.key} index={i+1} label={s.label} value={a[s.key]} />)}
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

// ── GAME CARD — new glass design ─────────────────────────────────────────────

function GameCard({ game, onGenerate, results, generating, onCardClick, liveScores, isSubscribed, finalized, isQueued, betReady, onShowAuth, watchlist, onToggleWatch, pickHistory }) {
  const resultVegas  = results[`${game.id}-VEGAS`];
  const resultPublic = results[`${game.id}-PUBLIC`];
  const bestResult   = resultVegas || resultPublic;
  const tier = bestResult?.summary ? (TIER_STYLES[bestResult.summary.tier] || TIER_STYLES["3"]) : null;
  const isLock = tier?.label === "LOCK";
  const isTennis = game.sport === "Tennis";

  // Live score lookup
  const awayLast = game.away?.split(' ').pop();
  const homeLast = game.home?.split(' ').pop();
  const live = liveScores?.[game.id]
    || liveScores?.[`${game.away}|${game.home}`]
    || liveScores?.[`${game.awayAbbr}|${game.homeAbbr}`]
    || liveScores?.[`${awayLast}|${homeLast}`];
  const isLive = live?.status === 'Live' || live?.detailedState === 'In Progress';
  const isFinal = live?.status === 'Final' || live?.detailedState === 'Final';
  const hasScoreData = live?.awayScore != null || live?.homeScore != null;
  const isPostponed = !hasScoreData && !isLive && !isFinal && (live?.isPostponed || false);
  const isDelayed = !hasScoreData && (live?.isDelayed || false);
  const gameStarted = isLive || isFinal;

  const awayName = isTennis ? game.player1 : game.away;
  const homeName = isTennis ? game.player2 : game.home;
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
    "Diamondbacks":"ARI","Braves":"ATL","Orioles":"BAL","Red Sox":"BOS",
    "Cubs":"CHC","White Sox":"CHW","Reds":"CIN","Guardians":"CLE","Rockies":"COL",
    "Tigers":"DET","Astros":"HOU","Royals":"KC","Angels":"LAA","Dodgers":"LAD",
    "Marlins":"MIA","Brewers":"MIL","Twins":"MIN","Mets":"NYM","Yankees":"NYY",
    "Athletics":"OAK","Phillies":"PHI","Pirates":"PIT","Padres":"SD",
    "Mariners":"SEA","Giants":"SF","Cardinals":"STL","Rays":"TB","Rangers":"TEX",
    "Blue Jays":"TOR","Nationals":"WSH",
  };
  const awayAbbr = game.awayAbbr || NAME_TO_ABBR[awayName] || NAME_TO_ABBR[awayName?.split(" ").pop()] || awayName?.slice(0,3).toUpperCase();
  const homeAbbr = game.homeAbbr || NAME_TO_ABBR[homeName] || NAME_TO_ABBR[homeName?.split(" ").pop()] || homeName?.slice(0,3).toUpperCase();
  const awayRec = isTennis ? `#${game.player1Ranking}` : game.awayRecord;
  const homeRec = isTennis ? `#${game.player2Ranking}` : game.homeRecord;

  // Odds formatting
  const fmtOdds = (v) => {
    if (!v || v === 'N/A' || v === 'null') return null;
    if (typeof v === 'number') return v > 0 ? `+${v}` : `${v}`;
    return v;
  };
  const awayOdds = fmtOdds(game.dkAwayML) || fmtOdds(game.awayML) || '—';
  const homeOdds = fmtOdds(game.dkHomeML) || fmtOdds(game.homeML) || '—';
  const spreadVal = game.dkSpread || game.spread || '—';
  const totalVal  = game.dkTotal  || game.total  || '—';
  const awaySpread = (() => {
    if (spreadVal === '—') return '—';
    const n = parseFloat(spreadVal);
    if (isNaN(n)) return spreadVal;
    return n > 0 ? `-${n.toFixed(1)}` : `+${Math.abs(n).toFixed(1)}`;
  })();
  const hasMovement = game.lineMovement && !['No significant movement','N/A','No significant movement detected'].includes(game.lineMovement);

  // Slot tag styles
  const slotStyle = game.slot === 'VEGAS'
    ? { bg:'rgba(57,255,20,0.1)', color:'#2aa800', border:'1px solid rgba(57,255,20,0.25)', label:'VEGAS SLOT' }
    : { bg:'rgba(80,140,255,0.08)', color:'#5588ee', border:'1px solid rgba(80,140,255,0.2)', label:'PUBLIC SLOT' };

  // Tier badge
  const tierStyle = tier?.label === 'LOCK'
    ? { bg:'rgba(57,255,20,0.1)', color:'#2aa800', border:'1px solid rgba(57,255,20,0.25)', stars:'★★★★★' }
    : tier?.label === '2'
    ? { bg:'rgba(255,200,0,0.08)', color:'#bb8800', border:'1px solid rgba(255,200,0,0.2)', stars:'★★★★' }
    : { bg:'rgba(0,0,0,0.04)', color:'#999', border:'1px solid rgba(0,0,0,0.07)', stars:'' };

  const key = `${game.id}-${game.slot}`;
  const isGen = generating === key;
  const hasRes = !!results[key];

  return (
    <div
      onClick={() => hasRes && onCardClick && onCardClick(game, results[key])}
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: isLock && isSubscribed
          ? '1px solid rgba(57,255,20,0.3)'
          : '1px solid rgba(255,255,255,0.93)',
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        boxShadow: isLock && isSubscribed
          ? '0 8px 30px rgba(57,255,20,0.1), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.95)'
          : '0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.95)',
        padding: '14px 16px',
        cursor: hasRes ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {/* Header row — slot tag + tier + time + watchlist */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* Slot tag */}
          {!isPostponed && !isDelayed && (
            <span style={{ fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:6, letterSpacing:'0.5px', background:slotStyle.bg, color:slotStyle.color, border:slotStyle.border }}>
              {slotStyle.label}
            </span>
          )}
          {isLive && <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'#dc2626', padding:'3px 9px', borderRadius:6, display:'flex', alignItems:'center', gap:4 }}><span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'inline-block', animation:'pulse 1s infinite' }}/> LIVE</span>}
          {isFinal && !isPostponed && <span style={{ fontSize:9, fontWeight:700, color:'#999', background:'rgba(0,0,0,0.04)', padding:'3px 9px', borderRadius:6, border:'1px solid rgba(0,0,0,0.07)' }}>FINAL</span>}
          {isDelayed && <span style={{ fontSize:9, fontWeight:700, color:'#bb8800', background:'rgba(255,200,0,0.08)', padding:'3px 9px', borderRadius:6 }}>⏸ DELAYED</span>}
          {isPostponed && <span style={{ fontSize:9, fontWeight:700, color:'#dd4444', background:'rgba(255,80,80,0.08)', padding:'3px 9px', borderRadius:6 }}>⛔ POSTPONED</span>}
          {betReady && !gameStarted && isSubscribed && <span style={{ fontSize:9, fontWeight:800, color:'#111', background:'#39FF14', padding:'3px 9px', borderRadius:6 }}>🎯 BET NOW</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Tier badge */}
          {tier && isSubscribed && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:7, background:tierStyle.bg, color:tierStyle.color, border:tierStyle.border }}>
              {tierStyle.stars && <span style={{ fontSize:10 }}>{tierStyle.stars}</span>}
              {tier.label === 'LOCK' ? 'TIER 1' : tier.label === '2' ? 'TIER 2' : 'PASS'}
            </span>
          )}
          <span style={{ fontSize:10, color:'#aaa', fontVariantNumeric:'tabular-nums' }}>{live?.updatedTime || live?.scheduledTime || game.time}</span>
          <span
            onClick={e => { e.stopPropagation(); onToggleWatch?.(game.id); }}
            style={{ fontSize:16, color:watchlist?.includes(game.id) ? '#39FF14' : '#ccc', cursor:'pointer', lineHeight:1 }}
          >{watchlist?.includes(game.id) ? '★' : '☆'}</span>
        </div>
      </div>

      {/* Teams row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        {/* Away */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:64, flexShrink:0 }}>
          <TeamLogo abbr={awayAbbr} size={42} sport={game.sport} />
          <div style={{ fontSize:10, fontWeight:800, color:'#111', textAlign:'center' }}>{awayAbbr}</div>
          <div style={{ fontSize:8, color:'#bbb', textAlign:'center' }}>{awayRec}</div>
        </div>
        {/* Middle */}
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>
            {isTennis ? `${awayName} vs ${homeName}` : `${awayAbbr} @ ${homeAbbr}`}
          </div>
          <div style={{ fontSize:9, color:'#aaa', marginTop:2 }}>{game.venue || ''}</div>
          {/* Live score */}
          {gameStarted && live && (
            <div style={{ marginTop:8, background:'rgba(0,0,0,0.04)', borderRadius:10, padding:'8px 12px', display:'flex', justifyContent:'space-around', alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>{awayAbbr}</div>
                <div style={{ fontSize:24, fontWeight:900, color:'#111' }}>{live.awayScore ?? '-'}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                {isLive ? (
                  <div>
                    <div style={{ fontSize:9, color:'#dc2626', fontWeight:700 }}>{live.inningHalf?.slice(0,3).toUpperCase()||''} {live.inning||''}</div>
                    <div style={{ fontSize:9, color:'#aaa' }}>{live.outs ?? 0} out{live.outs===1?'':'s'}</div>
                  </div>
                ) : <div style={{ fontSize:10, color:'#aaa', fontWeight:600 }}>FINAL</div>}
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>{homeAbbr}</div>
                <div style={{ fontSize:24, fontWeight:900, color:'#111' }}>{live.homeScore ?? '-'}</div>
              </div>
            </div>
          )}
        </div>
        {/* Home */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:64, flexShrink:0 }}>
          <TeamLogo abbr={homeAbbr} size={42} sport={game.sport} />
          <div style={{ fontSize:10, fontWeight:800, color:'#111', textAlign:'center' }}>{homeAbbr}</div>
          <div style={{ fontSize:8, color:'#bbb', textAlign:'center' }}>{homeRec}</div>
        </div>
      </div>

      {/* DraftKings odds row */}
      {!isTennis && (game.awayML || game.homeML || game.dkAwayML || game.dkHomeML) && (
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
            <div style={{ fontSize:8, fontWeight:700, color:'#5588ee', background:'rgba(80,140,255,0.08)', border:'1px solid rgba(80,140,255,0.2)', borderRadius:3, padding:'1px 6px', letterSpacing:'0.06em' }}>DK</div>
            <span style={{ fontSize:8, color:'#aaa', letterSpacing:'0.06em' }}>DRAFTKINGS ODDS</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            {/* Moneyline */}
            <div style={{ background:'rgba(255,255,255,0.55)', border:'1px solid rgba(0,0,0,0.05)', borderRadius:9, padding:'6px 0', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:700, marginBottom:4 }}>Moneyline</div>
              <div style={{ display:'flex', justifyContent:'space-around' }}>
                <span style={{ fontSize:11, fontWeight:700, color:awayOdds.startsWith('-')?'#dd4444':'#33aa00' }}>{awayOdds}</span>
                <span style={{ fontSize:11, fontWeight:700, color:homeOdds.startsWith('-')?'#dd4444':'#33aa00' }}>{homeOdds}</span>
              </div>
            </div>
            {/* Run Line / Spread */}
            <div style={{ background:'rgba(255,255,255,0.55)', border:'1px solid rgba(0,0,0,0.05)', borderRadius:9, padding:'6px 0', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:700, marginBottom:4 }}>{game.sport==='MLB'?'Run Line':'Spread'}</div>
              <div style={{ display:'flex', justifyContent:'space-around' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#555' }}>{awaySpread === '—' ? '—' : awaySpread}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#555' }}>{spreadVal}</span>
              </div>
            </div>
            {/* Total */}
            <div style={{ background:'rgba(255,255,255,0.55)', border:'1px solid rgba(0,0,0,0.05)', borderRadius:9, padding:'6px 0', textAlign:'center' }}>
              <div style={{ fontSize:7, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:700, marginBottom:4 }}>Total</div>
              <div style={{ display:'flex', justifyContent:'space-around' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#5588ee' }}>{totalVal !== '—' ? 'o'+totalVal : '—'}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#5588ee' }}>{totalVal !== '—' ? 'u'+totalVal : '—'}</span>
              </div>
            </div>
          </div>
          {/* Line movement */}
          {hasMovement && isSubscribed && (
            <div style={{ marginTop:6, padding:'5px 9px', background:'rgba(246,249,246,0.7)', border:'1px solid rgba(195,240,195,0.5)', borderRadius:7, fontSize:9, color:'#444', fontWeight:600 }}>
              ⚡ {game.lineMovement}
            </div>
          )}
        </div>
      )}

      {/* Result / pick strip */}
      {isSubscribed && hasRes && results[key]?.summary && (() => {
        const r = results[key];
        const ts = TIER_STYLES[r.summary.tier] || TIER_STYLES["3"];
        const isVeg = game.slot === 'VEGAS';
        const histEntry = pickHistory?.find(p => p.key === key);
        const pickRes = histEntry?.result;
        const isWin = pickRes === 'win';
        const isLoss = pickRes === 'loss';
        return (
          <div style={{ background:isVeg?'rgba(57,255,20,0.06)':'rgba(80,140,255,0.05)', border:isVeg?'1px solid rgba(57,255,20,0.2)':'1px solid rgba(80,140,255,0.15)', borderRadius:9, padding:'8px 10px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:7, fontWeight:800, color:isVeg?'#2aa800':'#5588ee', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{game.slot} PRIMARY</div>
                <div style={{ fontSize:13, fontWeight:800, color:'#111' }}>{r.summary.pick}</div>
                <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{r.summary.betType}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:6, background:ts.bg || 'rgba(57,255,20,0.1)', color:ts.text || '#33aa00', border:`1px solid ${ts.border||'rgba(57,255,20,0.25)'}` }}>
                  {ts.label === 'LOCK' ? '🔒 LOCK' : ts.label === '2' ? 'TIER 2' : 'PASS'}
                </span>
                {isWin && <span style={{ fontSize:10, fontWeight:800, color:'#33aa00' }}>✅ WIN</span>}
                {isLoss && <span style={{ fontSize:10, fontWeight:800, color:'#dd4444' }}>❌ LOSS</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Action button */}
      {!gameStarted && !isPostponed && isSubscribed && (() => {
        if (isGen) return (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:10 }}>
            <div style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(57,255,20,0.3)', borderTop:'2px solid #39FF14', animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:10, fontWeight:700, color:'#33aa00', letterSpacing:'0.06em' }}>ANALYZING {game.slot}…</span>
          </div>
        );
        if (hasRes) return (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:'rgba(248,255,248,0.7)', border:'1px solid rgba(195,240,195,0.5)', borderRadius:10 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#33aa00' }}>✓ {game.slot} — ANALYZED</span>
            <button onClick={e => { e.stopPropagation(); onGenerate(game, game.slot); }}
              style={{ fontSize:10, fontWeight:700, color:'#555', background:'rgba(255,255,255,0.7)', border:'1px solid rgba(0,0,0,0.07)', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
              <i className="ti ti-refresh" style={{ fontSize:12 }}/> Re-analyze
            </button>
          </div>
        );
        return (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', background:'rgba(248,255,248,0.7)', border:'1px solid rgba(195,240,195,0.5)', borderRadius:10, cursor:'pointer' }}
            onClick={() => onGenerate(game, game.slot)}>
            <i className="ti ti-sparkles" style={{ fontSize:13, color:'#33aa00' }}/>
            <span style={{ fontSize:10, fontWeight:700, color:'#33aa00', letterSpacing:'0.06em' }}>ANALYZE</span>
          </div>
        );
      })()}
      {!isSubscribed && !gameStarted && (
        <div onClick={() => onShowAuth?.('plans')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:10, cursor:'pointer' }}>
          <span style={{ fontSize:13 }}>🔒</span>
          <span style={{ fontSize:10, fontWeight:700, color:'#33aa00', letterSpacing:'0.08em' }}>SUBSCRIBE TO UNLOCK</span>
        </div>
      )}
      {gameStarted && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 0', background:'rgba(0,0,0,0.03)', border:'1px solid rgba(0,0,0,0.06)', borderRadius:10 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#aaa', letterSpacing:'0.08em' }}>
            {isLive ? '🔴 GAME IN PROGRESS — LOCKED' : '⬛ FINAL — ANALYSIS LOCKED'}
          </span>
        </div>
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
function TopPlayBanner({ topPlay, loading, results, games, pickHistory, isSubscribed, onShowAuth, onForceRefresh, isAdmin, watchlist, onToggleWatch, sport }) {
  const result = topPlay ? (results[`${topPlay.id}-${topPlay.slot}`] || results[`${topPlay.id}-PUBLIC`] || results[`${topPlay.id}-VEGAS`]) : null;
  const summary = result?.summary;
  const tier = summary ? (TIER_STYLES[summary.tier] || TIER_STYLES["3"]) : null;
  const histEntry = topPlay && pickHistory?.find(p => p.key === `${topPlay.id}-${topPlay.slot}`);
  const pickResult = histEntry?.result;

  if (loading) return (
    <div style={{ background:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.93)', borderRadius:16, backdropFilter:'blur(20px)', boxShadow:'0 8px 30px rgba(0,0,0,0.06)', padding:'16px 20px', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(57,255,20,0.3)', borderTop:'2px solid #39FF14', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
      <span style={{ fontSize:11, color:'#aaa' }}>Loading today's top play...</span>
    </div>
  );

  if (!topPlay || !summary) return null;

  return (
    <div style={{ background:'rgba(255,255,255,0.62)', border:'1px solid rgba(57,255,20,0.28)', borderRadius:16, backdropFilter:'blur(20px)', boxShadow:'0 10px 36px rgba(57,255,20,0.09)', padding:'14px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:9, fontWeight:800, color:'#111', background:'#39FF14', padding:'3px 10px', borderRadius:6, letterSpacing:'0.5px' }}>⭐ TOP PLAY</span>
          <span style={{ fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:6, background:topPlay.slot==='VEGAS'?'rgba(57,255,20,0.1)':'rgba(80,140,255,0.08)', color:topPlay.slot==='VEGAS'?'#2aa800':'#5588ee', border:topPlay.slot==='VEGAS'?'1px solid rgba(57,255,20,0.25)':'1px solid rgba(80,140,255,0.2)' }}>
            {topPlay.slot}
          </span>
          {tier && <span style={{ fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:6, background:'rgba(57,255,20,0.1)', color:'#2aa800', border:'1px solid rgba(57,255,20,0.25)' }}>Tier {summary.tier}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'#aaa' }}>{topPlay.time}</span>
          <span onClick={e => { e.stopPropagation(); onToggleWatch?.(topPlay.id); }} style={{ fontSize:16, color:watchlist?.includes(topPlay.id)?'#39FF14':'#ccc', cursor:'pointer' }}>
            {watchlist?.includes(topPlay.id)?'★':'☆'}
          </span>
          {isAdmin && onForceRefresh && (
            <button onClick={onForceRefresh} style={{ fontSize:10, fontWeight:700, color:'#555', background:'rgba(255,255,255,0.7)', border:'1px solid rgba(0,0,0,0.07)', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
              <i className="ti ti-refresh" style={{ fontSize:12 }}/> Re-analyze
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:12, color:'#aaa', marginBottom:4 }}>{topPlay.away} @ {topPlay.home}</div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ background:'rgba(255,255,255,0.7)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:10, padding:'10px 14px' }}>
            <div style={{ fontSize:9, color:'#33aa00', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>THE PLAY</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#111' }}>{summary.pick}</div>
            <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{summary.betType}</div>
          </div>
          {pickResult && (
            <div style={{ fontSize:14, fontWeight:800, color:pickResult==='win'?'#33aa00':'#dd4444' }}>
              {pickResult==='win'?'✅ WIN':'❌ LOSS'}
            </div>
          )}
        </div>
        {summary.verdict && (
          <div style={{ marginTop:10, fontSize:11, color:'#666', lineHeight:1.6 }}>{summary.verdict.length > 120 ? summary.verdict.slice(0,117)+'...' : summary.verdict}</div>
        )}
      </div>
    </div>
  );
}


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


// ── SUBSCRIBE LOCK PLACEHOLDER ────────────────────────────────────────────────
function SubscribeLock({ feature, onShowAuth }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center' }}>
      <div style={{ fontSize:36,marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:18,fontWeight:800,color:'#f1f5f9',marginBottom:8 }}>{feature}</div>
      <div style={{ fontSize:13,color:'#475569',marginBottom:24,lineHeight:1.6 }}>Subscribe to unlock {feature} and all Vegas Vault AI features.</div>
      <div onClick={()=>onShowAuth&&onShowAuth('plans')} style={{ fontSize:10,fontWeight:700,color:'#3b82f6',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,padding:'10px 24px',letterSpacing:'0.08em',cursor:'pointer' }}>SUBSCRIBE TO UNLOCK</div>
    </div>
  );
}

// ── VAULT LOCKS VIEW ──────────────────────────────────────────────────────────
function VaultLocksView({ results, games, finalized }) {
  const locks = Object.entries(results)
    .filter(([key, val]) => {
      const tier = val?.summary?.tier || val?.tier;
      const label = val?.summary?.tierLabel || val?.tierLabel || '';
      return tier === '1' || label === 'LOCK';
    })
    .map(([key, val]) => {
      const parts = key.split('-');
      const slot = parts[parts.length - 1];
      const gameId = parts.slice(0, -1).join('-');
      const game = games.find(g => String(g.id) === gameId);
      const summary = val?.summary || val;
      return { key, slot, game, summary };
    });

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em',marginBottom:4 }}>🔒 Vault Locks</h1>
        <p style={{ fontSize:12,color:'#3a4a5e' }}>{locks.length} Tier 1 lock{locks.length !== 1 ? 's' : ''} identified today</p>
      </div>

      {locks.length === 0 ? (
        <div style={{ textAlign:'center',padding:'60px 20px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize:32,marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:14,fontWeight:600,color:'#2d3a4a',marginBottom:6 }}>No locks generated yet</div>
          <div style={{ fontSize:12,color:'#1e2a3a' }}>Generate game analyses — Tier 1 picks appear here automatically.</div>
        </div>
      ) : locks.map((lock) => (
        <div key={lock.key} style={{ background:'rgba(74,222,128,0.05)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:12,padding:'16px',marginBottom:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
            <span style={{ fontSize:16 }}>🔒</span>
            <span style={{ fontSize:9,fontWeight:700,color:lock.slot==='VEGAS'?'#f87171':'#60a5fa',background:lock.slot==='VEGAS'?'rgba(248,113,113,0.1)':'rgba(96,165,250,0.1)',borderRadius:4,padding:'1px 6px' }}>{lock.slot}</span>
            {lock.game && <span style={{ fontSize:12,fontWeight:700,color:'#f1f5f9' }}>{lock.game.away?.split(' ').pop()} @ {lock.game.home?.split(' ').pop()}</span>}
            {lock.game && <span style={{ fontSize:10,color:'#3a4a5e' }}>{lock.game.time}</span>}
          </div>
          <div style={{ fontSize:15,fontWeight:800,color:'#4ade80',marginBottom:4 }}>
            {lock.summary?.pick} {lock.summary?.betType}
          </div>
          <div style={{ fontSize:11,color:'#94a3b8',lineHeight:1.5 }}>{lock.summary?.verdict}</div>
          {finalized?.[lock.key] && <span style={{ fontSize:9,color:'#475569',background:'rgba(255,255,255,0.04)',borderRadius:4,padding:'2px 6px',marginTop:6,display:'inline-block' }}>FINALIZED</span>}
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
  const { useState: useLocalState, useEffect: useLocalEffect } = React;
  const [props, setProps] = useLocalState([]);
  const [openingLines, setOpeningLines] = useLocalState({});
  const [propResults, setPropResults] = useLocalState({});
  const [generating, setGenerating] = useLocalState(null);
  const [activeGame, setActiveGame] = useLocalState(null);
  const [activeProp, setActiveProp] = useLocalState(null);
  const [sportFilter, setSportFilter] = useLocalState('ALL');
  const [loadingProps, setLoadingProps] = useLocalState(false);

  const TIER_COLORS = { '1': '#f59e0b', '2': '#fbbf24', '3': '#475569' };
  const TIER_BG    = { '1': 'rgba(245,158,11,0.12)', '2': 'rgba(251,191,36,0.08)', '3': 'rgba(71,85,105,0.12)' };
  const TIER_BORDER= { '1': 'rgba(245,158,11,0.35)', '2': 'rgba(251,191,36,0.25)', '3': 'rgba(71,85,105,0.25)' };
  const TIER_LABELS = { '1': 'LOCK', '2': 'TIER 2', '3': 'PASS' };

  const SPORT_ACCENT = { MLB:'#3b82f6', NBA:'#f97316', NFL:'#22c55e', Tennis:'#a78bfa', WNBA:'#f472b6', ALL:'#64748b' };

  // Fetch props from Odds API for today's games
  // Subscription gate — after all hooks
  const _notSubscribed = !isSubscribed;

  useLocalEffect(() => {
    if (!games.length) return;
    setLoadingProps(true);
    const sports = [...new Set(games.map(g => g.sport))];
    Promise.all(sports.map(sport =>
      fetch(`/api/props?sport=${sport}`).then(r => r.json()).catch(() => ({ props: [] }))
    )).then(results => {
      const all = results.flatMap(r => r.props || []);
      const matched = all.filter(p => {
        return games.some(g =>
          (g.away?.toLowerCase().includes(p.away?.split(' ').pop()?.toLowerCase()) ||
           g.home?.toLowerCase().includes(p.home?.split(' ').pop()?.toLowerCase()))
        );
      });
      setProps(matched);
      // Store opening lines (only set once — never overwrite)
      setOpeningLines(prev => {
        const updated = { ...prev };
        matched.forEach(p => {
          const key = `${p.playerName}-${p.propType}`;
          if (!updated[key]) {
            updated[key] = { line: p.line, overPrice: p.overPrice, underPrice: p.underPrice, time: new Date().toISOString() };
          }
        });
        return updated;
      });
      setLoadingProps(false);
    });
  }, [games]);

  const filteredGames = sportFilter === 'ALL' ? games : games.filter(g => g.sport === sportFilter);
  const sports = ['ALL', ...new Set(games.map(g => g.sport))];

  async function analyzeProp(propData) {
    const key = `${propData.playerName}-${propData.propType}-${propData.line}`;
    setGenerating(key);
    try {
      const res = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propData),
      });
      const result = await res.json();
      setPropResults(prev => ({ ...prev, [key]: result }));
      setActiveProp({ ...propData, key });
    } catch (err) {
      console.error('Props analyze error:', err);
    } finally {
      setGenerating(null);
    }
  }



  const activeResult = activeProp ? propResults[activeProp.key] : null;

  const accentColor = SPORT_ACCENT[sportFilter] || '#3b82f6';

  return (
    <div style={{ paddingBottom:40 }}>

      {/* ── Subscription lock ── */}
      {!isSubscribed ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center' }}>
          <div style={{ fontSize:36,marginBottom:16 }}>🔒</div>
          <div style={{ fontSize:18,fontWeight:800,color:'#f1f5f9',marginBottom:8 }}>Props AI</div>
          <div style={{ fontSize:13,color:'#475569',marginBottom:24,lineHeight:1.6 }}>Subscribe to unlock player props analysis.</div>
          <div style={{ fontSize:10,fontWeight:700,color:'#3b82f6',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,padding:'10px 24px',letterSpacing:'0.08em' }}>SUBSCRIBE TO UNLOCK</div>
        </div>
      ) : null}

      {isSubscribed && <>

      {/* ── Header ── */}
      <div style={{ marginBottom:16,paddingBottom:14,borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(59,130,246,0.2))',border:'1px solid rgba(139,92,246,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>◇</div>
          <div>
            <h1 style={{ fontSize:20,fontWeight:800,color:'#f1f5f9',letterSpacing:'-0.03em',margin:0,lineHeight:1 }}>Props AI</h1>
            <p style={{ fontSize:11,color:'#475569',margin:0,marginTop:2 }}>Player props · Powered by DraftKings</p>
          </div>
        </div>
      </div>

      {/* ── Sport filter pills ── */}
      <div style={{ display:'flex',gap:5,marginBottom:16,flexWrap:'wrap' }}>
        {sports.map(s => {
          const ac = SPORT_ACCENT[s] || '#64748b';
          const active = sportFilter === s;
          return (
            <button key={s} onClick={() => setSportFilter(s)} style={{ fontSize:9,fontWeight:800,padding:'5px 11px',borderRadius:20,border:`1px solid ${active ? ac : 'rgba(255,255,255,0.07)'}`,background:active ? `${ac}22` : 'transparent',color:active ? ac : '#475569',cursor:'pointer',letterSpacing:'0.08em' }}>
              {s}
            </button>
          );
        })}
      </div>

      {/* ── Loading shimmer ── */}
      {loadingProps && (
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:200,borderRadius:16,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',overflow:'hidden',position:'relative' }}>
              <div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)',animation:'shimmer 1.5s infinite' }}/>
            </div>
          ))}
          <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
        </div>
      )}

      {/* ── Player prop cards ── */}
      {!loadingProps && filteredGames.map(game => {
        const gameProps = props.filter(p =>
          p.away?.toLowerCase().includes(game.away?.split(' ').pop()?.toLowerCase()) ||
          p.home?.toLowerCase().includes(game.home?.split(' ').pop()?.toLowerCase())
        );
        const byPlayer = {};
        gameProps.forEach(p => {
          const k = p.playerName || 'Unknown';
          if (!byPlayer[k]) byPlayer[k] = [];
          byPlayer[k].push(p);
        });
        const sportColor = SPORT_ACCENT[game.sport] || '#3b82f6';
        if (!Object.keys(byPlayer).length) return null;

        return Object.entries(byPlayer).slice(0,12).map(([playerName, playerProps]) => {
          const initials = playerName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const propTypes = {};
          playerProps.forEach(p => {
            if (!propTypes[p.propType]) propTypes[p.propType] = { over:null, under:null, line:p.line };
            // Use DraftKings prices directly from API
            if (p.overPrice)  propTypes[p.propType].over  = p.overPrice;
            if (p.underPrice) propTypes[p.propType].under = p.underPrice;
            // Also handle side-based format as fallback
            if (p.side === 'Over')  propTypes[p.propType].over  = p.price || p.overPrice;
            if (p.side === 'Under') propTypes[p.propType].under = p.price || p.underPrice;
          });

          return (
            <div key={`${game.id}-${playerName}`} style={{ background:'rgba(10,15,30,0.95)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,marginBottom:16,overflow:'hidden' }}>

              {/* ── Player header (dark gradient like PrizePicks) ── */}
              <div style={{ background:'linear-gradient(135deg,rgba(15,25,50,0.95),rgba(20,10,40,0.9))',padding:'16px 16px 14px',position:'relative',borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:11,color:'#64748b',fontWeight:600,marginBottom:2 }}>{game.sport} · {game.away?.split(' ').pop()} @ {game.home?.split(' ').pop()}</div>
                    <div style={{ fontSize:13,color:'#94a3b8',fontWeight:500 }}>{playerProps[0]?.playerTeam || ''}</div>
                    <div style={{ fontSize:26,fontWeight:900,color:'#f8fafc',letterSpacing:'-0.02em',lineHeight:1.1 }}>{playerName.split(' ')[0]}</div>
                    <div style={{ fontSize:26,fontWeight:900,color:'#f8fafc',letterSpacing:'-0.02em',lineHeight:1.1 }}>{playerName.split(' ').slice(1).join(' ')}</div>
                  </div>
                  {/* Avatar circle */}
                  <div style={{ width:64,height:64,borderRadius:12,background:`linear-gradient(135deg,${sportColor}40,${sportColor}20)`,border:`2px solid ${sportColor}50`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <span style={{ fontSize:20,fontWeight:900,color:sportColor }}>{initials}</span>
                  </div>
                </div>

                {/* Game matchup bar */}
                <div style={{ marginTop:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ width:28,height:28,borderRadius:6,background:`${sportColor}25`,border:`1px solid ${sportColor}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:sportColor }}>{game.away?.split(' ').pop()?.slice(0,3).toUpperCase()}</div>
                    <span style={{ fontSize:11,fontWeight:700,color:'#94a3b8' }}>{game.away?.split(' ').pop()}</span>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#475569',fontWeight:600 }}>Today · {game.time}</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:11,fontWeight:700,color:'#94a3b8' }}>{game.home?.split(' ').pop()}</span>
                    <div style={{ width:28,height:28,borderRadius:6,background:`${sportColor}25`,border:`1px solid ${sportColor}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:sportColor }}>{game.home?.split(' ').pop()?.slice(0,3).toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* ── Individual prop rows ── */}
              {Object.entries(propTypes).map(([pType, pData]) => {
                const propKey = `${playerName}-${pType}-${pData.line}`;
                const result = propResults[propKey];
                const isGen = generating === propKey;
                const opKey = `${playerName}-${pType}`;
                const opening = openingLines[opKey];
                const moved = opening && opening.line !== pData.line;
                const tier = result?.summary?.tier;
                const pick = result?.summary?.pick?.toLowerCase();
                const isOver = pick?.includes('over') || pick?.includes('more');
                const isUnder = pick?.includes('under') || pick?.includes('less');
                const tierColor = tier === '1' ? '#f59e0b' : tier === '2' ? '#3b82f6' : '#64748b';
                const verdict = result?.summary?.verdict || '';
                const summary = verdict.length > 100 ? verdict.slice(0,97)+'...' : verdict;

                const doAnalyze = () => {
                  const op = openingLines[opKey];
                  const lineMoved = op && op.line !== pData.line ? `Moved from ${op.line} to ${pData.line} (${pData.line > op.line ? 'UP' : 'DOWN'})` : 'No movement';
                  analyzeProp({
                    sport:game.sport, away:game.away, home:game.home, time:game.time,
                    playerName, playerTeam:playerProps[0]?.playerTeam||'',
                    propType:pType, line:pData.line,
                    openingLine:op?.line||'Unknown', lineMovement:lineMoved, priceMovement:'N/A',
                    overPrice:pData.over?(pData.over>0?`+${pData.over}`:String(pData.over)):'-110',
                    underPrice:pData.under?(pData.under>0?`+${pData.under}`:String(pData.under)):'-110',
                    opponent:game.home,
                  });
                };

                return (
                  <div key={pType} style={{ padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:result?'pointer':'default' }}
                    onClick={() => result && setActiveProp({ playerName, propType:pType, line:pData.line, key:propKey, sport:game.sport, away:game.away, home:game.home })}>

                    {/* Line + prop type row */}
                    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:10 }}>
                      {/* Direction indicator */}
                      <div style={{ fontSize:16,color:isOver?'#22c55e':isUnder?'#f87171':'#334155',fontWeight:900,width:16,textAlign:'center' }}>
                        {isOver ? '↑' : isUnder ? '↓' : '·'}
                      </div>
                      {/* Big line number */}
                      <div style={{ fontSize:28,fontWeight:900,color:'#f8fafc',lineHeight:1,minWidth:60 }}>{pData.line}</div>
                      <div>
                        <div style={{ fontSize:12,color:'#94a3b8',fontWeight:700 }}>{pType}</div>
                        {moved && <div style={{ fontSize:9,color:'#f59e0b',fontWeight:700,marginTop:1 }}>{opening.line} → {pData.line}</div>}
                      </div>
                      <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:6 }}>
                        {tier && (
                          <span style={{ fontSize:8,fontWeight:800,color:tierColor,background:`${tierColor}18`,border:`1px solid ${tierColor}30`,padding:'2px 7px',borderRadius:4,letterSpacing:'0.06em' }}>
                            {tier==='1'?'🔒 LOCK':tier==='2'?'TIER 2':'PASS'}
                          </span>
                        )}
                        {/* Analyze button */}
                        {!result && (
                          <button onClick={e => { e.stopPropagation(); doAnalyze(); }} disabled={isGen}
                            style={{ padding:'6px 14px',borderRadius:8,border:'1px solid rgba(59,130,246,0.4)',background:'rgba(59,130,246,0.1)',color:'#60a5fa',fontSize:10,fontWeight:700,cursor:isGen?'wait':'pointer',letterSpacing:'0.05em',fontFamily:'inherit',opacity:isGen?0.6:1 }}>
                            {isGen ? '···' : 'Analyze'}
                          </button>
                        )}
                        {result && (
                          <button onClick={e => { e.stopPropagation(); doAnalyze(); }} disabled={isGen}
                            style={{ padding:'6px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#475569',fontSize:10,fontWeight:700,cursor:isGen?'wait':'pointer',letterSpacing:'0.05em',fontFamily:'inherit' }}>
                            {isGen ? '···' : '↺'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Prices row */}
                    <div style={{ display:'flex',gap:10,marginBottom:summary?10:0 }}>
                      <div style={{ flex:1,padding:'6px 10px',borderRadius:8,background:isOver&&result?'rgba(34,197,94,0.1)':'rgba(34,197,94,0.04)',border:`1px solid ${isOver&&result?'rgba(34,197,94,0.4)':'rgba(34,197,94,0.15)'}`,textAlign:'center' }}>
                        <div style={{ fontSize:9,color:'#4ade80',fontWeight:700,letterSpacing:'0.05em' }}>OVER</div>
                        <div style={{ fontSize:11,color:'#86efac',fontWeight:600,marginTop:1 }}>{pData.over?(pData.over>0?'+'+pData.over:pData.over):'-110'}</div>
                      </div>
                      <div style={{ flex:1,padding:'6px 10px',borderRadius:8,background:isUnder&&result?'rgba(248,113,113,0.1)':'rgba(248,113,113,0.04)',border:`1px solid ${isUnder&&result?'rgba(248,113,113,0.4)':'rgba(248,113,113,0.15)'}`,textAlign:'center' }}>
                        <div style={{ fontSize:9,color:'#f87171',fontWeight:700,letterSpacing:'0.05em' }}>UNDER</div>
                        <div style={{ fontSize:11,color:'#fca5a5',fontWeight:600,marginTop:1 }}>{pData.under?(pData.under>0?'+'+pData.under:pData.under):'-110'}</div>
                      </div>
                    </div>

                    {/* AI summary */}
                    {summary && (
                      <div style={{ marginTop:10,padding:'8px 10px',background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize:9,fontWeight:700,color:tierColor,letterSpacing:'0.06em',marginRight:6 }}>AI:</span>
                        <span style={{ fontSize:11,color:'#64748b',lineHeight:1.5 }}>{summary}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        });
      })}

      {/* ── Result Modal ── */}
      {activeProp && activeResult && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,10,0.88)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center' }}
          onClick={e => { if (e.target===e.currentTarget) setActiveProp(null); }}>
          <div style={{ background:'#080f1e',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',paddingBottom:40,WebkitOverflowScrolling:'touch' }}>
            <div style={{ padding:'14px 20px 0',textAlign:'center' }}>
              <div style={{ width:40,height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,display:'inline-block' }}/>
            </div>
            <div style={{ padding:'14px 20px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:9,fontWeight:700,letterSpacing:'0.12em',color:'#475569',marginBottom:6 }}>{activeResult.sport} · {activeResult.game}</div>
              <div style={{ fontSize:24,fontWeight:800,color:'#f8fafc',letterSpacing:'-0.02em',marginBottom:2 }}>{activeProp.playerName}</div>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                <span style={{ fontSize:11,color:'#64748b' }}>{activeProp.propType}</span>
                <span style={{ width:3,height:3,borderRadius:'50%',background:'#334155',display:'inline-block' }}/>
                <span style={{ fontSize:11,color:'#64748b' }}>Line: <strong style={{ color:'#94a3b8' }}>{activeProp.line}</strong></span>
              </div>
            </div>
            <div style={{ margin:'14px 16px 8px',background:'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.06))',border:'1px solid rgba(59,130,246,0.25)',borderRadius:14,padding:'14px 16px' }}>
              <div style={{ fontSize:8,fontWeight:800,letterSpacing:'0.12em',color:'#3b82f6',marginBottom:8 }}>PRIMARY PLAY</div>
              <div style={{ fontSize:28,fontWeight:900,color:'#f8fafc',marginBottom:6 }}>{activeResult.summary?.pick} {activeResult.summary?.line}</div>
              <p style={{ fontSize:12,color:'#94a3b8',lineHeight:1.65,margin:0 }}>{activeResult.summary?.verdict}</p>
            </div>
            {activeResult.analysis && (
              <div style={{ margin:'0 16px 8px' }}>
                {[['Prop Line Audit',activeResult.analysis.propLineAudit],['Player Baseline',activeResult.analysis.playerBaseline],['Matchup',activeResult.analysis.matchupContext],['Situational',activeResult.analysis.situationalFactors],['vs Opponent',activeResult.analysis.historicalVsOpponent],['Edge Calc',activeResult.analysis.discrepancyCalc]].filter(([,v])=>v).map(([label,value])=>(
                  <div key={label} style={{ marginBottom:6,padding:'10px 12px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:10 }}>
                    <div style={{ fontSize:9,fontWeight:700,color:'#334155',marginBottom:4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize:12,color:'#64748b',lineHeight:1.65 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding:'0 16px' }}>
              <button onClick={() => setActiveProp(null)} style={{ width:'100%',padding:'13px',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.03)',color:'#64748b',fontSize:13,fontWeight:600,cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
      </>}
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
      // Don't pre-load from localStorage — will load from Supabase per user
      return {};
    } catch { return {}; }
  });
  const [finalized, setFinalized] = useState(() => {
    try {
      // Don't pre-load from localStorage — will load from Supabase per user
      return {};
    } catch { return {}; }
  });
  const [preAnalyzing, setPreAnalyzing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOddsMovement, setShowOddsMovement] = useState(false);
  const [topPlay, setTopPlay] = useState(null);
  const [topPlayLoading, setTopPlayLoading] = useState(false);
  const [sportTopPlays, setSportTopPlays] = useState({ MLB: null, NBA: null, NFL: null });
  const [sportTopPlayDone, setSportTopPlayDone] = useState({ MLB: false, NBA: false, NFL: false });
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
          else {
            // Check Supabase for active subscription
            try {
              const { data: subData } = await _supabase.from('subscriptions').select('status,current_period_end').eq('email', session.user.email).single();
              if (subData?.status === 'active') {
                const periodEnd = new Date(subData.current_period_end);
                if (periodEnd > new Date()) {
                  setIsSubscribed(true);
                  localStorage.setItem('vv_subscribed', '1');
                }
              }
            } catch {}
          }
          if (res) setResults(res);
          if (fin) setFinalized(fin);
          if (hist) setPickHistory(hist);
        }
      });
      const { data: { subscription } } = sb.auth.onAuthStateChange(async (_e, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          // If modal is open after signup/login, advance to plans
          setAuthMode(prev => (prev === 'login' || prev === 'signup') ? 'plans' : prev);
          if (session.user.email === ADMIN_EMAIL) { localStorage.setItem('vv_admin','1'); setIsSubscribed(true); }
          else {
            // Always check Supabase for live subscription status
            try {
              const { data: subData } = await _supabase.from('subscriptions').select('status,current_period_end').eq('email', session.user.email).single();
              if (subData?.status === 'active' && new Date(subData.current_period_end) > new Date()) {
                setIsSubscribed(true); localStorage.setItem('vv_subscribed', '1');
              } else {
                setIsSubscribed(false); localStorage.removeItem('vv_subscribed');
              }
            } catch {
              const sub = typeof window !== 'undefined' && localStorage.getItem('vv_subscribed');
              if (sub) setIsSubscribed(true);
            }
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
    setAuthUser(null); localStorage.removeItem('vv_admin'); localStorage.removeItem('vv_subscribed'); localStorage.removeItem('vv_results'); localStorage.removeItem('vv_finalized'); localStorage.removeItem('vv_watchlist'); setIsSubscribed(false); setResults({}); setFinalized({}); setWatchlist([]); setPickHistory([]);
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
      // Don't pre-load from localStorage — will load from Supabase per user
      return [];
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

  // ── PER-SPORT TOP PLAY — runs after all games in sport are analyzed ────────────
  useEffect(() => {
    const SPORTS = ['MLB', 'NBA', 'NFL'];
    SPORTS.forEach(sport => {
      if (sportTopPlayDone[sport]) return;
      const sportGames = games.filter(g => g.sport === sport);
      if (!sportGames.length) return;

      // Check if all games in this sport have been analyzed
      const allAnalyzed = sportGames.every(g => {
        const slots = sport === 'WNBA' ? ['WNBA'] : ['PUBLIC', 'VEGAS'];
        return slots.some(slot => results[`${g.id}-${slot}`]?.summary);
      });
      if (!allAnalyzed) return;

      // Find the best pick across all analyzed games in this sport
      let bestPick = null, bestScore = -1;
      sportGames.forEach(g => {
        const slots = sport === 'WNBA' ? ['WNBA'] : ['PUBLIC', 'VEGAS'];
        slots.forEach(slot => {
          const r = results[`${g.id}-${slot}`];
          if (!r?.summary || r.summary.tierLabel === 'PASS') return;
          const tierScore = r.summary.tier === '1' ? 3 : r.summary.tier === '2' ? 2 : 1;
          const confScore = r.summary.confidence === 'HIGH' ? 2 : r.summary.confidence === 'MEDIUM' ? 1 : 0;
          const score = tierScore * 10 + confScore;
          if (score > bestScore) {
            bestScore = score;
            bestPick = { game: g, slot, result: r, sport };
          }
        });
      });

      if (bestPick) {
        setSportTopPlays(prev => ({ ...prev, [sport]: bestPick }));
        setSportTopPlayDone(prev => ({ ...prev, [sport]: true }));
      }
    });
  }, [games, results, sportTopPlayDone]);

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

        const slots = ['PUBLIC', 'VEGAS'];
        for (const slot of slots) {
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
      // Only process games the user has watchlisted
      if (!watchlist.includes(game.id)) continue;

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

  // ── AUTO-REANALYSIS: lineup confirmed or injury update ───────────────────────
  useEffect(() => {
    if (!games || !results) return;

    const checkLineupAndInjury = async () => {
      for (const game of games) {
        if (!['MLB','NBA','NFL'].includes(game.sport)) continue;
        const slots = ['PUBLIC', 'VEGAS'];
        const hasResult = slots.some(slot => results[`${game.id}-${slot}`]?.summary);
        if (!hasResult) continue;

        const gameKey = `${game.id}`;
        const currentLineup = `${game.awayLineup||''}|${game.homeLineup||''}`;
        const lastLineup = lastLineupRef.current[gameKey];
        const lineupJustConfirmed = lastLineup !== undefined &&
          (lastLineup.length < 80) &&
          currentLineup.length > 100;

        const currentInjury = game.injuries || '';
        const lastInjury = lastInjuryRef.current[gameKey];
        const injuryChanged = lastInjury !== undefined &&
          lastInjury !== currentInjury &&
          currentInjury.length > (lastInjury.length || 0);

        lastLineupRef.current[gameKey] = currentLineup;
        lastInjuryRef.current[gameKey] = currentInjury;

        if (!lineupJustConfirmed && !injuryChanged) continue;

        const reason = lineupJustConfirmed ? 'lineup confirmed' : 'injury update';
        console.log(`Auto-reanalyzing ${game.away} @ ${game.home} — ${reason}`);

        for (const slot of slots) {
          const key = `${game.id}-${slot}`;
          if (!results[key]?.summary) continue;
          try {
            const fresh = await generatePlay({ ...game, slot });
            if (fresh?.summary) {
              setResults(prev => ({ ...prev, [key]: fresh }));
              if (fresh.summary.readyToFinalize === true) {
                setFinalized(prev => ({ ...prev, [key]: true }));
              }
            }
          } catch(e) { console.error('Auto-reanalysis error:', e.message); }
        }
      }
    };

    checkLineupAndInjury();
    const interval = setInterval(checkLineupAndInjury, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [games]);

  // ── FINALIZATION: re-analyze when lines move, mark FINAL ─────────────────────
  const lastLineRef = useRef({});
  const lastLineupRef = useRef({});  // tracks lineup state per game
  const lastInjuryRef = useRef({});  // tracks injury state per game

  // ── HANDLE STRIPE SUCCESS REDIRECT ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      // Stripe redirected back — re-check subscription status
      _supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return;
        // Poll until webhook fires (up to 5 seconds)
        for (let i = 0; i < 5; i++) {
          const { data: subData } = await _supabase.from('subscriptions').select('status,current_period_end').eq('email', session.user.email).single();
          if (subData?.status === 'active' && new Date(subData.current_period_end) > new Date()) {
            setIsSubscribed(true); localStorage.setItem('vv_subscribed', '1');
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // ── LOAD STORED ANALYSES (background-analyzed games) ─────────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    // Don't load shared auto-analyze results — each user gets their own analyses
    // Results are loaded per-user from Supabase on login
  }, [selectedDate]);

  // ── SERVICE WORKER + PUSH NOTIFICATIONS ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      // Subscribe to Web Push for background notifications (app closed)
      if (!('PushManager' in window)) return;
      const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!VAPID_PUBLIC) return;
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
        }
        // Save subscription to server
        const user = (await sb.auth.getUser())?.data?.user;
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            userId: user?.id || null,
            email: user?.email || null,
          }),
        });
      } catch {}
    }).catch(() => {});
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

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
      // Results cleared for this user only via syncDelete
    } catch {}
  }

  function toggleWatch(gameId) {
    setWatchlist(prev => {
      const updated = prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId];
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
                  // Let AI decide finalization via readyToFinalize
                  const shouldFinalize = fresh.summary.readyToFinalize === true;
                  const finalResult = shouldFinalize ? { ...fresh, finalized: true, finalizedAt: new Date().toISOString() } : fresh;
                  setResults(prev => ({ ...prev, [key]: finalResult }));
                  if (shouldFinalize) {
                    setFinalized(prev => ({ ...prev, [key]: true }));
                    const pick = fresh.summary?.pick || 'Pick';
                    const tier = fresh.summary?.tierLabel || '';
                    if (isWatchlisted) {
                      sendNotification(
                        `🔒 ${tier} FINALIZED — ${game.away} @ ${game.home}`,
                        `${slot} slot: ${pick} | Line moved ${Math.abs(current - last)} pts`
                      );
                    }
                  }
                }
              } catch {}
            }
          }
          lastLineRef.current[key] = currentML;

          // Finalization controlled by AI via readyToFinalize — no auto-finalizing
        }
      }
    }, 5 * 60 * 1000); // check every 5 minutes

    return () => clearInterval(checkInterval);
  }, [games, results, finalized, liveScores, watchlist]);

  // ── PERSIST RESULTS TO LOCALSTORAGE ──────────────────────────────────────────
  useEffect(() => {
    if (authUser?.id) syncSave(authUser.id, 'results', results); // scoped to this user only — all dates
  }, [results]);

  // ── CROSS-DEVICE SYNC: poll for results updated from other devices ──────────
  useEffect(() => {
    if (!authUser?.id) return;
    const pollResults = async () => {
      const remote = await syncLoad(authUser.id, 'results');
      if (remote) {
        setResults(prev => {
          // Merge — remote wins for any key, keeps local-only keys too
          const merged = { ...prev, ...remote };
          // Only update if something actually changed to avoid extra renders
          if (JSON.stringify(merged) !== JSON.stringify(prev)) return merged;
          return prev;
        });
      }
    };
    const interval = setInterval(pollResults, 30 * 1000); // every 30 seconds
    return () => clearInterval(interval);
  }, [authUser?.id]);

  useEffect(() => {
    if (authUser?.id) syncSave(authUser.id, 'finalized', finalized);
  }, [finalized]);

  // ── CROSS-DEVICE SYNC: poll for finalized updates from other devices ────────
  useEffect(() => {
    if (!authUser?.id) return;
    const pollFinalized = async () => {
      const remote = await syncLoad(authUser.id, 'finalized');
      if (remote) {
        setFinalized(prev => {
          const merged = { ...prev, ...remote };
          if (JSON.stringify(merged) !== JSON.stringify(prev)) return merged;
          return prev;
        });
      }
    };
    const interval = setInterval(pollFinalized, 30 * 1000);
    return () => clearInterval(interval);
  }, [authUser?.id]);

  // Persist pick history
  useEffect(() => {
    if (authUser?.id) syncSave(authUser.id, 'pick_history', pickHistory); // user-scoped
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
          // Analysis complete notification removed — too noisy, clients only want watchlist alerts
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
      fetch(`/api/lines?date=${selectedDate}&sport=mlb&t=${Date.now()}`)
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
              dkAwayML:      mv.dkAwayML || game.dkAwayML || null,
              dkHomeML:      mv.dkHomeML || game.dkHomeML || null,
              dkSpread: mv.dkSpread || (game.dkSpread && game.dkSpread !== 'N/A' ? game.dkSpread : null),
              dkTotal:  mv.dkTotal  || (game.dkTotal  && game.dkTotal  !== 'N/A' ? game.dkTotal  : null),
              awaySpreadPrice: mv.awaySpreadPrice || game.awaySpreadPrice || '-110',
              homeSpreadPrice: mv.homeSpreadPrice || game.homeSpreadPrice || '-110',
              overPrice:  mv.overPrice  || game.overPrice  || '-110',
              underPrice: mv.underPrice || game.underPrice || '-110',
              // Live price updates from Sharp API
              awayML:        fmtN(mv.currentAwayML) || mv.awayML || (game.awayML !== 'N/A' ? game.awayML : null),
              homeML:        fmtN(mv.currentHomeML) || mv.homeML || (game.homeML !== 'N/A' ? game.homeML : null),
              spread:        mv.spread || (game.spread !== 'N/A' ? game.spread : null),
              total:         mv.total  || (game.total  !== 'N/A' ? game.total  : null),
              publicBettingPct: mv.publicBettingPct ?? game.publicBettingPct,
              sharpMoneyPct:    mv.sharpMoneyPct    ?? game.sharpMoneyPct,
            };
          }));
        })
        .catch(() => {}); // fail silently — don't break the UI
    }

    // Initial fetch after games load
    fetchLines(); // run immediately on load
    const initTimeout = setTimeout(fetchLines, 3000);
    const linesInterval = setInterval(fetchLines, 90 * 1000); // every 90 seconds
    return () => { clearTimeout(initTimeout); clearInterval(linesInterval); };
  }, [selectedDate]);

  const generated = Object.keys(results).length;
  const FILTERS = ["ALL","MLB","NBA","NFL"];
  const filteredGames = games.filter(g=>{
    if(filter==="MLB")return g.sport==="MLB";
    if(filter==="NBA")return g.sport==="NBA";
    if(filter==="NFL")return g.sport==="NFL";
    if(filter==="WNBA")return false;
    return g.sport !== 'WNBA';
  });
  const wnbaFilteredGames = games.filter(g => g.sport === 'WNBA').sort((a,b) => new Date(a.rawTime||a.time) - new Date(b.rawTime||b.time));

  async function handleGenerate(game,slot){
    if (!isSubscribed) { setShowAuth(true); setAuthMode('login'); setAuthError(''); return; }
    // Lock play once game has started — no changing plays during a game
    const liveEntry = liveScores?.[game.id];
    const gameIsLive = liveEntry?.status === 'Live' || liveEntry?.detailedState === 'In Progress';
    const gameIsFinal = liveEntry?.isFinal || liveEntry?.detailedState === 'Final' || liveEntry?.detailedState === 'Game Over';
    if (gameIsLive || gameIsFinal) return;
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
    // Results are preserved per user in Supabase — analyzed plays stay locked regardless of date
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

  // Map current nav state to new shell section keys
  const shellSection = (() => {
    if (showHistory) return "history";
    if (showOddsMovement) return "odds";
    const nav = (activeNav || "").toUpperCase();
    if (nav === "SHARP MONEY") return "sharp";
    if (nav === "PROPS AI") return "props";
    if (nav === "VAULT LOCKS") return "vault";
    if (nav === "AI ANALYZER") return "analyzer";
    return "dashboard";
  })();

  const shellNavigate = (key) => {
    if (key === "history")  { setShowHistory(true); return; }
    if (key === "odds")     { setShowOddsMovement(true); return; }
    if (key === "settings") { window.location.href = "/settings"; return; }
    const labelMap = {
      dashboard: "DASHBOARD", slate: "DASHBOARD",
      analyzer:  "AI ANALYZER", vault: "VAULT LOCKS",
      sharp:     "SHARP MONEY", props: "PROPS AI",
    };
    setActiveNav(labelMap[key] || "DASHBOARD");
    setActiveTab("DASHBOARD");
    setShowHistory(false);
    setShowOddsMovement(false);
  };

  const shellUserName = authUser?.user_metadata?.full_name || authUser?.email?.split("@")[0] || "Member";
  const shellIsAdmin  = authUser?.email === ADMIN_EMAIL;

  return (
    <NewLookShell
      activeSection={shellSection}
      onNavigate={shellNavigate}
      userName={shellUserName}
      isAdmin={shellIsAdmin}
      hasNotification={Object.keys(betReadyAlerts).length > 0}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        button { font-family: inherit; }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(57,255,20,0.2);border-radius:2px;}
      `}</style>

      {/* ── AUTH GATE — show login/paywall if not signed in ── */}
      {!authUser && (
        <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(246,249,246,0.97)',backdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'rgba(255,255,255,0.9)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:20,width:'100%',maxWidth:420,padding:'32px 28px',boxShadow:'0 20px 60px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign:'center',marginBottom:24 }}>
              <div style={{ width:60,height:60,margin:'0 auto 12px',background:'linear-gradient(145deg,rgba(255,255,255,0.9),rgba(235,255,230,0.8))',border:'2px solid rgba(57,200,20,0.5)',borderRadius:15,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 20px rgba(57,255,20,0.22)' }}>
                <span style={{ fontSize:17,fontWeight:800,background:'linear-gradient(135deg,#33aa00,#39FF14)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>AI</span>
              </div>
              <div style={{ fontSize:14,fontWeight:800,color:'#111',letterSpacing:0.5 }}>VEGAS VAULT AI</div>
              <div style={{ fontSize:10,color:'#aaa',letterSpacing:'1.5px',textTransform:'uppercase',marginTop:2 }}>AI Model OS</div>
            </div>
            <div style={{ fontSize:18,fontWeight:800,color:'#111',textAlign:'center',marginBottom:4 }}>Welcome back</div>
            <div style={{ fontSize:11,color:'#aaa',textAlign:'center',marginBottom:20 }}>Sign in to access your AI sports intelligence platform</div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'0.6px',color:'#aaa',marginBottom:5,fontWeight:600 }}>Email</div>
              <div style={{ display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'11px 13px',background:'rgba(255,255,255,0.8)' }}>
                <i className="ti ti-mail" style={{ fontSize:15,color:'#bbb' }} />
                <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@email.com"
                  style={{ flex:1,border:'none',background:'transparent',fontSize:12,color:'#333',outline:'none',fontFamily:'inherit' }}
                  onKeyDown={e=>e.key==='Enter'&&doAuth()} />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'0.6px',color:'#aaa',marginBottom:5,fontWeight:600 }}>Password</div>
              <div style={{ display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'11px 13px',background:'rgba(255,255,255,0.8)' }}>
                <i className="ti ti-lock" style={{ fontSize:15,color:'#bbb' }} />
                <input type={showPw?'text':'password'} value={authPw} onChange={e=>setAuthPw(e.target.value)} placeholder="••••••••"
                  style={{ flex:1,border:'none',background:'transparent',fontSize:12,color:'#333',outline:'none',fontFamily:'inherit' }}
                  onKeyDown={e=>e.key==='Enter'&&doAuth()} />
                <span onClick={()=>setShowPw(p=>!p)} style={{ cursor:'pointer',fontSize:15,color:'#bbb' }}>
                  <i className={showPw?'ti ti-eye-off':'ti ti-eye'} />
                </span>
              </div>
            </div>
            {authError && <div style={{ fontSize:11,color:'#dd4444',background:'rgba(255,80,80,0.08)',border:'1px solid rgba(255,80,80,0.2)',borderRadius:8,padding:'8px 12px',marginBottom:12,textAlign:'center' }}>{authError}</div>}
            <button onClick={doAuth} disabled={authLoading}
              style={{ width:'100%',padding:13,borderRadius:11,background:'linear-gradient(135deg,#39FF14,#22cc00)',border:'none',fontFamily:'inherit',fontSize:13,fontWeight:800,color:'#111',cursor:authLoading?'wait':'pointer',boxShadow:'0 4px 16px rgba(57,255,20,0.35)',marginBottom:12 }}>
              {authLoading ? 'Signing in...' : 'Log In to Vault →'}
            </button>
            <div style={{ textAlign:'center',fontSize:11,color:'#aaa' }}>
              Don't have an account?{' '}
              <span onClick={()=>setAuthMode(authMode==='login'?'signup':'login')} style={{ color:'#33aa00',fontWeight:700,cursor:'pointer' }}>
                {authMode==='login'?'Sign up':'Sign in'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYWALL — signed in but not subscribed ── */}
      {authUser && !isSubscribed && (
        <div style={{ position:'fixed',inset:0,zIndex:9998,background:'rgba(246,249,246,0.97)',backdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(57,255,20,0.28)',borderRadius:20,width:'100%',maxWidth:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(57,255,20,0.09)' }}>
            <div style={{ padding:'24px 28px 8px',textAlign:'center' }}>
              <div style={{ display:'inline-flex',alignItems:'center',gap:6,fontSize:9,fontWeight:800,letterSpacing:'1.2px',color:'#39FF14',border:'1px solid rgba(57,255,20,0.35)',padding:'4px 14px',borderRadius:14,background:'rgba(57,255,20,0.07)',marginBottom:12 }}>
                <span style={{ width:5,height:5,borderRadius:'50%',background:'#39FF14',boxShadow:'0 0 5px #39FF14',display:'inline-block' }} />
                SUBSCRIPTION REQUIRED
              </div>
              <div style={{ fontSize:20,fontWeight:800,color:'#111' }}>Unlock Vegas Vault AI</div>
              <div style={{ fontSize:11,color:'#aaa',marginTop:4,lineHeight:1.5 }}>Subscribe to access live AI analysis, Tier 1 locks,<br/>and the full Games Slate across all sports.</div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'16px 28px' }}>
              {[{name:'Weekly',price:'$14.99',period:'per week',save:''},
                {name:'Monthly',price:'$29.99',period:'per month',save:'Save 50% vs weekly',best:true}].map(plan=>(
                <div key={plan.name} onClick={()=>doSubscribe(plan.name.toLowerCase())} style={{ border:plan.best?'2px solid #39FF14':'1px solid rgba(0,0,0,0.07)',borderRadius:14,padding:'16px 14px',textAlign:'center',cursor:'pointer',position:'relative',background:plan.best?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.5)',boxShadow:plan.best?'0 0 24px rgba(57,255,20,0.15)':'none' }}>
                  {plan.best && <div style={{ position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',fontSize:8,fontWeight:800,color:'#111',background:'#39FF14',padding:'3px 10px',borderRadius:8,letterSpacing:0.5 }}>BEST VALUE</div>}
                  <div style={{ fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.6px',marginTop:6 }}>{plan.name}</div>
                  <div style={{ fontSize:24,fontWeight:900,color:'#111',marginTop:6 }}>{plan.price}</div>
                  <div style={{ fontSize:10,color:'#bbb' }}>{plan.period}</div>
                  {plan.save && <div style={{ fontSize:9,color:'#33aa00',fontWeight:700,marginTop:4 }}>{plan.save}</div>}
                </div>
              ))}
            </div>
            <div style={{ padding:'0 28px 20px' }}>
              {['Full AI analysis on every game — MLB, NBA, NFL, Tennis','Daily Top Play of the Day with AI Lock','Tier 1 / Tier 2 / Pass breakdowns','Scam play alerts, line movement & sharp money','Vault storage for saved plays'].map((f,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'6px 0',fontSize:11,color:'#444',lineHeight:1.5 }}>
                  <div style={{ width:18,height:18,borderRadius:'50%',background:'rgba(57,255,20,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
                    <i className="ti ti-check" style={{ fontSize:11,color:'#33aa00' }} />
                  </div>
                  {f}
                </div>
              ))}
              <div style={{ textAlign:'center',fontSize:10,color:'#ccc',marginTop:12,lineHeight:1.6 }}>
                Cancel anytime. Manage via Settings → Customer Portal.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN DASHBOARD — game slate ── */}
      {authUser && isSubscribed && (
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>

          {/* Top Play Banner */}
          <TopPlayBanner
            topPlay={topPlay}
            loading={topPlayLoading}
            results={results}
            games={games}
            pickHistory={pickHistory}
            isSubscribed={isSubscribed}
            onShowAuth={()=>setShowAuth(true)}
            onForceRefresh={null}
            isAdmin={shellIsAdmin}
            watchlist={watchlist}
            onToggleWatch={(id)=>setWatchlist(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
            sport={filter}
          />

          {/* Date nav + sport filter */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10 }}>
            <div>
              <div style={{ fontSize:18,fontWeight:800,color:'#111',letterSpacing:-0.3 }}>Today's Slate</div>
              <div style={{ fontSize:11,color:'#aaa',marginTop:2 }}>
                {new Date(selectedDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                {' · '}{games.length} games
              </div>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              {/* Date navigation */}
              <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                <button onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()-1);setSelectedDate(d.toISOString().split('T')[0]);}}
                  style={{ width:30,height:30,borderRadius:9,border:'1px solid rgba(0,0,0,0.07)',background:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#666' }}>
                  <i className="ti ti-chevron-left" style={{ fontSize:14 }} />
                </button>
                <button onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()+1);setSelectedDate(d.toISOString().split('T')[0]);}}
                  style={{ width:30,height:30,borderRadius:9,border:'1px solid rgba(0,0,0,0.07)',background:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#666' }}>
                  <i className="ti ti-chevron-right" style={{ fontSize:14 }} />
                </button>
              </div>
              {/* Sport filter tabs */}
              {['ALL',...new Set(games.map(g=>g.sport).filter(Boolean))].map(s=>(
                <button key={s} onClick={()=>setFilter(s)}
                  style={{ fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:14,border:filter===s?'1px solid #39FF14':'1px solid rgba(0,0,0,0.07)',background:filter===s?'#39FF14':'rgba(255,255,255,0.7)',color:filter===s?'#111':'#999',cursor:'pointer',boxShadow:filter===s?'0 0 8px rgba(57,255,20,0.3)':'none' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Admin slot pattern controls */}
          {shellIsAdmin && (
            <div style={{ background:'rgba(255,255,255,0.62)',border:'1px solid rgba(57,255,20,0.28)',borderRadius:14,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap' }}>
              <span style={{ fontSize:9,fontWeight:800,color:'#fff',background:'linear-gradient(135deg,#111,#333)',padding:'2px 9px',borderRadius:6,letterSpacing:1 }}>ADMIN</span>
              <span style={{ fontSize:11,fontWeight:600,color:'#555' }}>Slot Pattern Manager</span>
              <button onClick={()=>window.location.href='/settings'}
                style={{ fontSize:10,fontWeight:700,padding:'6px 12px',borderRadius:8,background:'linear-gradient(135deg,#39FF14,#22cc00)',border:'none',color:'#111',cursor:'pointer',marginLeft:'auto' }}>
                <i className="ti ti-settings" style={{ fontSize:12,marginRight:4 }} />Open Settings
              </button>
            </div>
          )}

          {/* Game cards grid */}
          {loading ? (
            <div style={{ textAlign:'center',padding:'60px 0',color:'#aaa',fontSize:13 }}>
              <div style={{ width:32,height:32,border:'3px solid rgba(57,255,20,0.2)',borderTopColor:'#39FF14',borderRadius:'50%',margin:'0 auto 12px',animation:'spin 0.8s linear infinite' }} />
              Loading today's games...
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:12 }}>
              {games.filter(g=>filter==='ALL'||g.sport===filter).map(game=>{
                const key = `${game.id}-${game.slot}`;
                return (
                  <GameCard
                    key={key}
                    game={game}
                    onGenerate={handleGenerate}
                    results={results}
                    generating={generating}
                    onCardClick={(g,r)=>{setActiveGame(g);setActiveResult(r);}}
                    liveScores={liveScores}
                    isSubscribed={isSubscribed}
                    finalized={finalized}
                    isQueued={preAnalyzeQueue.includes(key)}
                    betReady={!!betReadyAlerts[key]}
                    onShowAuth={()=>setShowAuth(true)}
                    watchlist={watchlist}
                    onToggleWatch={(id)=>setWatchlist(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                    pickHistory={pickHistory}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY MODAL ── */}
      {showHistory && (
        <div style={{ position:'fixed',inset:0,zIndex:9000,display:'flex' }}>
          <div onClick={()=>setShowHistory(false)} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)' }}/>
          <div style={{ position:'relative',marginLeft:'auto',width:'100%',maxWidth:560,height:'100%',background:'#fff',borderLeft:'1px solid rgba(57,255,20,0.15)',overflowY:'auto',display:'flex',flexDirection:'column' }}>
            <div style={{ padding:'18px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:10 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:800,color:'#111' }}>My Picks History</div>
                <div style={{ fontSize:10,color:'#aaa',marginTop:2 }}>{pickHistory.length} total picks tracked</div>
              </div>
              <button onClick={()=>setShowHistory(false)} style={{ width:32,height:32,borderRadius:8,border:'1px solid rgba(0,0,0,0.07)',background:'rgba(255,255,255,0.8)',cursor:'pointer',color:'#666',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
            </div>
            {pickHistory.length > 0 && (()=>{
              const wins=pickHistory.filter(p=>p.result==='win').length;
              const losses=pickHistory.filter(p=>p.result==='loss').length;
              const total=wins+losses;
              const rate=total>0?Math.round((wins/total)*100):0;
              return (
                <div style={{ padding:'16px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
                  {[{label:'ALL TIME',value:`${rate}%`,sub:`${wins}W-${losses}L`,color:rate>=60?'#33aa00':rate>=50?'#bb8800':'#dd4444'},
                    {label:'TOTAL PICKS',value:total,sub:'tracked',color:'#555'},
                  ].map((s,i)=>(
                    <div key={i} style={{ background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10,padding:'12px 10px',textAlign:'center' }}>
                      <div style={{ fontSize:9,color:'#aaa',letterSpacing:'0.06em',marginBottom:4,textTransform:'uppercase' }}>{s.label}</div>
                      <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</div>
                      <div style={{ fontSize:9,color:'#bbb',marginTop:3 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ flex:1,padding:'12px 20px 100px' }}>
              {pickHistory.length===0 ? (
                <div style={{ textAlign:'center',padding:'60px 20px',color:'#aaa' }}>No picks tracked yet</div>
              ) : (
                [...pickHistory].reverse().map((pick,i)=>{
                  const isWin=pick.result==='win';
                  const isLoss=pick.result==='loss';
                  return (
                    <div key={i} style={{ background:isWin?'rgba(57,255,20,0.05)':isLoss?'rgba(255,80,80,0.04)':'rgba(255,255,255,0.5)',border:`1px solid ${isWin?'rgba(57,255,20,0.25)':isLoss?'rgba(255,80,80,0.2)':'rgba(0,0,0,0.05)'}`,borderRadius:12,padding:'12px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap' }}>
                          <span style={{ fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:5,background:pick.slot==='VEGAS'?'rgba(255,80,80,0.08)':'rgba(80,140,255,0.08)',color:pick.slot==='VEGAS'?'#dd4444':'#5588ee' }}>{pick.slot||'PUBLIC'}</span>
                          <span style={{ fontSize:12,fontWeight:700,color:'#111' }}>{pick.pick}</span>
                          <span style={{ fontSize:10,color:'#aaa' }}>{pick.betType}</span>
                        </div>
                        <div style={{ fontSize:10,color:'#999' }}>{pick.game}</div>
                        {pick.score && <div style={{ fontSize:9,color:'#bbb' }}>Final: {pick.score}</div>}
                        <div style={{ fontSize:8,color:'#ccc',marginTop:3 }}>{pick.resolvedAt?new Date(pick.resolvedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):pick.date}</div>
                      </div>
                      <div style={{ flexShrink:0,fontSize:12,fontWeight:800,padding:'6px 14px',borderRadius:8,background:isWin?'rgba(57,255,20,0.12)':isLoss?'rgba(255,80,80,0.1)':'rgba(0,0,0,0.03)',border:`1px solid ${isWin?'rgba(57,255,20,0.3)':isLoss?'rgba(255,80,80,0.3)':'rgba(0,0,0,0.06)'}`,color:isWin?'#33aa00':isLoss?'#dd4444':'#999' }}>
                        {isWin?'✅ WIN':isLoss?'❌ LOSS':'PENDING'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {pickHistory.length>0 && (
              <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(0,0,0,0.05)',position:'sticky',bottom:0,background:'#fff' }}>
                <button onClick={()=>{if(window.confirm('Clear all pick history?')){setPickHistory([]);if(authUser?.id)syncDelete(authUser.id,'pick_history');}}}
                  style={{ width:'100%',padding:'10px 0',background:'rgba(255,80,80,0.06)',border:'1px solid rgba(255,80,80,0.15)',borderRadius:8,fontSize:11,color:'#dd4444',cursor:'pointer',fontFamily:'inherit' }}>
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GAME DETAIL MODAL ── */}
      {activeGame && activeResult && (
        <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setActiveGame(null)}>
          <div style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:700,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(0,0,0,0.15)' }}>
            <div style={{ padding:'16px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ fontWeight:800,color:'#111',fontSize:14 }}>{activeGame.away} @ {activeGame.home}</div>
              <button onClick={()=>setActiveGame(null)} style={{ width:32,height:32,borderRadius:8,border:'1px solid rgba(0,0,0,0.07)',background:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',color:'#666' }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ fontSize:11,color:'#aaa',marginBottom:16 }}>{activeResult?.analysis?.matchupFoundation}</div>
              {Object.entries(activeResult?.analysis||{}).filter(([k])=>k!=='matchupFoundation').map(([k,v])=>(
                v && <div key={k} style={{ marginBottom:12,padding:'10px 14px',background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10 }}>
                  <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>{k.replace(/([A-Z])/g,' $1').trim()}</div>
                  <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{typeof v==='object'?JSON.stringify(v):v}</div>
                </div>
              ))}
              {activeResult?.summary?.verdict && (
                <div style={{ marginTop:16,padding:'12px 14px',background:'rgba(57,255,20,0.07)',border:'1px solid rgba(57,255,20,0.2)',borderRadius:10 }}>
                  <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Bottom Line</div>
                  <div style={{ fontSize:12,color:'#444',lineHeight:1.6 }}>{activeResult.summary.verdict}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </NewLookShell>
  );
}
