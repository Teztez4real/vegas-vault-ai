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
  "1":    { bg:"rgba(57,255,20,0.1)",   border:"rgba(57,255,20,0.25)",   text:"#2aa800", label:"LOCK"   },
  "2":    { bg:"rgba(255,200,0,0.08)",  border:"rgba(255,200,0,0.2)",    text:"#bb8800", label:"TIER 2" },
  "3":    { bg:"rgba(0,0,0,0.04)",      border:"rgba(0,0,0,0.07)",       text:"#999",    label:"TIER 3" },
  "PASS": { bg:"rgba(255,80,80,0.08)",  border:"rgba(255,80,80,0.2)",    text:"#dd4444", label:"PASS"   },
};
const CONF_STYLES = {
  HIGH:   { color:"#39FF14", label:"HIGH CONFIDENCE",   ring:0.82, text:"VERY HIGH CONFIDENCE" },
  MEDIUM: { color:"#ffb800", label:"MEDIUM CONFIDENCE", ring:0.58, text:"MEDIUM CONFIDENCE" },
  LOW:    { color:"#ff6b6b", label:"LOW CONFIDENCE",    ring:0.32, text:"LOW CONFIDENCE" },
};

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
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN",
  "Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE",
  "Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET",
  "Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND",
  "Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM",
  "Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN",
  "New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC",
  "Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX",
  "Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS",
  "Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS",
};
function getAbbr(name) {
  if (!name) return '???';
  return NAME_TO_ABBR[name] || NAME_TO_ABBR[name.split(' ').pop()] || name.slice(0,3).toUpperCase();
}

function ConfidenceChart({ history }) {
  const base = [20,35,28,45,38,52,42,60,55,58,65,70,62,75,70];
  const data = history && history.length > 1 ? history : base;
  const pts = data.map((v,i)=>`${i*(200/(data.length-1))},${70-(v/100)*60}`).join(" ");
  return(
    <svg width="100%" height="50" viewBox="0 0 200 70" preserveAspectRatio="none">
      <defs><linearGradient id="vv-cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39FF14" stopOpacity="0.2"/><stop offset="100%" stopColor="#39FF14" stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,70 ${pts} 200,70`} fill="url(#vv-cg)"/>
      <polyline points={pts} fill="none" stroke="#39FF14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── GAME CARD (new glass design) ──────────────────────────────────────────────
function GameCard({ game, onGenerate, results, generating, onCardClick, liveScores, isSubscribed, finalized, isQueued, betReady, onShowAuth, watchlist, onToggleWatch, pickHistory, hasSlotPattern }) {
  const resultVegas  = results[`${game.id}-VEGAS`];
  const resultPublic = results[`${game.id}-PUBLIC`];
  const slotResult   = results[`${game.id}-${game.slot}`];
  const bestResult   = slotResult || resultVegas || resultPublic;
  const summary      = bestResult?.summary;
  const tier         = summary ? (TIER_STYLES[summary.tier] || TIER_STYLES["3"]) : null;
  const isLock       = tier?.label === "LOCK";
  const isTennis     = game.sport === "Tennis";

  const awayLast = game.away?.split(' ').pop();
  const homeLast = game.home?.split(' ').pop();
  const live = liveScores?.[game.id]
    || liveScores?.[`${game.away}|${game.home}`]
    || liveScores?.[`${game.awayAbbr}|${game.homeAbbr}`]
    || liveScores?.[`${awayLast}|${homeLast}`];
  const isLive  = live?.status === 'Live' || live?.detailedState === 'In Progress';
  const isFinal = live?.status === 'Final' || live?.detailedState === 'Final';
  const hasScore = live?.awayScore != null;
  const isPostponed = !hasScore && !isLive && !isFinal && (live?.isPostponed || false);
  const isDelayed   = !hasScore && (live?.isDelayed || false);
  const gameStarted = isLive || isFinal;

  const awayName = isTennis ? game.player1 : (game.away || '');
  const homeName = isTennis ? game.player2 : (game.home || '');
  const awayAbbr = game.awayAbbr || getAbbr(awayName);
  const homeAbbr = game.homeAbbr || getAbbr(homeName);
  const awayRec  = isTennis ? `#${game.player1Ranking}` : game.awayRecord;
  const homeRec  = isTennis ? `#${game.player2Ranking}` : game.homeRecord;


  const isVegas = game.slot === 'VEGAS';
  const key = `${game.id}-${game.slot}`;
  const isGen = generating === key;
  const hasRes = !!results[key];
  const histEntry = pickHistory?.find(p => p.key === key);
  const pickResult = histEntry?.result;

  return (
    <div onClick={()=>hasRes&&onCardClick&&onCardClick(game, results[key])}
      style={{ background:'rgba(255,255,255,0.72)',border:isLock&&isSubscribed?'1px solid rgba(57,255,20,0.35)':'1px solid rgba(255,255,255,0.93)',borderRadius:16,backdropFilter:'blur(20px)',boxShadow:isLock&&isSubscribed?'0 8px 30px rgba(57,255,20,0.12),inset 0 1px 0 rgba(255,255,255,0.95)':'0 8px 30px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.95)',padding:'14px 16px',cursor:hasRes?'pointer':'default' }}>

      {/* Row 1: slot tag + status + time + watchlist */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
          {hasSlotPattern && (
            <span style={{ fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:6,letterSpacing:'0.5px',background:isVegas?'rgba(57,255,20,0.1)':'rgba(80,140,255,0.08)',color:isVegas?'#2aa800':'#5588ee',border:isVegas?'1px solid rgba(57,255,20,0.25)':'1px solid rgba(80,140,255,0.2)' }}>
              {isVegas?'VEGAS SLOT':'PUBLIC SLOT'}
            </span>
          )}
          {isLive&&<span style={{ fontSize:9,fontWeight:800,color:'#fff',background:'#dc2626',padding:'3px 9px',borderRadius:6,display:'flex',alignItems:'center',gap:4 }}><span style={{ width:5,height:5,borderRadius:'50%',background:'#fff',display:'inline-block',animation:'pulse 1s infinite' }}/> LIVE</span>}
          {isFinal&&!isPostponed&&<span style={{ fontSize:9,fontWeight:700,color:'#999',background:'rgba(0,0,0,0.04)',padding:'3px 9px',borderRadius:6,border:'1px solid rgba(0,0,0,0.07)' }}>FINAL</span>}
          {isDelayed&&<span style={{ fontSize:9,fontWeight:700,color:'#bb8800',background:'rgba(255,200,0,0.08)',padding:'3px 9px',borderRadius:6 }}>⏸ DELAYED</span>}
          {isPostponed&&<span style={{ fontSize:9,fontWeight:700,color:'#dd4444',background:'rgba(255,80,80,0.08)',padding:'3px 9px',borderRadius:6 }}>⛔ POSTPONED</span>}
          {betReady&&!gameStarted&&isSubscribed&&<span style={{ fontSize:9,fontWeight:800,color:'#111',background:'#39FF14',padding:'3px 9px',borderRadius:6 }}>🎯 BET NOW</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {/* Tier badge */}
          {tier&&isSubscribed&&(
            <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:7,
              background:isLock?'rgba(57,255,20,0.1)':summary?.tier==='2'?'rgba(255,200,0,0.08)':'rgba(0,0,0,0.04)',
              color:isLock?'#2aa800':summary?.tier==='2'?'#bb8800':'#999',
              border:isLock?'1px solid rgba(57,255,20,0.25)':summary?.tier==='2'?'1px solid rgba(255,200,0,0.2)':'1px solid rgba(0,0,0,0.07)' }}>
              {isLock?'★★★★★ ':summary?.tier==='2'?'★★★★ ':''}
              {isLock?'TIER 1':summary?.tier==='2'?'TIER 2':'PASS'}
            </span>
          )}
          <span style={{ fontSize:10,color:'#aaa' }}>{live?.scheduledTime||game.time}</span>
          <span onClick={e=>{e.stopPropagation();onToggleWatch?.(game.id);}} style={{ fontSize:16,color:watchlist?.includes(game.id)?'#39FF14':'#ccc',cursor:'pointer',lineHeight:1 }}>
            {watchlist?.includes(game.id)?'★':'☆'}
          </span>
        </div>
      </div>

      {/* Row 2: teams + logos + records */}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3,width:60,flexShrink:0 }}>
          <TeamLogo abbr={awayAbbr} sport={game.sport} size={42} />
          <div style={{ fontSize:10,fontWeight:800,color:'#111' }}>{awayAbbr}</div>
          <div style={{ fontSize:8,color:'#bbb' }}>{awayRec}</div>
        </div>
        <div style={{ flex:1,textAlign:'center' }}>
          <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>
            {isTennis?`${awayName} vs ${homeName}`:`${awayAbbr} @ ${homeAbbr}`}
          </div>
          <div style={{ fontSize:9,color:'#aaa',marginTop:2 }}>{game.venue||''}</div>
          {/* Live score */}
          {gameStarted&&live&&(
            <div style={{ marginTop:8,background:'rgba(0,0,0,0.04)',borderRadius:10,padding:'8px 12px',display:'flex',justifyContent:'space-around',alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9,color:'#aaa',marginBottom:2 }}>{awayAbbr}</div>
                <div style={{ fontSize:24,fontWeight:900,color:'#111' }}>{live.awayScore??'-'}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                {isLive?<div><div style={{ fontSize:9,color:'#dc2626',fontWeight:700 }}>{live.inningHalf?.slice(0,3).toUpperCase()||''} {live.inning||''}</div><div style={{ fontSize:9,color:'#aaa' }}>{live.outs??0} out{live.outs===1?'':'s'}</div></div>
                :<div style={{ fontSize:10,color:'#aaa',fontWeight:600 }}>FINAL</div>}
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9,color:'#aaa',marginBottom:2 }}>{homeAbbr}</div>
                <div style={{ fontSize:24,fontWeight:900,color:'#111' }}>{live.homeScore??'-'}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3,width:60,flexShrink:0 }}>
          <TeamLogo abbr={homeAbbr} sport={game.sport} size={42} />
          <div style={{ fontSize:10,fontWeight:800,color:'#111' }}>{homeAbbr}</div>
          <div style={{ fontSize:8,color:'#bbb' }}>{homeRec}</div>
        </div>
      </div>


      {/* Row 4: AI result strip */}
      {isSubscribed&&hasRes&&summary&&(
        <div style={{ background:isVegas?'rgba(57,255,20,0.06)':'rgba(80,140,255,0.05)',border:isVegas?'1px solid rgba(57,255,20,0.2)':'1px solid rgba(80,140,255,0.15)',borderRadius:9,padding:'8px 10px',marginBottom:8 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:7,fontWeight:800,color:isVegas?'#2aa800':'#5588ee',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2 }}>{game.slot} PRIMARY</div>
              <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>{summary.pick}</div>
              <div style={{ fontSize:10,color:'#aaa',marginTop:1 }}>{summary.betType}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              {isLock&&<div style={{ fontSize:9,fontWeight:800,color:'#2aa800',border:'1px solid rgba(57,255,20,0.3)',borderRadius:6,padding:'2px 8px',background:'rgba(57,255,20,0.07)',marginBottom:4 }}>🔒 LOCK</div>}
              {pickResult==='win'&&<div style={{ fontSize:11,fontWeight:800,color:'#33aa00' }}>✅ WIN</div>}
              {pickResult==='loss'&&<div style={{ fontSize:11,fontWeight:800,color:'#dd4444' }}>❌ LOSS</div>}
            </div>
          </div>
        </div>
      )}

      {/* Row 5: Action */}
      {isPostponed?(
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 0',background:'rgba(255,80,80,0.04)',border:'1px solid rgba(255,80,80,0.15)',borderRadius:10 }}>
          <span style={{ fontSize:10,fontWeight:700,color:'#dd4444' }}>⛔ POSTPONED — Analysis unavailable</span>
        </div>
      ):gameStarted?(
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 0',background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:10 }}>
          <span style={{ fontSize:10,fontWeight:700,color:'#aaa' }}>{isLive?'🔴 GAME IN PROGRESS — LOCKED':'⬛ FINAL — ANALYSIS LOCKED'}</span>
        </div>
      ):!isSubscribed?(
        <div onClick={()=>onShowAuth?.('plans')} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px 0',background:'rgba(57,255,20,0.06)',border:'1px solid rgba(57,255,20,0.2)',borderRadius:10,cursor:'pointer' }}>
          <span style={{ fontSize:13 }}>🔒</span>
          <span style={{ fontSize:10,fontWeight:700,color:'#33aa00',letterSpacing:'0.08em' }}>SUBSCRIBE TO UNLOCK</span>
        </div>
      ):isGen?(
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px 0',background:'rgba(57,255,20,0.06)',border:'1px solid rgba(57,255,20,0.2)',borderRadius:10 }}>
          <div style={{ width:12,height:12,borderRadius:'50%',border:'2px solid rgba(57,255,20,0.3)',borderTop:'2px solid #39FF14',animation:'spin 0.8s linear infinite' }}/>
          <span style={{ fontSize:10,fontWeight:700,color:'#33aa00' }}>ANALYZING {game.slot}…</span>
        </div>
      ):hasRes?(
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:'rgba(248,255,248,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10 }}>
          <span style={{ fontSize:10,fontWeight:700,color:'#33aa00' }}>✓ {game.slot} — ANALYZED</span>
          <button onClick={e=>{e.stopPropagation();onGenerate(game,game.slot);}}
            style={{ fontSize:10,fontWeight:700,color:'#555',background:'rgba(255,255,255,0.7)',border:'1px solid rgba(0,0,0,0.07)',borderRadius:7,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4 }}>
            <i className="ti ti-refresh" style={{ fontSize:12 }}/> Re-analyze
          </button>
        </div>
      ):(
        <div onClick={()=>onGenerate(game,game.slot)} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 0',background:'rgba(248,255,248,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10,cursor:'pointer' }}>
          <i className="ti ti-sparkles" style={{ fontSize:13,color:'#33aa00' }}/>
          <span style={{ fontSize:10,fontWeight:700,color:'#33aa00',letterSpacing:'0.06em' }}>ANALYZE</span>
        </div>
      )}
    </div>
  );
}

