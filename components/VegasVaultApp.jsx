"use client";
import { useState, useEffect } from "react";

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

// ── MOCK FALLBACK DATA ────────────────────────────────────────────────────────

const MOCK_GAMES = [
  {
    id: 1, sport: "MLB", slot: "PUBLIC", time: "1:10 PM CT",
    away: "Yankees", home: "Red Sox",
    awayRecord: "28-17", homeRecord: "22-24",
    awayAwayRecord: "13-9", homeHomeRecord: "10-13",
    awayLast5: "4-1", homeLast5: "2-3",
    awayLast10: "7-3", homeLast10: "4-6",
    awayML: "-145", homeML: "+125",
    runLine: "Yankees -1.5 (+115)",
    awayPitcher: "Gerrit Cole", homePitcher: "Brayan Bello",
    awayPitcherStats: "3.21 ERA, 1.08 WHIP, 78 K in 70.1 IP, 5-2",
    homePitcherStats: "4.87 ERA, 1.34 WHIP, 52 K in 64.0 IP, 3-5",
    awayBullpenERA: "3.45", homeBullpenERA: "4.92",
    awayOffense: "BA .261, OPS .778, strong 1-6 lineup",
    homeOffense: "BA .243, OPS .714, streaky bottom third",
    h2hLast5: "Yankees 4-1", h2hAtHome: "Yankees 3-1 at Fenway last 4",
    injuries: "Red Sox: Rafael Devers (back, day-to-day) | Yankees: all clear",
    lineMovement: "Opened Yankees -135, moved to -145. Sharp action on Yankees.",
    seriesGame: "2", seriesLength: "3", date: "2026-05-22"
  },
  {
    id: 2, sport: "MLB", slot: "VEGAS", time: "2:20 PM CT",
    away: "Dodgers", home: "Padres",
    awayRecord: "31-14", homeRecord: "26-20",
    awayAwayRecord: "15-8", homeHomeRecord: "14-9",
    awayLast5: "3-2", homeLast5: "4-1",
    awayLast10: "6-4", homeLast10: "7-3",
    awayML: "-160", homeML: "+140",
    runLine: "Dodgers -1.5 (+105)",
    awayPitcher: "Tyler Glasnow", homePitcher: "Dylan Cease",
    awayPitcherStats: "2.98 ERA, 1.01 WHIP, 88 K in 75.2 IP, 6-2",
    homePitcherStats: "2.61 ERA, 1.09 WHIP, 92 K in 79.1 IP, 5-3",
    awayBullpenERA: "3.88", homeBullpenERA: "3.21",
    awayOffense: "BA .268, OPS .812, MLB-best lineup depth",
    homeOffense: "BA .254, OPS .741, Tatis/Machado carrying",
    h2hLast5: "Dodgers 3-2", h2hAtHome: "Padres 3-1 vs Dodgers at Petco last 4",
    injuries: "Dodgers: Freddie Freeman (ankle, questionable) | Padres: all clear",
    lineMovement: "Opened Dodgers -150, moved to -160. Public heavy on Dodgers.",
    seriesGame: "1", seriesLength: "3", date: "2026-05-22"
  },
  {
    id: 3, sport: "MLB", slot: "PUBLIC", time: "7:05 PM CT",
    away: "Cardinals", home: "Cubs",
    awayRecord: "20-26", homeRecord: "24-22",
    awayAwayRecord: "8-15", homeHomeRecord: "13-10",
    awayLast5: "2-3", homeLast5: "3-2",
    awayLast10: "4-6", homeLast10: "6-4",
    awayML: "+130", homeML: "-150",
    runLine: "Cardinals +1.5 (-135)",
    awayPitcher: "Sonny Gray", homePitcher: "Justin Steele",
    awayPitcherStats: "3.54 ERA, 1.19 WHIP, 61 K in 58.2 IP, 3-4",
    homePitcherStats: "3.12 ERA, 1.14 WHIP, 74 K in 66.1 IP, 5-2",
    awayBullpenERA: "4.44", homeBullpenERA: "3.67",
    awayOffense: "BA .248, OPS .698, Goldschmidt cold last 2 weeks",
    homeOffense: "BA .257, OPS .743, Swanson hot, solid top 6",
    h2hLast5: "Cubs 3-2", h2hAtHome: "Cubs 3-0 vs Cardinals at Wrigley this season",
    injuries: "Cardinals: Paul Goldschmidt (wrist, day-to-day) | Cubs: all clear",
    lineMovement: "Opened Cubs -140, moved to -150. Public on Cubs.",
    seriesGame: "3", seriesLength: "3", date: "2026-05-22"
  },
];

// ── GENERATE PLAY ─────────────────────────────────────────────────────────────

