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

function TeamLogo({ abbr, size=44 }) {
  const [err, setErr] = useState(false);
  const slug = MLB_SLUGS[abbr];

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
        <span style={{ width:18,height:18,borderRadius:4,background:"rgba(201,162,39,0.15)",border:"1px solid rgba(201,162,39,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#c9a227",fontWeight:700,flexShrink:0 }}>{index}</span>
        <span style={{ fontSize:9,color:"#c9a227",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",lineHeight:1.3 }}>{label}</span>
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
    <div style={{ background:"rgba(201,162,39,0.04)",border:"1px solid rgba(201,162,39,0.2)",borderRadius:10,padding:"12px 14px" }}>
      <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#c9a227",background:"rgba(201,162,39,0.1)",padding:"3px 8px",borderRadius:4,display:"inline-block",marginBottom:10 }}>⚡ SCAM PLAY</div>
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

function PlayResult({ result, game, onClose }) {
  const [expanded, setExpanded] = useState(false);
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
        <div style={{ padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"#60a5fa",background:"rgba(96,165,250,0.1)",padding:"2px 8px",borderRadius:4 }}>{game.sport}</span>
            <span style={{ fontSize:12,color:"#475569" }}>{isTennis?`${game.player1} vs ${game.player2}`:`${game.away} @ ${game.home}`} · {game.time}</span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#64748b",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ padding:"22px 22px 18px" }}>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:18 }}>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",padding:"4px 12px",borderRadius:6,background:tier.bg,border:`1px solid ${tier.border}`,color:tier.text }}>{tier.label}</span>
            <span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:isVegas?"rgba(248,113,113,0.08)":"rgba(96,165,250,0.08)",border:isVegas?"1px solid rgba(248,113,113,0.25)":"1px solid rgba(96,165,250,0.25)",color:isVegas?"#f87171":"#60a5fa",letterSpacing:"0.08em" }}>{isVegas?"VEGAS SLOT":"PUBLIC SLOT"}</span>
            {result.summary.isScamPlay&&<span style={{ fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6,background:"rgba(201,162,39,0.08)",border:"1px solid rgba(201,162,39,0.25)",color:"#c9a227",letterSpacing:"0.08em" }}>⚡ SCAM PLAY</span>}
            <span style={{ fontSize:10,padding:"4px 12px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:conf.color,marginLeft:"auto" }}>Confidence: <strong>{result.summary.confidence}</strong></span>
          </div>
          <div style={{ display:"flex",alignItems:"baseline",gap:12,marginBottom:10 }}>
            <span style={{ fontSize:30,fontWeight:800,color:"#f8fafc",letterSpacing:"-0.02em" }}>{result.summary.pick}</span>
            <span style={{ fontSize:17,fontWeight:600,color:"#c9a227",background:"rgba(201,162,39,0.1)",padding:"2px 10px",borderRadius:6,border:"1px solid rgba(201,162,39,0.2)" }}>{result.summary.betType}</span>
          </div>
          <p style={{ fontSize:13,color:"#94a3b8",lineHeight:1.7,margin:0 }}>{result.summary.verdict}</p>
        </div>
        <div style={{ margin:"0 22px 18px",padding:"14px 16px",background:"rgba(201,162,39,0.04)",border:"1px solid rgba(201,162,39,0.12)",borderRadius:10 }}>
          <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#c9a227",marginBottom:8 }}>FINAL VERDICT</div>
          <p style={{ fontSize:13,color:"#e2e8f0",lineHeight:1.75,margin:0 }}>{result.finalVerdict}</p>
        </div>
        <div style={{ padding:"0 22px 18px" }}>
          <button onClick={()=>setExpanded(!expanded)} style={{ width:"100%",padding:"11px",background:expanded?"rgba(201,162,39,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${expanded?"rgba(201,162,39,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:10,fontSize:12,fontWeight:500,color:expanded?"#c9a227":"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit" }}>
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
              <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#c9a227",marginBottom:10 }}>SCAM PLAY ANALYSIS</div>
              <ScamPlayBlock scam={a.scamPlay} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GAME CARD — matches reference image exactly ───────────────────────────────

function GameCard({ game, onGenerate, results, generating, onCardClick }) {
  const resultPublic = results[`${game.id}-PUBLIC`];
  const resultVegas  = results[`${game.id}-VEGAS`];
  const hasAnyResult = resultPublic || resultVegas;
  const bestResult   = resultVegas || resultPublic;
  const tier = bestResult ? (TIER_STYLES[bestResult.summary.tier] || TIER_STYLES["3"]) : null;
  const isTennis = game.sport === "Tennis";
  const isLock = tier?.label === "LOCK";

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
  const awayRec  = isTennis ? `#${game.player1Ranking}` : game.awayRecord;
  const homeRec  = isTennis ? `#${game.player2Ranking}` : game.homeRecord;
  const publicPct = 30 + ((game.id * 17) % 45);
  const sharpPct  = 100 - publicPct;
  const sportColor = game.sport==="MLB"?"#60a5fa":game.sport==="NBA"?"#fb923c":"#a78bfa";
  const sportBg    = game.sport==="MLB"?"rgba(96,165,250,0.12)":game.sport==="NBA"?"rgba(251,146,60,0.12)":"rgba(167,139,250,0.12)";

  return (
    <div
      onClick={()=>hasAnyResult&&onCardClick(game)}
      style={{
        background: isLock ? "linear-gradient(145deg,#0d1a10,#081210)" : "#0a0f1c",
        border: `1px solid ${isLock?"rgba(74,222,128,0.3)":hasAnyResult?(tier?.border||"rgba(201,162,39,0.2)"):"rgba(255,255,255,0.07)"}`,
        borderRadius:12, padding:"14px 16px",
        cursor:hasAnyResult?"pointer":"default",
        position:"relative", overflow:"hidden",
        boxShadow: isLock ? "0 0 30px rgba(74,222,128,0.08)" : "none",
      }}
    >
      {/* Gold glow top border for locks */}
      {isLock && <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9a227 40%,#c9a227 60%,transparent)" }} />}

      {/* Header row */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:sportColor,background:sportBg,padding:"2px 8px",borderRadius:4 }}>{game.sport}</span>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:10,color:"#4a5568",fontVariantNumeric:"tabular-nums" }}>{game.time}</span>
          <span style={{ fontSize:13,color:"#2a3545",cursor:"pointer",lineHeight:1 }}>☆</span>
        </div>
      </div>

      {/* Matchup — city + team name + logo layout */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 20px 1fr",alignItems:"center",gap:6,marginBottom:14 }}>
        {/* Away */}
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <TeamLogo abbr={awayAbbr} size={42} />
          <div>
            <div style={{ fontSize:8,color:"#3a4a5e",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:2 }}>{awayCity}</div>
            <div style={{ fontSize:14,fontWeight:900,color:"#e2e8f0",letterSpacing:"0.02em",textTransform:"uppercase",lineHeight:1 }}>{({"ARI":"DBACKS","ATL":"BRAVES","BAL":"ORIOLES","BOS":"RED SOX","CHC":"CUBS","CHW":"WHITE SOX","CIN":"REDS","CLE":"GUARDIANS","COL":"ROCKIES","DET":"TIGERS","HOU":"ASTROS","KC":"ROYALS","LAA":"ANGELS","LAD":"DODGERS","MIA":"MARLINS","MIL":"BREWERS","MIN":"TWINS","NYM":"METS","NYY":"YANKEES","OAK":"ATHLETICS","PHI":"PHILLIES","PIT":"PIRATES","SD":"PADRES","SEA":"MARINERS","SF":"GIANTS","STL":"CARDINALS","TB":"RAYS","TEX":"RANGERS","TOR":"BLUE JAYS","WSH":"NATIONALS"})[awayAbbr] || awayName.split(" ").pop().toUpperCase()}</div>
            <div style={{ fontSize:10,color:"#3a4a5e",marginTop:3 }}>{awayRec}</div>
          </div>
        </div>
        {/* @ */}
        <div style={{ textAlign:"center",fontSize:11,color:"#2a3545",fontWeight:700 }}>@</div>
        {/* Home */}
        <div style={{ display:"flex",alignItems:"center",gap:10,justifyContent:"flex-end" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:8,color:"#3a4a5e",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:2 }}>{homeCity}</div>
            <div style={{ fontSize:14,fontWeight:900,color:"#e2e8f0",letterSpacing:"0.02em",textTransform:"uppercase",lineHeight:1 }}>{({"ARI":"DBACKS","ATL":"BRAVES","BAL":"ORIOLES","BOS":"RED SOX","CHC":"CUBS","CHW":"WHITE SOX","CIN":"REDS","CLE":"GUARDIANS","COL":"ROCKIES","DET":"TIGERS","HOU":"ASTROS","KC":"ROYALS","LAA":"ANGELS","LAD":"DODGERS","MIA":"MARLINS","MIL":"BREWERS","MIN":"TWINS","NYM":"METS","NYY":"YANKEES","OAK":"ATHLETICS","PHI":"PHILLIES","PIT":"PIRATES","SD":"PADRES","SEA":"MARINERS","SF":"GIANTS","STL":"CARDINALS","TB":"RAYS","TEX":"RANGERS","TOR":"BLUE JAYS","WSH":"NATIONALS"})[homeAbbr] || homeName.split(" ").pop().toUpperCase()}</div>
            <div style={{ fontSize:10,color:"#3a4a5e",marginTop:3 }}>{homeRec}</div>
          </div>
          <TeamLogo abbr={homeAbbr} size={42} />
        </div>
      </div>

      {/* Public / Sharp money bar */}
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

      {/* Lock badge */}
      {isLock && (
        <div style={{ display:"flex",justifyContent:"center",marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.3)",borderRadius:8,padding:"5px 18px",fontSize:12,fontWeight:800,color:"#c9a227",letterSpacing:"0.08em" }}>
            🔒 LOCK
          </div>
        </div>
      )}

      {/* Result strip */}
      {hasAnyResult && !isLock && (
        <div style={{ display:"flex",gap:6,marginBottom:10 }}>
          {[["PUBLIC",resultPublic],["VEGAS",resultVegas]].map(([slot,result])=>{
            if(!result)return null;
            const ts=TIER_STYLES[result.summary.tier]||TIER_STYLES["3"];
            const iv=slot==="VEGAS";
            return(
              <div key={slot} style={{ flex:1,background:iv?"rgba(248,113,113,0.05)":"rgba(96,165,250,0.05)",border:iv?"1px solid rgba(248,113,113,0.15)":"1px solid rgba(96,165,250,0.15)",borderRadius:7,padding:"6px 8px" }}>
                <div style={{ fontSize:8,fontWeight:700,letterSpacing:"0.1em",color:iv?"#f87171":"#60a5fa",marginBottom:3 }}>{slot}</div>
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
      <div style={{ display:"flex",gap:8 }}>
        {["PUBLIC","VEGAS"].map(slot=>{
          const key=`${game.id}-${slot}`;
          const isGen=generating===key;
          const hasRes=!!results[key];
          const iv=slot==="VEGAS";
          return(
            <button key={slot} onClick={e=>{e.stopPropagation();onGenerate(game,slot);}} disabled={!!generating} style={{ flex:1,padding:"8px 0",background:isGen?(iv?"rgba(248,113,113,0.1)":"rgba(96,165,250,0.1)"):(hasRes?(iv?"rgba(248,113,113,0.06)":"rgba(96,165,250,0.06)"):"transparent"),border:`1px solid ${(isGen||hasRes)?(iv?"rgba(248,113,113,0.4)":"rgba(96,165,250,0.4)"):(iv?"rgba(248,113,113,0.2)":"rgba(96,165,250,0.2)")}`,borderRadius:7,fontSize:10,fontWeight:600,letterSpacing:"0.04em",color:generating&&!isGen?"#1e2a3a":(iv?"#f87171":"#60a5fa"),cursor:generating?"not-allowed":"pointer",fontFamily:"inherit" }}>
              {isGen?"ANALYZING…":hasRes?`↻ ${slot}`:`Analyze as ${slot}`}
            </button>
          );
        })}
      </div>
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

function ConfidenceChart() {
  const pts=[20,35,28,45,38,52,42,60,55,58,65,70,62,75,70].map((v,i)=>`${i*(200/14)},${70-(v/80)*60}`).join(" ");
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
      <div style={{ fontSize:9,color:"#2d3a4a",textAlign:"center" }}>Last updated: <span style={{ color:"#c9a227" }}>{timeStr}</span></div>
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
          <span style={{ fontSize:11,fontWeight:600,color:o.odds.startsWith("+") ? "#10b981" : "#e2e8f0" }}>{o.odds}</span>
          <span style={{ fontSize:9,color:o.up?"#10b981":"#f87171" }}>{o.up?"▲":"▼"}</span>
        </div>
      ))}
    </div>
  );
}

// ── RIGHT PANEL CONTENT (reused for desktop + stacked mobile) ─────────────────

function RightPanelContent() {
  return(
    <>
      {/* AI Market Scanner */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"#64748b",marginBottom:14,display:"flex",alignItems:"center",gap:6 }}>
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
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"#64748b",marginBottom:14,display:"flex",alignItems:"center",gap:6 }}>
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
        <div style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:"#64748b",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:3,height:10,background:"#4ade80",borderRadius:2,display:"inline-block" }}/>
          AI CONFIDENCE MONITOR
        </div>
        <ConfidenceChart />
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 }}>
          <span style={{ fontSize:9,color:"#2d3a4a" }}>Overall AI Confidence</span>
          <span style={{ fontSize:22,fontWeight:800,color:"#4ade80",letterSpacing:"-0.02em" }}>98.7%</span>
        </div>
      </div>
    </>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function VegasVaultApp() {
  const [games, setGames]             = useState([]);
  const [trellAlerts, setTrellAlerts] = useState([]);
  const [oddsFeed, setOddsFeed]       = useState(ODDS_FEED);
  const [marketScanner, setMarketScanner] = useState({ reverseLineMovement:7, sharpMoneyDetected:5, publicHeavy:6, vegasTrapAlert:3 });
  const [insights, setInsights]       = useState(INSIGHTS);
  const [results, setResults]         = useState({});
  const [generating, setGenerating]   = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [activeGame, setActiveGame]   = useState(null);
  const [filter, setFilter]           = useState("ALL");
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [time, setTime]               = useState(new Date());

  useEffect(()=>{
    fetch("/api/today").then(r=>r.json())
      .then(data=>{
        setGames(data.games||MOCK_GAMES);
        setTrellAlerts(data.trellAlerts||[]);
        if (data.oddsFeed?.length) setOddsFeed(data.oddsFeed);
        if (data.marketScanner) setMarketScanner(data.marketScanner);
        if (data.insights?.length) setInsights(data.insights);
        setLoading(false);
      })
      .catch(()=>{setGames(MOCK_GAMES);setLoading(false);});
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  const generated = Object.keys(results).length;
  const FILTERS = ["ALL","MLB","NBA","TENNIS","NHL","NCAAF","SOCCER","NEW"];
  const filteredGames = games.filter(g=>{
    if(filter==="MLB")return g.sport==="MLB";
    if(filter==="NBA")return g.sport==="NBA";
    if(filter==="TENNIS")return g.sport==="Tennis";
    if(filter==="NEW")return !results[`${g.id}-PUBLIC`]&&!results[`${g.id}-VEGAS`];
    return true;
  });

  async function handleGenerate(game,slot){
    const key=`${game.id}-${slot}`;
    setGenerating(key); setError(null);
    try{
      const result=await generatePlay({...game,slot});
      setResults(prev=>({...prev,[key]:result}));
      setActiveResult(result); setActiveGame({...game,slot});
    }catch{ setError("Generation failed. Check your Anthropic API key in Vercel environment variables."); }
    finally{ setGenerating(null); }
  }

  function handleCardClick(game){
    const result=results[`${game.id}-VEGAS`]||results[`${game.id}-PUBLIC`];
    if(result){setActiveResult(result);setActiveGame(game);}
  }

  const today = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const timeStr = time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const hour = new Date().getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  return (
    <div style={{ fontFamily:"'DM Mono','Courier New',monospace",background:"#07091a",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#07091a;overflow-x:hidden;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
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
          .vv-bottom-nav{display:flex!important;position:fixed;bottom:0;left:0;right:0;height:58px;background:rgba(7,9,26,0.97);border-top:1px solid rgba(255,255,255,0.08);z-index:200;align-items:center;justify-content:space-around;backdrop-filter:blur(20px);}
          .vv-cards{grid-template-columns:1fr!important;}
          .vv-stats{grid-template-columns:repeat(2,1fr)!important;}
          .vv-nav-center{display:none!important;}
          .vv-ticker-lbl{display:none!important;}
          .vv-nav-logo span.lbl{display:none!important;}
          .vv-main-inner{padding:12px 12px 74px!important;}
        }
      `}</style>

      {/* ── TOP NAV ── */}
      <div style={{ height:52,borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",background:"rgba(7,9,26,0.96)",backdropFilter:"blur(24px)",position:"sticky",top:0,zIndex:100,flexShrink:0 }}>
        <div className="vv-nav-logo" style={{ width:200,padding:"0 18px",display:"flex",alignItems:"center",gap:10,borderRight:"1px solid rgba(255,255,255,0.06)",flexShrink:0 }}>
          <div style={{ width:30,height:30,background:"linear-gradient(135deg,#c9a227,#8b6d10)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#000",flexShrink:0 }}>V</div>
          <div>
            <span className="lbl" style={{ fontSize:13,fontWeight:700,color:"#f8fafc",letterSpacing:"0.06em" }}>VEGAS </span>
            <span className="lbl" style={{ fontSize:13,fontWeight:700,color:"#c9a227",letterSpacing:"0.06em" }}>VAULT</span>
            <span className="lbl" style={{ fontSize:10,color:"#3a4a5e",marginLeft:4 }}>AI</span>
          </div>
        </div>

        <div className="vv-nav-center" style={{ flex:1,justifyContent:"center" }}>
          {[{t:"DASHBOARD",active:true},{t:"ALERTS",badge:3,active:false},{t:"WATCHLIST",badge:7,active:false}].map((tab,i)=>(
            <div key={i} style={{ padding:"0 22px",height:52,display:"flex",alignItems:"center",gap:7,fontSize:11,fontWeight:tab.active?700:400,color:tab.active?"#c9a227":"#3a4a5e",borderBottom:tab.active?"2px solid #c9a227":"2px solid transparent",cursor:"pointer",letterSpacing:"0.07em",whiteSpace:"nowrap" }}>
              {i===1&&<span style={{ fontSize:11 }}>🔔</span>}
              {i===2&&<span style={{ fontSize:11 }}>☆</span>}
              {tab.t}
              {tab.badge&&<span style={{ background:"rgba(201,162,39,0.15)",border:"1px solid rgba(201,162,39,0.3)",borderRadius:10,padding:"1px 6px",fontSize:9,color:"#c9a227",fontWeight:700 }}>{tab.badge}</span>}
            </div>
          ))}
        </div>

        <div style={{ display:"flex",alignItems:"center",gap:14,padding:"0 18px",flexShrink:0 }}>
          <span style={{ fontSize:17,color:"#2d3a4a",cursor:"pointer" }}>⌕</span>
          <span style={{ fontSize:17,color:"#2d3a4a",cursor:"pointer" }}>🔔</span>
          <div style={{ display:"flex",alignItems:"center",gap:7 }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#c9a227,#8b6d10)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#000" }}>T</div>
            <span style={{ fontSize:11,color:"#3a4a5e" }}>▼</span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:"flex",flex:1,minHeight:0 }}>

        {/* LEFT SIDEBAR */}
        <div className="vv-sidebar" style={{ width:200,background:"rgba(7,9,26,0.99)",borderRight:"1px solid rgba(255,255,255,0.05)",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
          <div style={{ flex:1,padding:"10px 0" }}>
            {NAV_ITEMS.map((item,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 20px",background:item.active?"rgba(201,162,39,0.07)":"transparent",borderLeft:item.active?"2px solid #c9a227":"2px solid transparent",cursor:"pointer" }}>
                <span style={{ fontSize:13,color:item.active?"#c9a227":"#2d3a4a",width:18,flexShrink:0 }}>{item.icon}</span>
                <span style={{ fontSize:10,fontWeight:item.active?700:400,color:item.active?"#c9a227":"#3a4a5e",letterSpacing:"0.08em",flex:1 }}>{item.label}</span>
                {item.arrow&&<span style={{ fontSize:9,color:"#2d3a4a" }}>▶</span>}
              </div>
            ))}
          </div>
          {/* AI Engine Status */}
          <div style={{ padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:10 }}>AI ENGINE STATUS</div>
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
              <div className="vv-ticker-lbl" style={{ padding:"8px 16px",fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#c9a227",borderRight:"1px solid rgba(255,255,255,0.05)",whiteSpace:"nowrap",flexShrink:0 }}>LIVE ODDS FEED</div>
              <div style={{ flex:1,overflow:"hidden",padding:"8px 0" }}><OddsTicker feed={oddsFeed}/></div>
              <div style={{ padding:"0 14px",flexShrink:0 }}><Sparkline color="#3b82f6" width={56} height={22}/></div>
            </div>
          </div>

          <div className="vv-main-inner" style={{ padding:"18px 18px 28px",flex:1 }}>

            {/* Greeting */}
            <div style={{ marginBottom:18 }}>
              <h1 style={{ fontSize:22,fontWeight:700,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:4 }}>{greeting}, Teztez4real.</h1>
              <p style={{ fontSize:12,color:"#3a4a5e" }}>Vegas Vault AI is scanning <span style={{ color:"#3b82f6",cursor:"pointer" }}>12 sportsbooks...</span></p>
            </div>

            {/* Stat cards */}
            <div className="vv-stats">
              {/* Today's games */}
              <div style={{ background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:10 }}>TODAY'S GAMES</div>
                <div style={{ fontSize:30,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.03em",marginBottom:4 }}>{loading?"…":games.length}</div>
                <div style={{ fontSize:10,color:"#2d3a4a" }}>{timeStr} CT</div>
              </div>
              {/* AI Picks */}
              <div style={{ background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:10 }}>AI PICKS GENERATED</div>
                <div style={{ fontSize:30,fontWeight:800,color:"#c9a227",letterSpacing:"-0.03em",marginBottom:8 }}>{generated} <span style={{ fontSize:18,color:"#5a4a1a" }}>/ {loading?"…":games.length*2}</span></div>
                <div style={{ height:2,background:"rgba(255,255,255,0.04)",borderRadius:1 }}>
                  <div style={{ height:"100%",width:games.length?`${Math.min(100,(generated/(games.length*2))*100)}%`:"0%",background:"linear-gradient(90deg,#8b6d10,#c9a227)",borderRadius:1,transition:"width 0.4s" }}/>
                </div>
              </div>
              {/* Win rate */}
              <div style={{ background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:6 }}>WIN RATE (7D)</div>
                <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between" }}>
                  <div style={{ fontSize:30,fontWeight:800,color:"#4ade80",letterSpacing:"-0.03em" }}>68%</div>
                  <Sparkline color="#4ade80" width={70} height={34}/>
                </div>
              </div>
              {/* Top tier */}
              <div style={{ background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:10 }}>TOP TIER</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div style={{ fontSize:26,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em" }}>LOCK</div>
                  <span style={{ fontSize:24 }}>🔒</span>
                </div>
              </div>
              {/* AI Confidence */}
              <div style={{ background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:9,color:"#3a4a5e",letterSpacing:"0.1em",fontWeight:700,marginBottom:4 }}>AI CONFIDENCE</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div><div style={{ fontSize:20,fontWeight:800,color:"#c9a227" }}>HIGH</div><div style={{ fontSize:11,color:"#8b6d10" }}>98.7%</div></div>
                  <RadarChart size={64}/>
                </div>
              </div>
            </div>

            {/* Slate header */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <h2 style={{ fontSize:16,fontWeight:700,color:"#f1f5f9" }}>Today's Slate</h2>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ fontSize:11,color:"#3a4a5e",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"4px 10px" }}>{today} ▾</div>
                <span style={{ fontSize:14,color:"#2d3a4a",cursor:"pointer" }}>⊟</span>
              </div>
            </div>

            {/* Filter pills */}
            <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" }}>
              {FILTERS.map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11,fontWeight:filter===f?700:400,padding:"5px 14px",borderRadius:6,border:`1px solid ${filter===f?"rgba(201,162,39,0.5)":"rgba(255,255,255,0.07)"}`,background:filter===f?"rgba(201,162,39,0.1)":"transparent",color:filter===f?"#c9a227":"#3a4a5e",cursor:"pointer",letterSpacing:"0.05em",fontFamily:"inherit" }}>{f}</button>
              ))}
            </div>

            {error&&<div style={{ background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f87171",marginBottom:14 }}>{error}</div>}

            {/* Game cards */}
            {loading?(
              <div style={{ textAlign:"center",padding:"60px 0",fontSize:11,color:"#2d3a4a",letterSpacing:"0.1em" }}>LOADING SLATE…</div>
            ):(
              <div className="vv-cards">
                {filteredGames.map(game=>(
                  <GameCard key={game.id} game={game} results={results} generating={generating} onGenerate={handleGenerate} onCardClick={handleCardClick}/>
                ))}
              </div>
            )}

            {/* Trell alerts */}
            {trellAlerts.length>0&&(
              <div style={{ marginTop:14,background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14 }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"#c9a227",marginBottom:10 }}>⚡ TRELL RULE ALERTS</div>
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
            <div className="vv-right-stacked" style={{ marginTop:16,background:"#0b0f20",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:16 }}>
              <RightPanelContent/>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (desktop) */}
        <div className="vv-right" style={{ width:290,background:"rgba(7,9,26,0.99)",borderLeft:"1px solid rgba(255,255,255,0.05)",overflowY:"auto",flexShrink:0,padding:"16px 16px 24px" }}>
          <RightPanelContent/>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="vv-bottom-nav">
        {[{icon:"⊞",lbl:"HOME"},{icon:"📅",lbl:"SLATE"},{icon:"◎",lbl:"ANALYZE"},{icon:"🔒",lbl:"LOCKS"},{icon:"↺",lbl:"HISTORY"}].map((item,i)=>(
          <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 14px",cursor:"pointer",opacity:i===0?1:0.38 }}>
            <span style={{ fontSize:17,color:i===0?"#c9a227":"#475569" }}>{item.icon}</span>
            <span style={{ fontSize:8,fontWeight:600,letterSpacing:"0.07em",color:i===0?"#c9a227":"#475569" }}>{item.lbl}</span>
          </div>
        ))}
      </div>

      {activeResult&&activeGame&&(
        <PlayResult result={activeResult} game={activeGame} onClose={()=>{setActiveResult(null);setActiveGame(null);}}/>
      )}
    </div>
  );
}