// ── TOP PLAY BANNER ───────────────────────────────────────────────────────────
function TopPlayBanner({ topPlay, loading, results, pickHistory, isSubscribed, isAdmin, watchlist, onToggleWatch, onForceRefresh }) {
  const result = topPlay && (results[`${topPlay.id}-${topPlay.slot}`]||results[`${topPlay.id}-PUBLIC`]||results[`${topPlay.id}-VEGAS`]);
  const summary = result?.summary;
  const histEntry = topPlay && pickHistory?.find(p=>p.key===`${topPlay.id}-${topPlay.slot}`);
  const pickResult = histEntry?.result;
  const isVegas = topPlay?.slot === 'VEGAS';
  const isLock = summary?.tier === '1';

  if (loading) return (
    <div style={{ background:'rgba(255,255,255,0.72)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:16,backdropFilter:'blur(20px)',boxShadow:'0 8px 30px rgba(0,0,0,0.06)',padding:'14px 20px',display:'flex',alignItems:'center',gap:10 }}>
      <div style={{ width:14,height:14,borderRadius:'50%',border:'2px solid rgba(57,255,20,0.3)',borderTop:'2px solid #39FF14',animation:'spin 0.8s linear infinite',flexShrink:0 }}/>
      <span style={{ fontSize:11,color:'#aaa' }}>Loading today's top play...</span>
    </div>
  );
  if (!topPlay||!summary) return null;

  return (
    <div style={{ background:'rgba(255,255,255,0.62)',border:'1px solid rgba(57,255,20,0.28)',borderRadius:16,backdropFilter:'blur(20px)',boxShadow:'0 10px 36px rgba(57,255,20,0.09)',padding:'14px 20px' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:10 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontSize:9,fontWeight:800,color:'#111',background:'#39FF14',padding:'3px 10px',borderRadius:6,letterSpacing:'0.5px',boxShadow:'0 0 8px rgba(57,255,20,0.4)' }}>⭐ TOP PLAY</span>
          <span style={{ fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:6,background:isVegas?'rgba(57,255,20,0.1)':'rgba(80,140,255,0.08)',color:isVegas?'#2aa800':'#5588ee',border:isVegas?'1px solid rgba(57,255,20,0.25)':'1px solid rgba(80,140,255,0.2)' }}>{topPlay.slot}</span>
          {isLock&&<span style={{ fontSize:9,fontWeight:800,color:'#2aa800',background:'rgba(57,255,20,0.1)',border:'1px solid rgba(57,255,20,0.25)',padding:'3px 9px',borderRadius:6 }}>★★★★★ TIER 1</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:10,color:'#aaa' }}>{topPlay.time}</span>
          <span onClick={()=>onToggleWatch?.(topPlay.id)} style={{ fontSize:16,color:watchlist?.includes(topPlay.id)?'#39FF14':'#ccc',cursor:'pointer' }}>
            {watchlist?.includes(topPlay.id)?'★':'☆'}
          </span>
          {isAdmin&&onForceRefresh&&(
            <button onClick={onForceRefresh} style={{ fontSize:10,fontWeight:700,color:'#555',background:'rgba(255,255,255,0.7)',border:'1px solid rgba(0,0,0,0.07)',borderRadius:7,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4 }}>
              <i className="ti ti-refresh" style={{ fontSize:12 }}/> Re-analyze
            </button>
          )}
        </div>
      </div>
      <div style={{ display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap' }}>
        <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(57,255,20,0.2)',borderRadius:10,padding:'10px 14px',flexShrink:0 }}>
          <div style={{ fontSize:9,color:'#33aa00',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3 }}>THE PLAY</div>
          <div style={{ fontSize:18,fontWeight:900,color:'#111' }}>{summary.pick}</div>
          <div style={{ fontSize:10,color:'#aaa',marginTop:2 }}>{summary.betType}</div>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:11,color:'#999',marginBottom:4 }}>{topPlay.away} @ {topPlay.home}</div>
          {summary.verdict&&<div style={{ fontSize:11,color:'#555',lineHeight:1.6 }}>{summary.verdict.length>140?summary.verdict.slice(0,137)+'...':summary.verdict}</div>}
          {pickResult&&<div style={{ marginTop:6,fontSize:13,fontWeight:800,color:pickResult==='win'?'#33aa00':'#dd4444' }}>{pickResult==='win'?'✅ WIN':'❌ LOSS'}</div>}
        </div>
      </div>
    </div>
  );
}

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
  const [analyticsFilter, setAnalyticsFilter] = useState('All');
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
  const [activeDetailTab, setActiveDetailTab] = useState('AI Reasoning');
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
    if(result){setActiveResult(result);setActiveGame(game);setActiveDetailTab('AI Reasoning');}
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
  // "dashboard" = command-center view, "slate" = full games grid page.
  // AI Chat / Models / Memory / Agents / Vault / Analytics are visual
  // placeholders that stay on whichever main view is active.
  // "dashboard" = command-center view, "slate" = full games grid,
  // "vault" = saved/watchlisted plays, "analytics" = pick history & performance.
  // AI Chat / Models / Memory / Agents are visual placeholders for now.
  const [shellView, setShellView] = useState("dashboard");
  const shellSection = shellView;

  const shellNavigate = (key) => {
    if (key === "settings") { window.location.href = "/settings"; return; }
    if (["dashboard","slate","vault","analytics"].includes(key)) {
      setShellView(key);
    }
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
        .vv-center{flex:1;min-width:0;display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:10px;height:100%;min-height:0}
        .vv-col{display:flex;flex-direction:column;gap:10px;min-width:0;height:100%;min-height:0}
        .vv-glass{background:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.93);border-radius:16px;backdrop-filter:blur(20px);box-shadow:0 8px 30px rgba(0,0,0,0.06),0 2px 8px rgba(0,0,0,0.03),inset 0 1px 0 rgba(255,255,255,0.95)}
        .vv-glass-g{background:rgba(255,255,255,0.62);border:1px solid rgba(57,255,20,0.28);border-radius:16px;backdrop-filter:blur(20px);box-shadow:0 10px 36px rgba(57,255,20,0.09),0 3px 10px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.95)}
        .vv-pad{padding:13px 15px}
        .vv-card-ey{font-size:9px;text-transform:uppercase;letter-spacing:0.7px;color:#bbb;margin-bottom:1px;font-weight:500}
        .vv-card-t{font-size:11px;font-weight:800;color:#111;letter-spacing:0.3px}

        .vv-orb-card{padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .vv-orb-card::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(57,255,20,0.06) 0%,transparent 60%);pointer-events:none}
        .vv-oc-ey{font-size:9px;text-transform:uppercase;letter-spacing:1.4px;color:#aaa;text-align:center;font-weight:600}
        .vv-oc-title{font-size:12px;font-weight:800;color:#111;text-align:center;letter-spacing:0.4px;margin:2px 0}
        .vv-oc-badge{display:inline-flex;align-items:center;gap:5px;font-size:8px;font-weight:700;letter-spacing:1px;color:#39FF14;border:1px solid rgba(57,255,20,0.35);padding:2px 10px;border-radius:9px;background:rgba(57,255,20,0.07);margin-bottom:8px}
        .vv-oc-dot{width:5px;height:5px;border-radius:50%;background:#39FF14;box-shadow:0 0 5px #39FF14}
        .vv-orb-stage{position:relative;width:210px;height:210px;display:flex;align-items:center;justify-content:center}
        .vv-orb-out{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(57,255,20,0.08)}
        .vv-orb-mid{position:absolute;inset:22px;border-radius:50%;border:1px solid rgba(57,255,20,0.13)}
        .vv-orb-glow-base{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:165px;height:28px;background:radial-gradient(ellipse,rgba(57,255,20,0.28) 0%,transparent 70%);filter:blur(8px)}
        .vv-orb-sphere{width:158px;height:158px;border-radius:50%;background:radial-gradient(circle at 28% 25%,rgba(255,255,255,0.99) 0%,rgba(225,255,210,0.9) 20%,rgba(170,255,120,0.68) 46%,rgba(60,190,20,0.55) 74%,rgba(30,150,5,0.65) 100%);border:1.5px solid rgba(190,255,170,0.7);display:flex;align-items:center;justify-content:center;position:relative;z-index:3;box-shadow:0 0 0 8px rgba(57,255,20,0.04),0 0 40px rgba(57,255,20,0.4),0 0 80px rgba(57,255,20,0.18),0 0 140px rgba(57,255,20,0.08),inset -16px -16px 30px rgba(255,255,255,0.55),inset 6px 6px 16px rgba(255,255,255,0.8)}
        .vv-orb-sphere::before{content:'';position:absolute;inset:-15px;border-radius:50%;border:1px solid rgba(57,255,20,0.14);z-index:-1}
        .vv-orb-sphere::after{content:'';position:absolute;inset:-30px;border-radius:50%;border:1px solid rgba(57,255,20,0.07);z-index:-1}
        .vv-orb-net{position:absolute;inset:0;width:100%;height:100%;opacity:0.45}
        .vv-orb-core{width:104px;height:104px;border-radius:50%;background:radial-gradient(circle at 34% 30%,rgba(200,255,140,0.9),rgba(57,200,10,0.95));border:2px solid rgba(57,255,20,0.75);display:flex;align-items:center;justify-content:center;box-shadow:0 0 24px rgba(57,255,20,0.6),0 0 48px rgba(57,255,20,0.28),inset 0 0 20px rgba(255,255,255,0.28)}
        .vv-orb-ai{font-size:33px;font-weight:900;color:#fff;text-shadow:0 0 24px rgba(40,180,0,0.8),0 2px 4px rgba(0,0,0,0.18)}
        .vv-orb-p1{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:155px;height:16px;border-radius:50%;background:rgba(255,255,255,0.42);border:1px solid rgba(170,240,150,0.55);box-shadow:0 2px 18px rgba(57,255,20,0.18)}
        .vv-orb-p2{position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:110px;height:11px;border-radius:50%;background:rgba(255,255,255,0.28);border:1px solid rgba(170,240,150,0.38)}
        .vv-orb-p3{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:72px;height:7px;border-radius:50%;background:rgba(255,255,255,0.16)}

        .vv-icon-dock{display:flex;justify-content:center;gap:8px;padding:8px;align-self:center;margin:-4px 0}
        .vv-dock-i{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,0.7);border:1px solid rgba(200,240,200,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.04)}
        .vv-dock-i.on{background:#39FF14;border-color:#39FF14;box-shadow:0 0 12px rgba(57,255,20,0.45)}
        .vv-dock-i i{font-size:15px;color:#bbb}.vv-dock-i.on i{color:#111}

        .vv-mc-box{text-align:center}
        .vv-mc-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .vv-mc-licon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,rgba(57,255,20,0.2),rgba(40,180,0,0.32));border:1px solid rgba(57,255,20,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .vv-mc-licon i{font-size:15px;color:#2aa800}
        .vv-mc-ey2{font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:#bbb;text-align:left}
        .vv-mc-nm{font-size:12px;font-weight:700;color:#111;display:flex;align-items:center;gap:5px}
        .vv-mc-pr{font-size:7px;font-weight:800;padding:1px 5px;border-radius:4px;background:linear-gradient(135deg,#39FF14,#22cc00);color:#111}
        .vv-mc-body{display:flex;gap:12px;align-items:center}
        .vv-mc-3d{width:54px;height:54px;background:linear-gradient(135deg,rgba(57,255,20,0.15),rgba(40,180,0,0.28));border-radius:11px;border:1px solid rgba(57,255,20,0.3);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(57,255,20,0.18);flex-shrink:0}
        .vv-mc-3d i{font-size:26px;color:#2aa800}
        .vv-mc-rows{flex:1}
        .vv-mc-r{display:flex;justify-content:space-between;font-size:9px;padding:2px 0}
        .vv-mk{color:#bbb}.vv-mv{color:#333;font-weight:600}.vv-mv.g{color:#39FF14;font-weight:700}
        .vv-mc-link{font-size:10px;color:#39FF14;font-weight:600;margin-top:8px;padding-top:8px;border-top:0.5px solid rgba(0,0,0,0.05);cursor:pointer;display:flex;align-items:center;justify-content:space-between}

        .vv-pf-row{display:flex;align-items:center;gap:10px;margin-top:8px}
        .vv-dnut{position:relative;width:64px;height:64px;flex-shrink:0}
        .vv-dnut svg{transform:rotate(-90deg)}
        .vv-dc{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
        .vv-dc-v{font-size:11px;font-weight:800;color:#111;display:block;line-height:1.1}
        .vv-dc-l{font-size:6.5px;color:#aaa;text-transform:uppercase;letter-spacing:0.4px}
        .vv-pr{flex:1;display:flex;flex-direction:column;gap:3px}
        .vv-pr-r{display:flex;justify-content:space-between;font-size:10px}
        .vv-pk{color:#bbb}.vv-pv{color:#333;font-weight:600}

        .vv-sys-top{display:flex;justify-content:space-between;align-items:flex-start}
        .vv-sys-pct{font-size:12px;font-weight:800;color:#39FF14}
        .vv-sys-mets{display:flex;gap:6px;margin-top:8px}
        .vv-sys-m{flex:1;background:rgba(255,255,255,0.6);border:1px solid rgba(57,255,20,0.12);border-radius:9px;padding:7px 4px;text-align:center}
        .vv-sys-mv{font-size:13px;font-weight:700;color:#111}
        .vv-sys-mk{font-size:7px;color:#aaa;text-transform:uppercase;letter-spacing:0.3px;margin-top:1px}

        .vv-ai-card{padding:13px 14px}
        .vv-ai-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .vv-ai-trow{display:flex;align-items:center;gap:7px}
        .vv-ai-ic{width:26px;height:26px;border-radius:7px;background:rgba(57,255,20,0.1);border:1px solid rgba(57,255,20,0.25);display:flex;align-items:center;justify-content:center}
        .vv-ai-ic i{font-size:13px;color:#39FF14}
        .vv-ai-nm{font-size:10px;font-weight:700;color:#111}
        .vv-ai-st{font-size:8px;color:#39FF14;font-weight:500;display:flex;align-items:center;gap:3px}
        .vv-ai-std{width:4px;height:4px;border-radius:50%;background:#39FF14;box-shadow:0 0 4px #39FF14}
        .vv-ai-bubble{background:rgba(246,255,246,0.85);border:1px solid rgba(195,240,195,0.65);border-radius:10px;padding:9px 11px}
        .vv-ai-bubble p{font-size:10px;color:#555;margin-bottom:6px;line-height:1.6}
        .vv-ai-pt{display:flex;align-items:flex-start;gap:5px;margin-bottom:5px}
        .vv-ai-ptd{width:4px;height:4px;border-radius:50%;background:#39FF14;flex-shrink:0;margin-top:4px;box-shadow:0 0 3px rgba(57,255,20,0.6)}
        .vv-ai-pt span{font-size:10px;color:#444;line-height:1.5}
        .vv-ai-inp{display:flex;align-items:center;gap:5px;background:rgba(246,255,246,0.75);border:1px solid rgba(195,240,195,0.75);border-radius:9px;padding:6px 9px;margin-top:7px}
        .vv-ai-inp input{flex:1;border:none;background:transparent;font-family:'Inter',sans-serif;font-size:10px;color:#333;outline:none}
        .vv-ai-inp input::placeholder{color:#ccc}
        .vv-ai-snd{width:21px;height:21px;border-radius:6px;background:#39FF14;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 7px rgba(57,255,20,0.4);flex-shrink:0}

        .vv-an-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px}
        .vv-an-sel{font-size:9px;color:#aaa;border:1px solid #e8e8e8;border-radius:5px;padding:2px 6px;background:#fff;font-family:'Inter',sans-serif}
        .vv-an-chart{width:100%;height:50px;margin-bottom:8px}
        .vv-an-mets{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
        .vv-anm{text-align:center}
        .vv-anm-l{font-size:6.5px;color:#bbb;text-transform:uppercase;letter-spacing:0.3px}
        .vv-anm-v{font-size:13px;font-weight:700;color:#111}
        .vv-anm-c{font-size:8px;font-weight:600}
        .vv-up{color:#39FF14}.vv-dn{color:#ff6b6b}

        .vv-vf-r{display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,0.04)}
        .vv-vf-r:last-child{border-bottom:none}
        .vv-vf-ic{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .vv-vf-ic.r{background:rgba(255,80,80,0.09)}.vv-vf-ic.g{background:rgba(57,255,20,0.09)}.vv-vf-ic.y{background:rgba(220,180,0,0.09)}.vv-vf-ic.o{background:rgba(255,130,0,0.09)}
        .vv-vf-nm{font-size:9px;color:#333;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vv-vf-sz{font-size:8px;color:#bbb;margin-right:3px}
        .vv-vf-tm{font-size:8px;color:#ddd;min-width:24px;text-align:right}
        .vv-vf-va{font-size:10px;color:#39FF14;font-weight:600;text-align:center;padding-top:7px;cursor:pointer}

        .vv-slate{width:230px;flex-shrink:0;padding:14px 13px;display:flex;flex-direction:column;height:100%;min-height:0;overflow-y:auto}
        .vv-gc-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:1px}
        .vv-gc-t{font-size:11px;font-weight:800;color:#111;text-transform:uppercase;letter-spacing:0.4px}
        .vv-gc-sub{font-size:9px;color:#bbb;margin-bottom:8px}
        .vv-sp-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
        .vv-sp{font-size:9px;padding:2px 7px;border-radius:6px;border:1px solid rgba(200,200,200,0.35);color:#bbb;cursor:pointer;font-weight:600;background:rgba(255,255,255,0.6)}
        .vv-sp.on{background:#39FF14;border-color:#39FF14;color:#111;box-shadow:0 0 8px rgba(57,255,20,0.3)}
        .vv-gr{padding:6px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);cursor:pointer}
        .vv-gr:last-of-type{border-bottom:none}
        .vv-gr-a{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
        .vv-gr-t{font-size:10px;color:#999;display:flex;align-items:center;gap:4px}
        .vv-gr-lg{width:13px;height:13px;border-radius:3px;flex-shrink:0;object-fit:contain}
        .vv-gr-time{font-size:9px;color:#ddd}
        .vv-gr-stars{font-size:9px;color:#39FF14;font-weight:700}
        .vv-gr-b{display:flex;align-items:center;justify-content:space-between}
        .vv-gr-pick{font-size:11px;font-weight:700;color:#111}
        .vv-gr-odds{font-size:10px;color:#999}
        .vv-sl{font-size:8px;padding:2px 5px;border-radius:4px;font-weight:700}
        .vv-sl.v{background:rgba(57,255,20,0.08);color:#2aa800;border:1px solid rgba(57,255,20,0.18)}
        .vv-sl.p{background:rgba(180,200,255,0.12);color:#7799cc;border:1px solid rgba(160,190,240,0.22)}
        .vv-sl.pass{background:rgba(255,180,180,0.12);color:#cc8888;border:1px solid rgba(240,160,160,0.22)}
        .vv-gc-va{font-size:10px;color:#39FF14;font-weight:700;padding-top:8px;margin-top:auto;display:flex;align-items:center;justify-content:space-between;cursor:pointer}

        @media (max-width:1300px){
          .vv-center{grid-template-columns:1fr 1fr}
          .vv-center > .vv-col:nth-child(3){grid-column:span 2}
        }
        @media (max-width:900px){
          .vv-dashboard-row{flex-direction:column;height:auto;min-height:0}
          .vv-center{grid-template-columns:1fr;height:auto;overflow-y:visible}
          .vv-center > .vv-col:nth-child(3){grid-column:span 1}
          .vv-slate{width:100%;height:auto;overflow-y:visible;max-height:400px}
        }
      `}</style>

      {/* ── AUTH GATE ── */}
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

      {/* ── PAYWALL ── */}
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
              {[{name:'Weekly',price:'$19.99',period:'per week',save:''},
                {name:'Monthly',price:'$49.99',period:'per month',save:'Save vs weekly',best:true}].map(plan=>(
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

      {/* ── DASHBOARD — 3-column command center + games slate ── */}
      {authUser && isSubscribed && shellView === 'dashboard' && (
        <div className="vv-dashboard-row" style={{ display:'flex', gap:10, alignItems:'stretch', minWidth:0, flex:1, minHeight:0, height:0 }}>

          <div className="vv-center">

            {/* COLUMN 1: AI Performance, System Overview, Vault Files */}
            <div className="vv-col">
              <div className="vv-glass vv-pad">
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                  <div><div className="vv-card-ey">AI Performance</div><div className="vv-card-t">Real-time Model Efficiency</div></div>
                  <i className="ti ti-dots" style={{ color:'#ccc',fontSize:14 }} />
                </div>
                <div className="vv-pf-row">
                  <div className="vv-dnut">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(57,255,20,0.13)" strokeWidth="8"/>
                      <circle cx="32" cy="32" r="24" fill="none" stroke="#39FF14" strokeWidth="8" strokeDasharray="150.8" strokeDashoffset="10" strokeLinecap="round"/>
                    </svg>
                    <div className="vv-dc"><span className="vv-dc-v">{winRate!=null?`${winRate}%`:'—'}</span><span className="vv-dc-l">{winRate!=null&&winRate>=60?'OPTIMAL':'TRACKING'}</span></div>
                  </div>
                  <div className="vv-pr">
                    <div className="vv-pr-r"><span className="vv-pk">Picks Tracked</span><span className="vv-pv">{pickHistory.length}</span></div>
                    <div className="vv-pr-r"><span className="vv-pk">Bookmakers</span><span className="vv-pv">{bookmakerCount}</span></div>
                    <div className="vv-pr-r"><span className="vv-pk">Accuracy</span><span className="vv-pv" style={{ color:'#39FF14' }}>{winRate!=null?`${winRate}%`:'—'}</span></div>
                    <div className="vv-pr-r"><span className="vv-pk">AI Confidence</span><span className="vv-pv">{aiConfidence!=null?`${aiConfidence}%`:'—'}</span></div>
                  </div>
                </div>
              </div>

              <div className="vv-glass vv-pad">
                <div className="vv-sys-top">
                  <div><div className="vv-card-ey">System Overview</div><div className="vv-card-t">All Core Systems</div></div>
                  <div className="vv-sys-pct">{games.length} games</div>
                </div>
                <ConfidenceChart history={confHistory} />
                <div className="vv-sys-mets">
                  <div className="vv-sys-m"><div className="vv-sys-mv">{games.filter(g=>g.sport==='MLB').length}</div><div className="vv-sys-mk">MLB</div></div>
                  <div className="vv-sys-m"><div className="vv-sys-mv">{games.filter(g=>g.sport==='NBA').length}</div><div className="vv-sys-mk">NBA</div></div>
                  <div className="vv-sys-m"><div className="vv-sys-mv">{games.filter(g=>g.sport==='NFL').length}</div><div className="vv-sys-mk">NFL</div></div>
                </div>
              </div>

              <div className="vv-glass vv-pad" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}><i className="ti ti-lock" style={{ fontSize:13,color:'#39FF14' }} /><span style={{ fontSize:11,fontWeight:800,color:'#111' }}>Vault Locks</span></div>
                <div style={{ fontSize:8,color:'#bbb',marginBottom:7,display:'flex',justifyContent:'space-between' }}><span>Tier 1 AI Lock Picks</span><span style={{ fontWeight:600,color:'#555' }}>{pickHistory.filter(p=>p.tier==='1').length} tracked</span></div>
                <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
                  {pickHistory.filter(p=>p.tier==='1').slice(-4).reverse().map((p,i)=>(
                    <div key={i} className="vv-vf-r">
                      <div className={`vv-vf-ic ${p.result==='win'?'g':p.result==='loss'?'r':'y'}`}>
                        <i className={`ti ${p.result==='win'?'ti-check':p.result==='loss'?'ti-x':'ti-clock'}`} style={{ color:p.result==='win'?'#2aa800':p.result==='loss'?'#e55':'#aa8800',fontSize:11 }} />
                      </div>
                      <div className="vv-vf-nm">{p.pick}</div>
                      <div className="vv-vf-tm">{p.result==='win'?'WIN':p.result==='loss'?'LOSS':'—'}</div>
                    </div>
                  ))}
                  {pickHistory.filter(p=>p.tier==='1').length===0 && <div style={{ fontSize:10,color:'#ccc',textAlign:'center',padding:'8px 0' }}>No locks tracked yet</div>}
                </div>
                <div className="vv-vf-va" onClick={()=>setShellView('analytics')}>View all locks →</div>
              </div>
            </div>

            {/* COLUMN 2: AI Core Orb, Icon Dock, Model Card */}
            <div className="vv-col">
              <div className="vv-glass-g vv-orb-card" style={{ flex:1, minHeight:0 }}>
                <div className="vv-oc-ey">Vegas Vault AI Core</div>
                <div className="vv-oc-title">4-Stage Analysis Engine</div>
                <div className="vv-oc-badge"><div className="vv-oc-dot"></div>ACTIVE</div>
                <div className="vv-orb-stage">
                  <div className="vv-orb-out"></div>
                  <div className="vv-orb-mid"></div>
                  <div className="vv-orb-glow-base"></div>
                  <div className="vv-orb-sphere">
                    <svg className="vv-orb-net" viewBox="0 0 158 158">
                      <circle cx="79" cy="79" r="68" fill="none" stroke="rgba(57,255,20,0.5)" strokeWidth="0.6"/>
                      <circle cx="79" cy="79" r="48" fill="none" stroke="rgba(57,255,20,0.4)" strokeWidth="0.5"/>
                      <line x1="79" y1="11" x2="79" y2="147" stroke="rgba(57,255,20,0.4)" strokeWidth="0.5"/>
                      <line x1="11" y1="79" x2="147" y2="79" stroke="rgba(57,255,20,0.4)" strokeWidth="0.5"/>
                      <line x1="26" y1="26" x2="132" y2="132" stroke="rgba(57,255,20,0.3)" strokeWidth="0.5"/>
                      <line x1="132" y1="26" x2="26" y2="132" stroke="rgba(57,255,20,0.3)" strokeWidth="0.5"/>
                      <circle cx="79" cy="11" r="3" fill="rgba(57,255,20,0.9)"/>
                      <circle cx="147" cy="79" r="3" fill="rgba(57,255,20,0.9)"/>
                      <circle cx="79" cy="147" r="3" fill="rgba(57,255,20,0.9)"/>
                      <circle cx="11" cy="79" r="3" fill="rgba(57,255,20,0.9)"/>
                      <circle cx="26" cy="26" r="2.5" fill="rgba(57,255,20,0.7)"/>
                      <circle cx="132" cy="26" r="2.5" fill="rgba(57,255,20,0.7)"/>
                      <circle cx="132" cy="132" r="2.5" fill="rgba(57,255,20,0.7)"/>
                      <circle cx="26" cy="132" r="2.5" fill="rgba(57,255,20,0.7)"/>
                    </svg>
                    <div className="vv-orb-core"><span className="vv-orb-ai">AI</span></div>
                  </div>
                  <div className="vv-orb-p1"></div>
                  <div className="vv-orb-p2"></div>
                  <div className="vv-orb-p3"></div>
                </div>
              </div>

              <div className="vv-glass vv-icon-dock">
                <div className="vv-dock-i" onClick={()=>shellNavigate('analyzer')}><i className="ti ti-target" /></div>
                <div className="vv-dock-i" onClick={()=>shellNavigate('vault')}><i className="ti ti-lock" /></div>
                <div className="vv-dock-i on"><i className="ti ti-hexagon" /></div>
                <div className="vv-dock-i" onClick={()=>shellNavigate('sharp')}><i className="ti ti-currency-dollar" /></div>
                <div className="vv-dock-i" onClick={()=>shellNavigate('props')}><i className="ti ti-diamond" /></div>
              </div>

              <div className="vv-glass vv-pad">
                <div className="vv-mc-box">
                  <div className="vv-mc-hd">
                    <div className="vv-mc-licon"><i className="ti ti-hexagon" /></div>
                    <div style={{ textAlign:'left' }}>
                      <div className="vv-mc-ey2">Active Model</div>
                      <div className="vv-mc-nm">Vegas Vault Analysis Engine <span className="vv-mc-pr">PREMIUM</span></div>
                    </div>
                  </div>
                  <div className="vv-mc-body">
                    <div className="vv-mc-3d"><i className="ti ti-cube-3d-sphere" /></div>
                    <div className="vv-mc-rows">
                      <div className="vv-mc-r"><span className="vv-mk">Sports:</span><span className="vv-mv">MLB · NBA · NFL · Tennis</span></div>
                      <div className="vv-mc-r"><span className="vv-mk">Status:</span><span className="vv-mv g">● Active</span></div>
                      <div className="vv-mc-r"><span className="vv-mk">Slot System:</span><span className="vv-mv">Public / Vegas</span></div>
                      <div className="vv-mc-r"><span className="vv-mk">Today's Date:</span><span className="vv-mv">{new Date(selectedDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>
                    </div>
                  </div>
                  <div className="vv-mc-link" onClick={()=>shellNavigate('settings')}>Model Settings <i className="ti ti-arrow-right" style={{ fontSize:11 }} /></div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: AI Assistant + Analytics */}
            <div className="vv-col">
              <div className="vv-glass vv-ai-card" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
                <div className="vv-ai-hd">
                  <div className="vv-ai-trow">
                    <div className="vv-ai-ic"><i className="ti ti-brain" /></div>
                    <div><div className="vv-ai-nm">Vegas Vault AI Assistant</div><div className="vv-ai-st"><div className="vv-ai-std"></div>Ready</div></div>
                  </div>
                  <i className="ti ti-dots" style={{ color:'#ccc',fontSize:13 }} />
                </div>
                <div className="vv-ai-bubble" style={{ flex:1, minHeight:0, overflowY:'auto' }}>
                  {topPlay && topPlay.summary ? (
                    <>
                      <p>Here's today's top play based on the full slate analysis:</p>
                      <div className="vv-ai-pt"><div className="vv-ai-ptd"></div><span><b>{topPlay.away} @ {topPlay.home}</b> — {topPlay.summary?.pick}</span></div>
                      <div className="vv-ai-pt"><div className="vv-ai-ptd"></div><span>Slot: {topPlay.slot} · Tier {topPlay.summary?.tier}</span></div>
                      <p style={{ marginTop:5 }}>{topPlay.summary?.verdict ? (topPlay.summary.verdict.length>110?topPlay.summary.verdict.slice(0,107)+'...':topPlay.summary.verdict) : ''}</p>
                    </>
                  ) : (
                    <p>Analyzing today's slate of {games.length} games across {new Set(games.map(g=>g.sport)).size} sports. Click ANALYZE on any game card to get the full breakdown.</p>
                  )}
                </div>
                <div className="vv-ai-inp">
                  <input type="text" placeholder="Ask follow-up..." />
                  <div className="vv-ai-snd"><i className="ti ti-arrow-right" style={{ color:'#111',fontSize:11 }} /></div>
                </div>
              </div>

              <div className="vv-glass vv-pad">
                <div className="vv-an-hd">
                  <div><div className="vv-card-ey">Vault Analytics</div><div className="vv-card-t">Pick Performance</div></div>
                  <select className="vv-an-sel"><option>All Time</option></select>
                </div>
                <ConfidenceChart history={confHistory} />
                <div className="vv-an-mets">
                  <div className="vv-anm"><div className="vv-anm-l">Total Picks</div><div className="vv-anm-v">{pickHistory.length}</div></div>
                  <div className="vv-anm"><div className="vv-anm-l">Win Rate</div><div className="vv-anm-v">{winRate!=null?`${winRate}%`:'—'}</div></div>
                  <div className="vv-anm"><div className="vv-anm-l">Wins</div><div className="vv-anm-v">{pickHistory.filter(p=>p.result==='win').length}</div></div>
                  <div className="vv-anm"><div className="vv-anm-l">Losses</div><div className="vv-anm-v">{pickHistory.filter(p=>p.result==='loss').length}</div></div>
                </div>
              </div>
            </div>

          </div>

          {/* FAR RIGHT: Games Slate */}
          <div className="vv-glass vv-slate">
            <div className="vv-gc-hd"><div className="vv-gc-t">Games Slate</div><i className="ti ti-dots" style={{ color:'#ccc',fontSize:13 }} /></div>
            <div className="vv-gc-sub">{new Date(selectedDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
            <div className="vv-sp-tabs">
              {['ALL',...new Set(games.map(g=>g.sport).filter(Boolean))].map(s=>(
                <div key={s} className={`vv-sp${filter===s?' on':''}`} onClick={()=>setFilter(s)}>{s}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ textAlign:'center',padding:'30px 0',color:'#ccc',fontSize:11 }}>
                <div style={{ width:20,height:20,border:'2px solid rgba(57,255,20,0.2)',borderTopColor:'#39FF14',borderRadius:'50%',margin:'0 auto 8px',animation:'spin 0.8s linear infinite' }} />
                Loading...
              </div>
            ) : games.filter(g=>filter==='ALL'||g.sport===filter).length===0 ? (
              <div style={{ textAlign:'center',padding:'30px 0',color:'#ccc',fontSize:11 }}>No games</div>
            ) : games.filter(g=>filter==='ALL'||g.sport===filter).map(game=>{
              const key = `${game.id}-${game.slot}`;
              const result = results[key];
              const summary = result?.summary;
              const tier = summary ? (TIER_STYLES[summary.tier]||TIER_STYLES["3"]) : null;
              const isPass = tier?.label === 'PASS' || tier?.label === 'TIER 3';
              const slotClass = game.slot==='VEGAS' ? 'v' : 'p';
              const fmtOdds = v => { if(!v||v==='N/A'||v==='null') return null; if(typeof v==='number') return v>0?`+${v}`:`${v}`; return v; };
              const pickOdds = summary ? (fmtOdds(game.dkAwayML)||fmtOdds(game.awayML)||'—') : null;
              return (
                <div key={key} className="vv-gr" onClick={()=>{ if(result) { setActiveGame(game); setActiveResult(result); setActiveDetailTab('AI Reasoning'); } else { handleGenerate(game, game.slot); } }}>
                  <div className="vv-gr-a">
                    <span className="vv-gr-t">
                      <img className="vv-gr-lg" src={`https://a.espncdn.com/i/teamlogos/${game.sport==='NBA'?'nba':game.sport==='NFL'?'nfl':'mlb'}/500/${(game.awayAbbr||'').toLowerCase()}.png`} alt="" onError={e=>e.target.style.display='none'} />
                      {game.awayAbbr} @ {game.homeAbbr}
                    </span>
                    <span className="vv-gr-time">{game.time}</span>
                    {tier && <span className="vv-gr-stars">{tier.label==='LOCK'?'★ 5':tier.label==='2'?'★ 4':'—'}</span>}
                  </div>
                  <div className="vv-gr-b">
                    {summary ? (
                      <>
                        <span className="vv-gr-pick" style={{ color: isPass ? '#ccc' : '#111' }}>{summary.pick}</span>
                        <span className="vv-gr-odds">{pickOdds}</span>
                      </>
                    ) : (
                      <span className="vv-gr-pick" style={{ color:'#bbb', fontSize:10 }}>Click to analyze</span>
                    )}
                    {hasSlotPattern && (
                      <span className={`vv-sl ${isPass?'pass':slotClass}`}>{isPass?'PASS':game.slot==='VEGAS'?'Vegas Slot':'Public Slot'}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="vv-gc-va" onClick={()=>setShellView('analytics')}>View pick history <i className="ti ti-arrow-right" style={{ fontSize:10 }} /></div>
          </div>

        </div>
      )}

      {/* ── GAMES SLATE — full grid page ── */}
      {authUser && isSubscribed && shellView === 'slate' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1, minHeight:0, overflowY:'auto' }}>

          <TopPlayBanner
            topPlay={topPlay}
            loading={topPlayLoading}
            results={results}
            pickHistory={pickHistory}
            isSubscribed={isSubscribed}
            isAdmin={shellIsAdmin}
            watchlist={watchlist}
            onToggleWatch={(id)=>setWatchlist(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
            onForceRefresh={null}
          />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#111', letterSpacing:-0.3 }}>Games Slate</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                {new Date(selectedDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                {' · '}{games.length} games
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <button onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()-1);setSelectedDate(d.toISOString().split('T')[0]);}}
                  style={{ width:30, height:30, borderRadius:9, border:'1px solid rgba(0,0,0,0.07)', background:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>
                  <i className="ti ti-chevron-left" style={{ fontSize:14 }} />
                </button>
                <button onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()+1);setSelectedDate(d.toISOString().split('T')[0]);}}
                  style={{ width:30, height:30, borderRadius:9, border:'1px solid rgba(0,0,0,0.07)', background:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>
                  <i className="ti ti-chevron-right" style={{ fontSize:14 }} />
                </button>
              </div>
              {['ALL',...new Set(games.map(g=>g.sport).filter(Boolean))].map(s=>(
                <button key={s} onClick={()=>setFilter(s)}
                  style={{ fontSize:11, fontWeight:700, padding:'6px 14px', borderRadius:14, border:filter===s?'1px solid #39FF14':'1px solid rgba(0,0,0,0.07)', background:filter===s?'#39FF14':'rgba(255,255,255,0.7)', color:filter===s?'#111':'#999', cursor:'pointer', boxShadow:filter===s?'0 0 8px rgba(57,255,20,0.3)':'none' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {shellIsAdmin && (
            <div style={{ background:'rgba(255,255,255,0.62)', border:'1px solid rgba(57,255,20,0.28)', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#111,#333)', padding:'2px 9px', borderRadius:6, letterSpacing:1 }}>ADMIN</span>
              <span style={{ fontSize:11, fontWeight:600, color:'#555' }}>Slot Pattern Manager</span>
              <button onClick={()=>window.location.href='/settings'}
                style={{ fontSize:10, fontWeight:700, padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#39FF14,#22cc00)', border:'none', color:'#111', cursor:'pointer', marginLeft:'auto' }}>
                <i className="ti ti-settings" style={{ fontSize:12, marginRight:4 }} />Open Settings
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa', fontSize:13 }}>
              <div style={{ width:32, height:32, border:'3px solid rgba(57,255,20,0.2)', borderTopColor:'#39FF14', borderRadius:'50%', margin:'0 auto 12px', animation:'spin 0.8s linear infinite' }} />
              Loading today's games...
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:12 }}>
              {games.filter(g=>filter==='ALL'||g.sport===filter).map(game=>{
                const key = `${game.id}-${game.slot}`;
                return (
                  <GameCard
                    key={key}
                    game={game}
                    onGenerate={handleGenerate}
                    results={results}
                    generating={generating}
                    onCardClick={(g,r)=>{setActiveGame(g);setActiveResult(r);setActiveDetailTab('AI Reasoning');}}
                    liveScores={liveScores}
                    isSubscribed={isSubscribed}
                    finalized={finalized}
                    isQueued={preAnalyzeQueue.includes(key)}
                    betReady={!!betReadyAlerts[key]}
                    onShowAuth={()=>setShowAuth(true)}
                    watchlist={watchlist}
                    onToggleWatch={(id)=>setWatchlist(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                    pickHistory={pickHistory}
                    hasSlotPattern={hasSlotPattern}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VAULT — saved/bookmarked plays ── */}
      {authUser && isSubscribed && shellView === 'vault' && (() => {
        const vaultGames = games.filter(g => watchlist.includes(g.id));
        return (
        <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1, minHeight:0, overflowY:'auto' }}>
          <div className="vv-glass" style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#111', letterSpacing:-0.3 }}>Vault</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{vaultGames.length} saved {vaultGames.length===1?'play':'plays'}</div>
            </div>
            <i className="ti ti-shield" style={{ fontSize:18, color:'#39FF14' }} />
          </div>

          {vaultGames.length === 0 ? (
            <div className="vv-glass" style={{ padding:'60px 20px', textAlign:'center' }}>
              <i className="ti ti-shield-half" style={{ fontSize:32, color:'#ddd', marginBottom:10, display:'block' }} />
              <div style={{ fontSize:13, fontWeight:700, color:'#999', marginBottom:4 }}>No saved plays yet</div>
              <div style={{ fontSize:11, color:'#bbb' }}>Tap the star on any game or "Add to Vault" in the game detail to save it here.</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:12 }}>
              {vaultGames.map(game=>{
                const key = `${game.id}-${game.slot}`;
                return (
                  <GameCard
                    key={key}
                    game={game}
                    onGenerate={handleGenerate}
                    results={results}
                    generating={generating}
                    onCardClick={(g,r)=>{setActiveGame(g);setActiveResult(r);setActiveDetailTab('AI Reasoning');}}
                    liveScores={liveScores}
                    isSubscribed={isSubscribed}
                    finalized={finalized}
                    isQueued={preAnalyzeQueue.includes(key)}
                    betReady={!!betReadyAlerts[key]}
                    onShowAuth={()=>setShowAuth(true)}
                    watchlist={watchlist}
                    onToggleWatch={(id)=>setWatchlist(p=>{const u=p.includes(id)?p.filter(x=>x!==id):[...p,id];if(authUser?.id)syncSave(authUser.id,'watchlist',u);return u;})}
                    pickHistory={pickHistory}
                    hasSlotPattern={hasSlotPattern}
                  />
                );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* ── ANALYTICS — pick history & performance (V7) ── */}
      {authUser && isSubscribed && shellView === 'analytics' && (() => {
        const wins = pickHistory.filter(p=>p.result==='win').length;
        const losses = pickHistory.filter(p=>p.result==='loss').length;
        const total = wins + losses;
        const rate = total > 0 ? Math.round((wins/total)*100) : 0;

        // Last 7 days
        const sevenDaysAgo = Date.now() - 7*24*60*60*1000;
        const recent = pickHistory.filter(p => p.resolvedAt && new Date(p.resolvedAt).getTime() >= sevenDaysAgo && (p.result==='win'||p.result==='loss'));
        const recentWins = recent.filter(p=>p.result==='win').length;
        const recentTotal = recent.length;
        const recentRate = recentTotal > 0 ? Math.round((recentWins/recentTotal)*100) : null;

        // Best streak
        let bestStreak = 0, curStreak = 0;
        [...pickHistory].forEach(p => {
          if (p.result === 'win') { curStreak++; bestStreak = Math.max(bestStreak, curStreak); }
          else if (p.result === 'loss') { curStreak = 0; }
        });

        const sports = [...new Set(pickHistory.map(p=>p.sport).filter(Boolean))];
        const filterTabs = ['All','Wins','Losses','Pending',...sports];
        const filtered = [...pickHistory].reverse().filter(p => {
          if (analyticsFilter === 'All') return true;
          if (analyticsFilter === 'Wins') return p.result === 'win';
          if (analyticsFilter === 'Losses') return p.result === 'loss';
          if (analyticsFilter === 'Pending') return p.result !== 'win' && p.result !== 'loss';
          return p.sport === analyticsFilter;
        });

        return (
        <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1, minHeight:0, overflowY:'auto' }}>

          <div className="vv-glass" style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#111', letterSpacing:-0.3 }}>My Picks History</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{pickHistory.length} total picks tracked</div>
            </div>
            {pickHistory.length > 0 && (
              <button onClick={()=>{if(window.confirm('Clear all pick history?')){setPickHistory([]);if(authUser?.id)syncDelete(authUser.id,'pick_history');}}}
                style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'#dd4444', background:'rgba(255,80,80,0.07)', border:'1px solid rgba(255,80,80,0.2)', padding:'9px 16px', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>
                <i className="ti ti-trash" style={{ fontSize:13 }} />Clear History
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            <div className="vv-glass-g" style={{ padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.7px', color:'#bbb', marginBottom:4, fontWeight:600 }}>All Time</div>
              <div style={{ fontSize:24, fontWeight:900, color: total===0?'#999':rate>=60?'#33aa00':rate>=50?'#bb8800':'#dd4444' }}>{total===0?'—':`${rate}%`}</div>
              <div style={{ fontSize:10, color:'#aaa', marginTop:3 }}>{wins}W - {losses}L</div>
            </div>
            <div className="vv-glass" style={{ padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.7px', color:'#bbb', marginBottom:4, fontWeight:600 }}>Last 7 Days</div>
              <div style={{ fontSize:24, fontWeight:900, color: recentRate===null?'#999':recentRate>=60?'#33aa00':recentRate>=50?'#bb8800':'#dd4444' }}>{recentRate===null?'—':`${recentRate}%`}</div>
              <div style={{ fontSize:10, color:'#aaa', marginTop:3 }}>{recentWins}W - {recentTotal-recentWins}L</div>
            </div>
            <div className="vv-glass" style={{ padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.7px', color:'#bbb', marginBottom:4, fontWeight:600 }}>Total Picks</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#111' }}>{pickHistory.length}</div>
              <div style={{ fontSize:10, color:'#aaa', marginTop:3 }}>tracked</div>
            </div>
            <div className="vv-glass" style={{ padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.7px', color:'#bbb', marginBottom:4, fontWeight:600 }}>Best Streak</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#5588ee' }}>{bestStreak>0?`${bestStreak}W`:'—'}</div>
              <div style={{ fontSize:10, color:'#aaa', marginTop:3 }}>in a row</div>
            </div>
          </div>

          <div className="vv-glass" style={{ padding:'14px 16px', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {filterTabs.map(t=>(
                <div key={t} onClick={()=>setAnalyticsFilter(t)}
                  style={{ fontSize:10, fontWeight:700, padding:'6px 14px', borderRadius:9, cursor:'pointer',
                    border: analyticsFilter===t ? '1px solid #39FF14' : '1px solid rgba(0,0,0,0.07)',
                    background: analyticsFilter===t ? '#39FF14' : 'rgba(255,255,255,0.7)',
                    color: analyticsFilter===t ? '#111' : '#999',
                    boxShadow: analyticsFilter===t ? '0 0 10px rgba(57,255,20,0.35)' : 'none' }}>
                  {t}
                </div>
              ))}
            </div>

            <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px', color:'#aaa', fontSize:12 }}>No picks {analyticsFilter==='All'?'tracked yet':`matching "${analyticsFilter}"`}</div>
              ) : filtered.map((pick,i)=>{
                const isWin = pick.result==='win';
                const isLoss = pick.result==='loss';
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 14px', borderRadius:12, marginBottom:8,
                    background: isWin?'rgba(57,255,20,0.05)':isLoss?'rgba(255,80,80,0.04)':'rgba(255,255,255,0.5)',
                    border: `1px solid ${isWin?'rgba(57,255,20,0.25)':isLoss?'rgba(255,80,80,0.2)':'rgba(0,0,0,0.05)'}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                        {hasSlotPattern && (
                          <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:5, background:pick.slot==='VEGAS'?'rgba(57,255,20,0.08)':'rgba(80,140,255,0.08)', color:pick.slot==='VEGAS'?'#2aa800':'#5588ee' }}>{pick.slot||'PUBLIC'}</span>
                        )}
                        <span style={{ fontSize:12, fontWeight:700, color:'#111' }}>{pick.pick}</span>
                        <span style={{ fontSize:10, color:'#aaa' }}>{pick.betType}</span>
                      </div>
                      <div style={{ fontSize:10, color:'#999' }}>{pick.game}</div>
                      {pick.score && <div style={{ fontSize:9, color:'#bbb' }}>Final: {pick.score}</div>}
                      <div style={{ fontSize:8, color:'#ccc', marginTop:3 }}>{pick.resolvedAt?new Date(pick.resolvedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):pick.date}</div>
                    </div>
                    <div style={{ flexShrink:0, fontSize:12, fontWeight:800, padding:'6px 14px', borderRadius:8,
                      background: isWin?'rgba(57,255,20,0.12)':isLoss?'rgba(255,80,80,0.1)':'rgba(0,0,0,0.03)',
                      border: `1px solid ${isWin?'rgba(57,255,20,0.3)':isLoss?'rgba(255,80,80,0.3)':'rgba(0,0,0,0.06)'}`,
                      color: isWin?'#33aa00':isLoss?'#dd4444':'#999' }}>
                      {isWin?'✅ WIN':isLoss?'❌ LOSS':'PENDING'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── GAME DETAIL MODAL ── */}

      {/* ── GAME DETAIL MODAL ── */}
      {activeGame && activeResult && (() => {
        const game = activeGame;
        const result = activeResult;
        const summary = result?.summary || {};
        const analysis = result?.analysis || {};
        const isVegas = game.slot === 'VEGAS';
        const isTennis = game.sport === 'Tennis';
        const conf = CONF_STYLES[summary.confidence] || CONF_STYLES.MEDIUM;
        const tierStyle = TIER_STYLES[summary.tier] || TIER_STYLES["3"];
        const ringCirc = 2 * Math.PI * 26;
        const ringOffset = ringCirc * (1 - conf.ring);

        // Reasoning bullets pulled from real analysis fields (no invented stats)
        const reasoningOrder = ['matchupFoundation','pitching','hitterLineup','recentForm','headToHead','situational','sharpMoney','propaganda','gameScript'];
        const reasoningBullets = reasoningOrder
          .map(k => analysis[k])
          .filter(v => v && typeof v === 'string' && v.length > 0 && v !== 'N/A')
          .slice(0, 6);

        const fmtOdds = v => { if(!v||v==='N/A'||v==='null') return null; if(typeof v==='number') return v>0?`+${v}`:`${v}`; return v; };
        const pickOdds = fmtOdds(game.dkAwayML) || fmtOdds(game.awayML) || fmtOdds(game.dkHomeML) || fmtOdds(game.homeML);
        const awayOdds = fmtOdds(game.dkAwayML) || fmtOdds(game.awayML) || '—';
        const homeOdds = fmtOdds(game.dkHomeML) || fmtOdds(game.homeML) || '—';
        const spreadVal = game.dkSpread || game.spread || '—';
        const totalVal  = game.dkTotal  || game.total  || '—';
        const awaySpread = (() => { if(spreadVal==='—') return '—'; const n=parseFloat(spreadVal); if(isNaN(n)) return spreadVal; return n>0?`-${n.toFixed(1)}`:`+${Math.abs(n).toFixed(1)}`; })();
        const hasMovement = game.lineMovement && !['No significant movement','N/A','No significant movement detected'].includes(game.lineMovement);

        const TABS = ['AI Reasoning','Matchup & Stats','Odds & Sharp Money','Injury & Weather','Scam Play','Line Movement','Series Context'];
        const activeTab = activeDetailTab || 'AI Reasoning';

        return (
          <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setActiveGame(null)}>
            <div style={{ background:'#fff',borderRadius:20,width:'100%',maxWidth:780,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(0,0,0,0.15)' }}>

              {/* Header */}
              <div style={{ padding:'16px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                  <div onClick={()=>setActiveGame(null)} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#999',cursor:'pointer',fontWeight:600 }}>
                    <i className="ti ti-arrow-left" style={{ fontSize:13 }} /> Back to Games Slate
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div onClick={()=>setWatchlist(p=>{const u=p.includes(game.id)?p.filter(x=>x!==game.id):[...p,game.id];if(authUser?.id)syncSave(authUser.id,'watchlist',u);return u;})} style={{ fontSize:10,fontWeight:700,cursor:'pointer',
                      color: watchlist?.includes(game.id) ? '#2aa800' : '#666',
                      background: watchlist?.includes(game.id) ? 'rgba(57,255,20,0.1)' : 'rgba(0,0,0,0.04)',
                      border: watchlist?.includes(game.id) ? '1px solid rgba(57,255,20,0.25)' : '1px solid rgba(0,0,0,0.07)',
                      borderRadius:8,padding:'6px 12px',display:'flex',alignItems:'center',gap:5 }}>
                      <i className={watchlist?.includes(game.id) ? "ti ti-folder-check" : "ti ti-folder-plus"} style={{ fontSize:12 }} />
                      {watchlist?.includes(game.id) ? 'In Vault' : 'Add to Vault'}
                    </div>
                    <button onClick={()=>setActiveGame(null)} style={{ width:32,height:32,borderRadius:8,border:'1px solid rgba(0,0,0,0.07)',background:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',color:'#666' }}>✕</button>
                  </div>
                </div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
                  {!isTennis ? (
                    <>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:15,fontWeight:800,color:'#111' }}>{game.away}</div>
                        <div style={{ fontSize:9,color:'#bbb' }}>{game.awayRecord}</div>
                      </div>
                      <div style={{ textAlign:'center',flex:1 }}>
                        <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>{game.away} @ {game.home}</div>
                        <div style={{ fontSize:10,color:'#aaa',marginTop:2 }}>{game.time}{game.venue?` · ${game.venue}`:''}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:15,fontWeight:800,color:'#111' }}>{game.home}</div>
                        <div style={{ fontSize:9,color:'#bbb' }}>{game.homeRecord}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign:'center',flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>{game.player1} vs {game.player2}</div>
                      <div style={{ fontSize:10,color:'#aaa',marginTop:2 }}>{game.time}{game.tournament?` · ${game.tournament}`:''}</div>
                    </div>
                  )}
                </div>
                <div style={{ display:'flex',gap:8,marginTop:10 }}>
                  <span style={{ fontSize:9,fontWeight:800,padding:'4px 10px',borderRadius:6,background:tierStyle.bg||'rgba(57,255,20,0.1)',color:tierStyle.text||'#33aa00',border:`1px solid ${tierStyle.border||'rgba(57,255,20,0.25)'}` }}>
                    {summary.tier==='1'?'🔒 LOCK':summary.tier==='2'?'★★★★ TIER 2':'PASS'}
                  </span>
                  {hasSlotPattern && (
                    <span style={{ fontSize:9,fontWeight:800,padding:'4px 10px',borderRadius:6,background:isVegas?'rgba(57,255,20,0.1)':'rgba(80,140,255,0.08)',color:isVegas?'#2aa800':'#5588ee',border:isVegas?'1px solid rgba(57,255,20,0.25)':'1px solid rgba(80,140,255,0.2)' }}>
                      {isVegas?'VEGAS SLOT':'PUBLIC SLOT'}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display:'flex',gap:4,padding:'8px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)',flexWrap:'wrap' }}>
                {TABS.map(t=>(
                  <div key={t} onClick={()=>setActiveDetailTab(t)}
                    style={{ fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:9,cursor:'pointer',color:activeTab===t?'#111':'#aaa',background:activeTab===t?'#39FF14':'transparent',boxShadow:activeTab===t?'0 0 8px rgba(57,255,20,0.3)':'none' }}>
                    {t}
                  </div>
                ))}
              </div>

              <div style={{ padding:'16px 20px' }}>

                {/* AI Reasoning tab */}
                {activeTab === 'AI Reasoning' && (
                  <>
                    <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                      <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:10,display:'flex',alignItems:'center',gap:8 }}>
                        AI Reasoning
                        <span style={{ fontSize:7,fontWeight:700,color:'#39FF14',border:'1px solid rgba(57,255,20,0.3)',padding:'2px 6px',borderRadius:5,background:'rgba(57,255,20,0.05)' }}>VEGAS VAULT AI</span>
                      </div>
                      {reasoningBullets.length === 0 ? (
                        <div style={{ fontSize:11,color:'#bbb' }}>No reasoning available.</div>
                      ) : reasoningBullets.map((txt,i)=>(
                        <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:8,marginBottom:8 }}>
                          <div style={{ width:18,height:18,borderRadius:5,background:'rgba(57,255,20,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
                            <i className="ti ti-check" style={{ fontSize:11,color:'#33aa00' }} />
                          </div>
                          <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{txt}</div>
                        </div>
                      ))}
                      {summary.verdict && (
                        <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid rgba(0,0,0,0.05)' }}>
                          <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Bottom Line</div>
                          <div style={{ fontSize:12,color:'#444',lineHeight:1.6 }}>{summary.verdict}</div>
                        </div>
                      )}
                    </div>

                    {/* Recommendation card */}
                    <div style={{ background:'rgba(255,255,255,0.62)',border:'1px solid rgba(57,255,20,0.28)',borderRadius:14,padding:'14px 16px' }}>
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111' }}>AI Play Recommendation</div>
                        <span style={{ fontSize:7,fontWeight:700,color:'#39FF14',border:'1px solid rgba(57,255,20,0.3)',padding:'2px 6px',borderRadius:5,background:'rgba(57,255,20,0.05)' }}>VEGAS VAULT AI</span>
                      </div>
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
                        <div>
                          <div style={{ fontSize:18,fontWeight:900,color:'#111',display:'flex',alignItems:'center',gap:8 }}>
                            {summary.pick}
                            {summary.tier==='1' && <span style={{ fontSize:8,fontWeight:800,color:'#111',background:'#39FF14',padding:'2px 8px',borderRadius:6 }}>AI LOCK</span>}
                          </div>
                          <div style={{ fontSize:13,color:'#aaa',marginTop:2 }}>{summary.betType}{pickOdds?` · ${pickOdds}`:''}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9,color:'#aaa',marginBottom:4 }}>Confidence</div>
                          <div style={{ position:'relative',width:64,height:64 }}>
                            <svg width="64" height="64" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(57,255,20,0.13)" strokeWidth="6"/>
                              <circle cx="32" cy="32" r="26" fill="none" stroke={conf.color} strokeWidth="6" strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 32 32)"/>
                            </svg>
                            <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#111' }}>{summary.confidence||'—'}</div>
                          </div>
                          <div style={{ fontSize:8,fontWeight:800,color:conf.color,marginTop:4,letterSpacing:'0.5px' }}>{conf.text}</div>
                        </div>
                      </div>
                      {summary.signalCount && (
                        <div style={{ marginTop:10,fontSize:10,color:'#666',background:'rgba(255,255,255,0.6)',border:'1px solid rgba(0,0,0,0.05)',borderRadius:8,padding:'8px 12px' }}>
                          <i className="ti ti-bolt" style={{ fontSize:12,color:'#39FF14',marginRight:5 }} />{summary.signalCount} signals point to this pick
                        </div>
                      )}
                      <div style={{ display:'flex',gap:8,marginTop:12 }}>
                        <button onClick={()=>{handleGenerate(game,game.slot);setActiveGame(null);}} style={{ flex:1,padding:'10px',borderRadius:9,border:'1px solid rgba(57,255,20,0.25)',background:'rgba(57,255,20,0.07)',color:'#33aa00',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                          <i className="ti ti-refresh" style={{ fontSize:13 }} /> Re-analyze
                        </button>
                        <button onClick={()=>setWatchlist(p=>{const u=p.includes(game.id)?p.filter(x=>x!==game.id):[...p,game.id];if(authUser?.id)syncSave(authUser.id,'watchlist',u);return u;})} style={{ flex:1,padding:'10px',borderRadius:9,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                          border: watchlist?.includes(game.id) ? '1px solid rgba(57,255,20,0.25)' : '1px solid rgba(0,0,0,0.07)',
                          background: watchlist?.includes(game.id) ? 'rgba(57,255,20,0.07)' : 'rgba(255,255,255,0.7)',
                          color: watchlist?.includes(game.id) ? '#2aa800' : '#555' }}>
                          <i className={watchlist?.includes(game.id) ? "ti ti-folder-check" : "ti ti-folder-plus"} style={{ fontSize:13 }} /> {watchlist?.includes(game.id) ? 'In Vault' : 'Add to Vault'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Matchup & Stats tab */}
                {activeTab === 'Matchup & Stats' && (
                  <>
                    {/* Starting Pitchers (MLB) */}
                    {!isTennis && (game.awayPitcher || game.homePitcher) && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                          <i className="ti ti-baseball" style={{ fontSize:13,color:'#33aa00' }} /> Starting Pitchers
                        </div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                          <div style={{ padding:'10px 12px',background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10 }}>
                            <div style={{ fontSize:8,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3 }}>{game.away}</div>
                            <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>{game.awayPitcher || 'TBD'}</div>
                            {game.awayPitcherStats && <div style={{ fontSize:10,color:'#777',marginTop:4,lineHeight:1.6 }}>{game.awayPitcherStats}</div>}
                            {game.awayPitcherVsOpponent && game.awayPitcherVsOpponent!=='N/A' && <div style={{ fontSize:10,color:'#999',marginTop:4 }}>vs {game.home}: {game.awayPitcherVsOpponent}</div>}
                          </div>
                          <div style={{ padding:'10px 12px',background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10 }}>
                            <div style={{ fontSize:8,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3 }}>{game.home}</div>
                            <div style={{ fontSize:13,fontWeight:800,color:'#111' }}>{game.homePitcher || 'TBD'}</div>
                            {game.homePitcherStats && <div style={{ fontSize:10,color:'#777',marginTop:4,lineHeight:1.6 }}>{game.homePitcherStats}</div>}
                            {game.homePitcherVsOpponent && game.homePitcherVsOpponent!=='N/A' && <div style={{ fontSize:10,color:'#999',marginTop:4 }}>vs {game.away}: {game.homePitcherVsOpponent}</div>}
                          </div>
                        </div>
                        {analysis.pitching && <div style={{ marginTop:10,fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.pitching}</div>}
                      </div>
                    )}

                    {/* Team Comparison / Records */}
                    {!isTennis && (game.awayRecord || game.homeRecord) && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                          <i className="ti ti-chart-bar" style={{ fontSize:13,color:'#33aa00' }} /> Team Comparison
                        </div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                          <div style={{ padding:'10px 12px',background:'rgba(255,255,255,0.6)',border:'1px solid rgba(0,0,0,0.05)',borderRadius:10 }}>
                            <div style={{ fontSize:8,color:'#bbb',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5 }}>{game.away}</div>
                            <div style={{ fontSize:10,color:'#555',lineHeight:1.8 }}>
                              <div>Overall: <b>{game.awayRecord || '—'}</b></div>
                              <div>Home / Away: <b>{game.awayHomeRecord || '—'} / {game.awayAwayRecord || '—'}</b></div>
                              <div>L5: <b>{game.awayLast5 || '—'}</b> · L10: <b>{game.awayLast10 || '—'}</b></div>
                              {game.awayStreak && <div>Streak: <b>{game.awayStreak}</b></div>}
                              {game.awayATS && game.awayATS!=='N/A' && <div>ATS: <b>{game.awayATS}</b></div>}
                            </div>
                          </div>
                          <div style={{ padding:'10px 12px',background:'rgba(255,255,255,0.6)',border:'1px solid rgba(0,0,0,0.05)',borderRadius:10 }}>
                            <div style={{ fontSize:8,color:'#bbb',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5 }}>{game.home}</div>
                            <div style={{ fontSize:10,color:'#555',lineHeight:1.8 }}>
                              <div>Overall: <b>{game.homeRecord || '—'}</b></div>
                              <div>Home / Away: <b>{game.homeHomeRecord || '—'} / {game.homeAwayRecord || '—'}</b></div>
                              <div>L5: <b>{game.homeLast5 || '—'}</b> · L10: <b>{game.homeLast10 || '—'}</b></div>
                              {game.homeStreak && <div>Streak: <b>{game.homeStreak}</b></div>}
                              {game.homeATS && game.homeATS!=='N/A' && <div>ATS: <b>{game.homeATS}</b></div>}
                            </div>
                          </div>
                        </div>
                        {analysis.recentForm && <div style={{ marginTop:10,fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.recentForm}</div>}
                      </div>
                    )}

                    {/* Matchup Truth */}
                    {analysis.matchupFoundation && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                          <i className="ti ti-versus" style={{ fontSize:13,color:'#33aa00' }} /> Matchup Truth
                        </div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.7 }}>{analysis.matchupFoundation}</div>
                      </div>
                    )}

                    {/* H2H */}
                    {(analysis.headToHead || game.h2hLast5) && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                          <i className="ti ti-swords" style={{ fontSize:13,color:'#33aa00' }} /> Head to Head
                        </div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.7 }}>{analysis.headToHead || game.h2hLast5}</div>
                        {game.h2hAtHome && game.h2hAtHome !== game.h2hLast5 && (
                          <div style={{ marginTop:8,paddingTop:8,borderTop:'1px solid rgba(0,0,0,0.05)',fontSize:10,color:'#999' }}>Last time at {game.home}: {game.h2hAtHome}</div>
                        )}
                      </div>
                    )}

                    {/* Lineups & Hitters (MLB) */}
                    {!isTennis && analysis.hitterLineup && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px' }}>
                        <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                          <i className="ti ti-bat" style={{ fontSize:13,color:'#33aa00' }} /> Lineups & Hitters
                        </div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.7 }}>{analysis.hitterLineup}</div>
                      </div>
                    )}
                  </>
                )}

                {/* Odds & Sharp Money tab */}
                {activeTab === 'Odds & Sharp Money' && (
                  <>
                    {!isTennis && (game.awayML||game.homeML||game.dkAwayML||game.dkHomeML) && (
                      <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
                          <span style={{ fontSize:8,fontWeight:700,color:'#5588ee',background:'rgba(80,140,255,0.08)',border:'1px solid rgba(80,140,255,0.2)',borderRadius:3,padding:'1px 6px',letterSpacing:'0.06em' }}>DK</span>
                          <span style={{ fontSize:11,fontWeight:800,color:'#111' }}>DraftKings Odds</span>
                        </div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
                          {[
                            { label:'Moneyline', left:awayOdds, right:homeOdds, color:(v)=>v.startsWith('-')?'#dd4444':'#33aa00' },
                            { label:game.sport==='MLB'?'Run Line':'Spread', left:awaySpread, right:spreadVal, color:()=>'#555' },
                            { label:'Total', left:totalVal!=='—'?'o'+totalVal:'—', right:totalVal!=='—'?'u'+totalVal:'—', color:()=>'#5588ee' },
                          ].map(({label,left,right,color})=>(
                            <div key={label} style={{ background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10,padding:'10px 0',textAlign:'center' }}>
                              <div style={{ fontSize:8,color:'#bbb',textTransform:'uppercase',letterSpacing:'0.6px',fontWeight:700,marginBottom:5 }}>{label}</div>
                              <div style={{ display:'flex',justifyContent:'space-around' }}>
                                <span style={{ fontSize:13,fontWeight:700,color:color(left) }}>{left}</span>
                                <span style={{ fontSize:13,fontWeight:700,color:color(right) }}>{right}</span>
                              </div>
                              <div style={{ display:'flex',justifyContent:'space-around',marginTop:3 }}>
                                <span style={{ fontSize:8,color:'#aaa' }}>{game.away}</span>
                                <span style={{ fontSize:8,color:'#aaa' }}>{game.home}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ background:'rgba(240,248,255,0.5)',border:'1px solid rgba(80,140,255,0.25)',borderRadius:14,padding:'14px 16px' }}>
                      <div style={{ fontSize:11,fontWeight:800,color:'#5588ee',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                        <i className="ti ti-currency-dollar" style={{ fontSize:14 }} /> Sharp Money
                      </div>
                      {game.sharpSignal && (
                        <div style={{ fontSize:10,color:'#789',marginBottom:8 }}>Sharp Signal: <b>{game.sharpSignal}</b></div>
                      )}
                      {hasMovement && (
                        <div style={{ fontSize:11,color:'#456',lineHeight:1.7,marginBottom:analysis.sharpMoney?8:0 }}>
                          <i className="ti ti-bolt" style={{ fontSize:12,color:'#5588ee',marginRight:5 }} />{game.lineMovement}
                        </div>
                      )}
                      {analysis.sharpMoney ? (
                        <div style={{ fontSize:11,color:'#456',lineHeight:1.7 }}>{analysis.sharpMoney}</div>
                      ) : !hasMovement && !game.sharpSignal && (
                        <div style={{ fontSize:11,color:'#bbb' }}>No sharp action data available.</div>
                      )}
                    </div>
                  </>
                )}

                {/* Injury & Weather tab */}
                {activeTab === 'Injury & Weather' && (
                  <>
                    <div style={{ background:'rgba(255,250,235,0.5)',border:'1px solid rgba(255,150,0,0.35)',borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
                      <div style={{ fontSize:11,fontWeight:800,color:'#bb6600',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                        <i className="ti ti-first-aid-kit" style={{ fontSize:14 }} /> Injury Impact
                      </div>
                      {game.injuries ? (
                        <div style={{ fontSize:11,color:'#664400',lineHeight:1.7 }}>{typeof game.injuries==='object'?JSON.stringify(game.injuries):game.injuries}</div>
                      ) : (
                        <div style={{ fontSize:11,color:'#bbb' }}>No injury report available.</div>
                      )}
                    </div>
                    <div style={{ background:'rgba(240,248,255,0.5)',border:'1px solid rgba(80,140,255,0.25)',borderRadius:14,padding:'14px 16px' }}>
                      <div style={{ fontSize:11,fontWeight:800,color:'#5588ee',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                        <i className="ti ti-cloud" style={{ fontSize:14 }} /> Weather
                      </div>
                      {game.weather ? (
                        <div style={{ fontSize:11,color:'#456',lineHeight:1.7 }}>{typeof game.weather==='object'?JSON.stringify(game.weather):game.weather}</div>
                      ) : (
                        <div style={{ fontSize:11,color:'#bbb' }}>No weather data — indoor or unavailable.</div>
                      )}
                    </div>
                  </>
                )}

                {/* Scam Play tab */}
                {activeTab === 'Scam Play' && (
                  <div style={{ background:'rgba(255,250,235,0.5)',border:'1px solid rgba(255,150,0,0.35)',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontSize:11,fontWeight:800,color:'#bb6600',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize:14 }} /> Scam Play Alert
                      {hasSlotPattern && (
                        <span style={{ fontSize:8,fontWeight:700,color:'#cc7700',border:'1px solid rgba(255,150,0,0.3)',padding:'2px 7px',borderRadius:5,background:'rgba(255,150,0,0.05)',marginLeft:'auto' }}>
                          {isVegas ? 'Vegas Slot' : 'Public Slot'}
                        </span>
                      )}
                    </div>
                    {isVegas ? (
                      analysis.scamPlay && analysis.scamPlay !== 'N/A' ? (
                        <div style={{ fontSize:12,color:'#664400',lineHeight:1.7 }}>{analysis.scamPlay}</div>
                      ) : (
                        <div style={{ fontSize:11,color:'#bbb' }}>No scam play identified for this game.</div>
                      )
                    ) : (
                      <div style={{ fontSize:11,color:'#888',lineHeight:1.6 }}>
                        This is a Public Slot — scams are still possible but the expected outcome is more likely here. {analysis.scamPlay && analysis.scamPlay !== 'N/A' ? analysis.scamPlay : ''}
                      </div>
                    )}
                    {analysis.propaganda && (
                      <div style={{ marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,150,0,0.2)' }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#bb6600',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Propaganda Check</div>
                        <div style={{ fontSize:11,color:'#664400',lineHeight:1.6 }}>{analysis.propaganda}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Line Movement tab */}
                {activeTab === 'Line Movement' && (
                  <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:10 }}>Line Movement</div>
                    {game.lineMovement && !['No significant movement','N/A','No significant movement detected'].includes(game.lineMovement) ? (
                      <div style={{ fontSize:12,color:'#444',lineHeight:1.7,background:'rgba(246,249,246,0.7)',border:'1px solid rgba(195,240,195,0.5)',borderRadius:10,padding:'12px 14px' }}>
                        <i className="ti ti-bolt" style={{ fontSize:13,color:'#39FF14',marginRight:6 }} />{game.lineMovement}
                      </div>
                    ) : (
                      <div style={{ fontSize:11,color:'#bbb' }}>No significant line movement detected.</div>
                    )}
                    {analysis.priceVsDataAudit && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Price vs Data</div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.priceVsDataAudit}</div>
                      </div>
                    )}
                    {analysis.marketLogic && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Market Logic</div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.marketLogic}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Series Context tab */}
                {activeTab === 'Series Context' && (
                  <div style={{ background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontSize:11,fontWeight:800,color:'#111',marginBottom:10 }}>Series Context</div>
                    {analysis.seriesContext ? (
                      <div style={{ fontSize:12,color:'#444',lineHeight:1.7 }}>{analysis.seriesContext}</div>
                    ) : (
                      <div style={{ fontSize:11,color:'#bbb' }}>No series context available.</div>
                    )}
                    {analysis.trellRule && (
                      <div style={{ marginTop:12,paddingTop:12,borderTop:'1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Trell Rule</div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.trellRule}</div>
                      </div>
                    )}
                    {analysis.situational && (
                      <div style={{ marginTop:12,paddingTop:12,borderTop:'1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Situational</div>
                        <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.situational}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Public vs Sharp — within Series Context tab */}
                {activeTab === 'Series Context' && (analysis.sharpMoney || analysis.propaganda || game.sharpSignal) && (
                  <div style={{ marginTop:12,background:'rgba(240,248,255,0.5)',border:'1px solid rgba(80,140,255,0.25)',borderRadius:14,padding:'14px 16px' }}>
                    <div style={{ fontSize:11,fontWeight:800,color:'#5588ee',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                      <i className="ti ti-users" style={{ fontSize:14 }} /> Public vs Sharp
                    </div>
                    {game.sharpSignal && <div style={{ fontSize:10,color:'#789',marginBottom:8 }}>Sharp Signal: <b>{game.sharpSignal}</b></div>}
                    {analysis.sharpMoney && (
                      <div style={{ fontSize:11,color:'#456',lineHeight:1.7,marginBottom:analysis.propaganda?10:0 }}>{analysis.sharpMoney}</div>
                    )}
                    {analysis.propaganda && (
                      <div style={{ paddingTop:analysis.sharpMoney?10:0,borderTop:analysis.sharpMoney?'1px solid rgba(80,140,255,0.15)':'none' }}>
                        <div style={{ fontSize:9,fontWeight:800,color:'#5588ee',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>Media Narrative</div>
                        <div style={{ fontSize:11,color:'#456',lineHeight:1.7 }}>{analysis.propaganda}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Key Factors strip */}
                {analysis.edgeStrength && (
                  <div style={{ marginTop:12,background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.93)',borderRadius:14,padding:'12px 16px' }}>
                    <div style={{ fontSize:9,fontWeight:800,color:'#33aa00',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6 }}>Edge Strength</div>
                    <div style={{ fontSize:11,color:'#444',lineHeight:1.6 }}>{analysis.edgeStrength}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </NewLookShell>
  );
}