async function generatePlay(game) {
  const prompt = game.sport === "Tennis"
    ? buildTennisPrompt(game)
    : buildBaseballPrompt(game);

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game }),
  });

  if (!response.ok) throw new Error("Generate failed");
  return response.json();
}

// ── TIER STYLES ───────────────────────────────────────────────────────────────

const TIER_STYLES = {
  "1": { bg: "#0a2e1a", border: "#1a6b3a", text: "#4ade80", label: "LOCK" },
  "2": { bg: "#2a1f00", border: "#b45309", text: "#fbbf24", label: "Tier 2" },
  "3": { bg: "#1a1a1a", border: "#444", text: "#aaa", label: "Tier 3" },
  "PASS": { bg: "#1f0a0a", border: "#7f1d1d", text: "#f87171", label: "Pass" }
};

const CONF_STYLES = {
  HIGH: { color: "#4ade80" },
  MEDIUM: { color: "#fbbf24" },
  LOW: { color: "#f87171" }
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function AnalysisRow({ label, value }) {
  return (
    <div style={{ borderBottom: "0.5px solid #2a2a2a", padding: "10px 0", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#c9a227", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

function ScamPlayBlock({ scam }) {
  if (!scam || !scam.active) {
    return (
      <div style={{ padding: "10px 14px", background: "#0d1f0d", border: "0.5px solid #1a6b3a", borderRadius: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>NO SCAM PLAY - Straightforward public side</div>
      </div>
    );
  }
  return (
    <div style={{ background: "#1a0a0a", border: "1px solid #c9a227", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#c9a227", marginBottom: 8 }}>SCAM PLAY IDENTIFIED</div>
      <div style={{ fontSize: 12, color: "#f87171", marginBottom: 6 }}>
        <span style={{ fontWeight: 500 }}>WHY IT LOOKS WRONG: </span>{scam.whyItLooksWrong}
      </div>
      <div style={{ fontSize: 12, color: "#4ade80" }}>
        <span style={{ fontWeight: 500 }}>WHY IT IS ACTUALLY CORRECT: </span>{scam.whyItsActuallyCorrect}
      </div>
    </div>
  );
}

function PlayResult({ result, game, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_STYLES[result.summary.tier] || TIER_STYLES["3"];
  const conf = CONF_STYLES[result.summary.confidence] || CONF_STYLES.MEDIUM;
  const a = result.analysis;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0f0f0f", border: "0.5px solid #2a2a2a", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#666" }}>
            {game.sport === "Tennis" ? `${game.player1} vs ${game.player2}` : `${game.away} @ ${game.home}`} - {game.time}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>x</button>
        </div>

        <div style={{ padding: "20px", borderBottom: "0.5px solid #2a2a2a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: tier.text }}>
              {tier.label}
            </div>
            <div style={{ background: result.summary.slot === "VEGAS" ? "#1f0a0a" : "#0a1a2e", border: `0.5px solid ${result.summary.slot === "VEGAS" ? "#7f1d1d" : "#1e3a5f"}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: result.summary.slot === "VEGAS" ? "#f87171" : "#60a5fa" }}>
              {result.summary.slot === "VEGAS" ? "Vegas Slot" : "Public Slot"}
            </div>
            {result.summary.isScamPlay && (
              <div style={{ background: "#1a1000", border: "0.5px solid #c9a227", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#c9a227" }}>
                Scam Play
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{result.summary.pick}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#c9a227" }}>{result.summary.betType}</div>
          </div>

          <div style={{ fontSize: 13, color: "#999", marginBottom: 14, lineHeight: 1.6 }}>{result.summary.verdict}</div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#555" }}>Confidence:</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: conf.color }}>{result.summary.confidence}</div>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #2a2a2a", background: "#0a0a0a" }}>
          <div style={{ fontSize: 11, color: "#c9a227", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Final Verdict</div>
          <div style={{ fontSize: 14, color: "#e5e5e5", lineHeight: 1.7 }}>{result.finalVerdict}</div>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: expanded ? "0.5px solid #2a2a2a" : "none" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ width: "100%", background: "#1a1a1a", border: "0.5px solid #333", borderRadius: 8, padding: "10px", fontSize: 13, color: "#aaa", cursor: "pointer" }}
          >
            {expanded ? "Hide full analysis" : "See full Vegas Vault breakdown"}
          </button>
        </div>

        {expanded && (
          <div style={{ padding: "4px 20px 20px" }}>
            {game.sport === "Tennis" ? (
              <>
                <AnalysisRow label="1. Matchup Foundation" value={a.matchupFoundation} />
                <AnalysisRow label="2. Rankings and Tier" value={a.rankingsTier} />
                <AnalysisRow label="3. Surface Analysis" value={a.surfaceAnalysis} />
                <AnalysisRow label="4. Recent Form" value={a.recentForm} />
                <AnalysisRow label="5. Tournament Context" value={a.tournamentContext} />
                <AnalysisRow label="6. Fatigue and Scheduling" value={a.fatigueScheduling} />
                <AnalysisRow label="7. Head to Head" value={a.headToHead} />
                <AnalysisRow label="8. Serve and Return" value={a.serveReturn} />
                <AnalysisRow label="9. Mental and Psychological" value={a.mentalPsychological} />
                <AnalysisRow label="10. Injury Check" value={a.injuryCheck} />
                <AnalysisRow label="11. Pricing Intelligence" value={a.pricingIntelligence} />
                <AnalysisRow label="12. Game Script" value={a.gameScript} />
              </>
            ) : (
              <>
                <AnalysisRow label="1. Matchup Foundation" value={a.matchupFoundation} />
                <AnalysisRow label="2. Records" value={a.records} />
                <AnalysisRow label="3. Recent Form" value={a.recentForm} />
                <AnalysisRow label="4. Head to Head" value={a.headToHead} />
                <AnalysisRow label="5. Hitter and Lineup" value={a.hitterLineup} />
                <AnalysisRow label="6. Pitching" value={a.pitching} />
                <AnalysisRow label="7. Game Script" value={a.gameScript} />
                <AnalysisRow label="8. Series Context" value={a.seriesContext} />
                <AnalysisRow label="9. Trell Rule" value={a.trellRule} />
                <AnalysisRow label="10. Pricing Comprehension" value={a.pricingComprehension} />
                <AnalysisRow label="11. Line Movement" value={a.lineMovement} />
                <AnalysisRow label="12. Vegas vs Public" value={a.vegasVsPublic} />
              </>
            )}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#c9a227", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Scam Play</div>
              <ScamPlayBlock scam={a.scamPlay} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, onGenerate, results, generating }) {
  const resultPublic = results[`${game.id}-PUBLIC`];
  const resultVegas = results[`${game.id}-VEGAS`];
  const hasAnyResult = resultPublic || resultVegas;

  return (
    <div style={{
      background: "#111",
      border: `0.5px solid ${hasAnyResult ? "#c9a22740" : "#222"}`,
      borderRadius: 12,
      padding: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: game.sport === "Tennis" ? "#0d2010" : game.sport === "NBA" ? "#1a0d00" : "#0a1a2e", color: game.sport === "Tennis" ? "#4ade80" : game.sport === "NBA" ? "#fb923c" : "#60a5fa" }}>{game.sport}</span>
        </div>
        <span style={{ fontSize: 11, color: "#555" }}>{game.time}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>{game.sport === "Tennis" ? game.player1 : game.away}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{game.sport === "Tennis" ? `#${game.player1Ranking}` : game.awayRecord}</div>
        </div>
        <div style={{ fontSize: 11, color: "#444", padding: "0 8px" }}>{game.sport === "Tennis" ? "vs" : "@"}</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>{game.sport === "Tennis" ? game.player2 : game.home}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{game.sport === "Tennis" ? `#${game.player2Ranking}` : game.homeRecord}</div>
        </div>
      </div>

      <div style={{ borderTop: "0.5px solid #1e1e1e", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Results row */}
        {hasAnyResult && (
          <div style={{ display: "flex", gap: 8 }}>
            {[resultPublic, resultVegas].map((result, i) => {
              if (!result) return null;
              const slotLabel = i === 0 ? "PUBLIC" : "VEGAS";
              const tierStyle = TIER_STYLES[result.summary.tier] || TIER_STYLES["3"];
              return (
                <div key={slotLabel} style={{ flex: 1, background: i === 0 ? "#0a1a2e" : "#1f0a0a", borderRadius: 8, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 10, color: i === 0 ? "#60a5fa" : "#f87171", fontWeight: 600 }}>{slotLabel}</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#c9a227" }}>{result.summary.pick}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: tierStyle?.bg, color: tierStyle?.text, border: `0.5px solid ${tierStyle?.border}` }}>{tierStyle?.label}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#666" }}>{result.summary.betType}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Analyze buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {["PUBLIC", "VEGAS"].map(slot => {
            const isGenerating = generating === `${game.id}-${slot}`;
            const hasResult = !!results[`${game.id}-${slot}`];
            const isPublic = slot === "PUBLIC";
            return (
              <button
                key={slot}
                onClick={() => onGenerate(game, slot)}
                disabled={!!generating}
                style={{
                  flex: 1, padding: "7px 0",
                  background: hasResult ? (isPublic ? "#0a1a2e" : "#1f0a0a") : "transparent",
                  border: `0.5px solid ${isPublic ? "#1e3a5f" : "#7f1d1d"}`,
                  borderRadius: 8, fontSize: 12,
                  color: generating ? "#444" : (isPublic ? "#60a5fa" : "#f87171"),
                  cursor: generating ? "not-allowed" : "pointer", fontWeight: 500,
                }}
              >
                {isGenerating ? "Analyzing..." : hasResult ? `↻ ${slot}` : `Analyze as ${slot}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function VegasVaultApp() {
  const [games, setGames] = useState([]);
  const [trellAlerts, setTrellAlerts] = useState([]);
  const [results, setResults] = useState({});
  const [generating, setGenerating] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/today")
      .then(res => res.json())
      .then(data => {
        setGames(data.games || MOCK_GAMES);
        setTrellAlerts(data.trellAlerts || []);
        setLoading(false);
      })
      .catch(() => {
        setGames(MOCK_GAMES);
        setLoading(false);
      });
  }, []);

  const generated = Object.keys(results).length;

  const filteredGames = games.filter(g => {
    if (filter === "MLB") return g.sport === "MLB";
    if (filter === "NBA") return g.sport === "NBA";
    if (filter === "Tennis") return g.sport === "Tennis";
    if (filter === "PUBLIC") return g.slot === "PUBLIC";
    if (filter === "VEGAS") return g.slot === "VEGAS";
    if (filter === "NEW") return !results[`${game.id}-PUBLIC`] && !results[`${game.id}-VEGAS`];
    return true;
  });

  async function handleGenerate(game, slot) {
    const key = `${game.id}-${slot}`;
    setGenerating(key);
    setError(null);
    try {
      const gameWithSlot = { ...game, slot };
      const result = await generatePlay(gameWithSlot);
      setResults(prev => ({ ...prev, [key]: result }));
      setActiveResult(result);
      setActiveGame(gameWithSlot);
    } catch (e) {
      setError("Generation failed. Check your Anthropic API key in Vercel environment variables.");
    } finally {
      setGenerating(null);
    }
  }

  function handleCardClick(game) {
    const result = results[`${game.id}-VEGAS`] || results[`${game.id}-PUBLIC`];
    if (result) {
      setActiveResult(result);
      setActiveGame(game);
    }
  }

  const FILTERS = ["ALL", "MLB", "NBA", "Tennis", "PUBLIC", "VEGAS", "NEW"];
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#080808", minHeight: "100vh", color: "#e5e5e5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      <div style={{ borderBottom: "0.5px solid #1e1e1e", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#080808", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#fff", letterSpacing: "0.05em" }}>VEGAS</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#c9a227", letterSpacing: "0.05em" }}>VAULT</span>
          <span style={{ fontSize: 11, color: "#444", marginLeft: 4 }}>AI</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#555" }}>
          <span style={{ color: "#888" }}>Dashboard</span>
          <span>History</span>
          <span>Settings</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1500", border: "0.5px solid #c9a227", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#c9a227", fontWeight: 500 }}>C</div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Today's games", val: loading ? "..." : games.length },
            { label: "Generated", val: `${generated} / ${games.length}`, accent: true },
            { label: "Win rate (7d)", val: "68%", green: true },
            { label: "Top tier", val: "Lock" }
          ].map((s, i) => (
            <div key={i} style={{ background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: s.green ? "#4ade80" : s.accent ? "#c9a227" : "#e5e5e5" }}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e5e5" }}>Today's slate</div>
          <div style={{ fontSize: 12, color: "#555", background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 20, padding: "4px 12px" }}>{today}</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 20,
              border: `0.5px solid ${filter === f ? "#c9a227" : "#222"}`,
              background: filter === f ? "#1a1500" : "transparent",
              color: filter === f ? "#c9a227" : "#555",
              cursor: "pointer", fontFamily: "inherit"
            }}>{f}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: "#1f0a0a", border: "0.5px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>Loading today's slate...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            {filteredGames.map(game => (
              <div key={game.id} onClick={() => handleCardClick(game)}>
                <GameCard
                  game={game}
                  results={results}
                  generating={generating}
                  onGenerate={handleGenerate}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, background: "#111", border: "0.5px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#c9a227", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Trell Rule Alerts</div>
          {trellAlerts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#4ade80" }}>No active Trell triggers today</div>
          ) : (
            trellAlerts.map((alert, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < trellAlerts.length - 1 ? "0.5px solid #1a1a1a" : "none", fontSize: 13 }}>
                <div>
                  <div style={{ color: "#e5e5e5" }}>{alert.player}</div>
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>{alert.status} - {alert.direction}</div>
                </div>
                <span style={{ fontSize: 14, color: "#f87171" }}>!</span>
              </div>
            ))
          )}
        </div>
      </div>

      {activeResult && activeGame && (
        <PlayResult
          result={activeResult}
          game={activeGame}
          onClose={() => { setActiveResult(null); setActiveGame(null); }}
        />
      )}
    </div>
  );
}
