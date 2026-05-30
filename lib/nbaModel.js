/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VEGAS VAULT AI MODEL — NBA VERSION (FINAL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Same 15-step flow as MLB. Same tier system.
 * NBA slot days: Public = Mon/Wed/Fri | Vegas = Tue/Thu/Sat/Sun
 * First game = opposite of day base.
 * Same time slot = hold. Different time slot = switch.
 *
 * Includes: CBS Sports previews, propaganda analysis, odds, line movement,
 * bet %, opening lines — everything used for MLB, now for NBA too.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── SLOT SYSTEM (NBA) ─────────────────────────────────────────────────────────

export function assignNBASlots(games) {
  // PUBLIC: Monday (1), Wednesday (3), Friday (5)
  // VEGAS:  Tuesday (2), Thursday (4), Saturday (6), Sunday (0)
  const dayOfWeek = new Date().getDay();
  const publicDays = [1, 3, 5];
  const dayBase = publicDays.includes(dayOfWeek) ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');

  // First game is always opposite of day base
  let currentSlot = opposite(dayBase);
  let lastTime = null;

  return games.map((g, i) => {
    if (i === 0) {
      lastTime = g.rawTime;
      return { ...g, slot: currentSlot };
    }
    // Different time slot = switch
    if (g.rawTime !== lastTime) {
      currentSlot = opposite(currentSlot);
      lastTime = g.rawTime;
    }
    // Same time slot = hold
    return { ...g, slot: currentSlot };
  });
}

// ── NBA PROMPT BUILDER ────────────────────────────────────────────────────────

export function buildNBAPrompt(gameData) {
  const isPlayoffs = gameData.gameType === 'playoffs';

  return `You are the Vegas Vault AI Model — NBA Edition.

IMPORTANT CONTEXT: It is currently May 2026. The NBA Playoffs are in progress.
NOTE ON SPREAD DATA: The spread shown may be a 1st-half line, not a full game spread. Use the moneyline as the primary pricing reference. If spread seems inconsistent with the moneyline, ignore the spread and focus on ML analysis. This is NOT a regular season game. Treat every game as a playoff game with series context, higher stakes, and different dynamics than regular season. Do NOT pass because of "date anomaly" — playoff games happen in May and June. A professional basketball betting analysis system.

CORE PHILOSOPHY:
Identify when market pricing misrepresents reality. The matchup tells you what SHOULD happen. The line tells you what Vegas is PRESENTING. The edge lives in the gap. Psychology is more important than stats alone. Keep it simple — overanalyzing causes avoidable losses. The goal is consistent wins, not just value bets.

GAME DATA:
- Matchup: ${gameData.away} @ ${gameData.home}
- Date: ${gameData.date}
- Time: ${gameData.time}
- Game Type: ${gameData.isPlayoffs ? 'NBA PLAYOFFS' : 'REGULAR SEASON'}
- Playoff Context: ${gameData.playoffContext || (gameData.isPlayoffs ? 'NBA Playoffs' : 'Regular Season')}
${gameData.isPlayoffs && gameData.playoffGameNumber ? `- PLAYOFF GAME ${gameData.playoffGameNumber} | Series: ${gameData.playoffSeriesRecord || 'N/A'}` : ''}
- Slot: ${gameData.slot}

ODDS & LINE MOVEMENT:
- Current Line (DraftKings): ${gameData.away} ${gameData.awayML} / ${gameData.home} ${gameData.homeML}
- Opening Line: ${gameData.openingAwayML || 'N/A'}
- Spread: ${gameData.spread}
- Total (O/U): ${gameData.total}
- Line Movement: ${gameData.lineMovement || 'No movement data'}
- % of Bets: ${gameData.betPercentage || 'N/A'}
- % of Money: ${gameData.moneyPercentage || 'N/A'}
- Reverse Line Movement: ${gameData.rlm || 'None detected'}

DISCREPANCY DATA — ANALYZE ALL FOUR:
1. CROSS-BOOK COMPARISON (FD/DK/MGM/CZR/B365): ${gameData.pricingStr || gameData.openingAwayML || 'Check sportsbooks'}
2. OPENING vs CURRENT LINE: Opening: ${gameData.openingAwayML || 'N/A'} | Current: ${gameData.away} ${gameData.awayML} / ${gameData.home} ${gameData.homeML} | Movement: ${gameData.lineMovement || 'No movement'}
3. PUBLIC vs SHARP: Public Bets: ${gameData.betPercentage || 'N/A'} | Sharp Money: ${gameData.moneyPercentage || 'N/A'}
4. MODEL vs MARKET: After running the full matchup analysis, compare your conclusion to the price. State the gap explicitly.

SHARP MONEY SIGNALS:
${gameData.rlm ? `⚡ REVERSE LINE MOVEMENT on ${gameData.rlm} — sharp money signal` : 'No reverse line movement detected.'}

RECORDS:
${gameData.away}:
  Overall: ${gameData.awayRecord} | Home: ${gameData.awayHomeRecord || 'N/A'} | Away: ${gameData.awayAwayRecord || 'N/A'} | ATS: ${gameData.awayATS || 'N/A'}
  Last 5: ${gameData.awayLast5 || 'N/A'} | Last 10: ${gameData.awayLast10 || 'N/A'} | Streak: ${gameData.awayStreak || 'N/A'}
${gameData.home}:
  Overall: ${gameData.homeRecord} | Home: ${gameData.homeHomeRecord || 'N/A'} | Away: ${gameData.homeAwayRecord || 'N/A'} | ATS: ${gameData.homeATS || 'N/A'}
  Last 5: ${gameData.homeLast5 || 'N/A'} | Last 10: ${gameData.homeLast10 || 'N/A'} | Streak: ${gameData.homeStreak || 'N/A'}

REST & BACK-TO-BACKS:
${gameData.away}: ${gameData.awayRest} days rest ${gameData.awayB2B ? '(BACK-TO-BACK)' : '(rested)'}
${gameData.home}: ${gameData.homeRest} days rest ${gameData.homeB2B ? '(BACK-TO-BACK)' : '(rested)'}

TEAM STATS:
${gameData.away}: PPG: ${gameData.awayPPG} | OPP PPG: ${gameData.awayOppPPG} | Off Rating: ${gameData.awayOffRating} | Def Rating: ${gameData.awayDefRating} | Pace: ${gameData.awayPace}
${gameData.home}: PPG: ${gameData.homePPG} | OPP PPG: ${gameData.homeOppPPG} | Off Rating: ${gameData.homeOffRating} | Def Rating: ${gameData.homeDefRating} | Pace: ${gameData.homePace}

KEY PLAYERS & INJURIES:
${gameData.away} key players: ${gameData.awayKeyPlayers}
${gameData.home} key players: ${gameData.homeKeyPlayers}
Injuries/Status (RotoWire): ${gameData.injuries}

HEAD TO HEAD:
${gameData.h2h || gameData.espnH2H || 'No H2H data available'}
Last 5 matchups: ${gameData.h2hLast5 || 'N/A'}
At ${gameData.home} (home): ${gameData.h2hAtHome || 'N/A'}
${gameData.isPlayoffs ? `Playoff Series: ${gameData.playoffContext}` : ''}

COVERS.COM H2H & ATS HISTORY:
${gameData.coversH2H || ''}

CBS SPORTS PREVIEW & MEDIA NARRATIVE:
${gameData.cbsPreview}

---

${isPlayoffs ? `
PLAYOFF MODE — APPLY THESE RULES:
- Series context is the strongest edge. Apply exactly:
  * Team down 0-1: urgency, must respond → lean bounce-back
  * Team down 0-2: desperation, season on line → strong bounce-back lean
  * Team up 2-0: slight letdown possible, opponent desperate → regression possible
  * Team down 2-3: eliminate-or-go-home → one of the strongest edges in basketball betting
  * Team up 3-2: close-out game → favorites often cover, opponent plays loose
  * Blowouts rarely repeat in playoffs (20+ pt loss → fade repeat blowout next game)
  * Home court is amplified in playoffs — crowd is a real factor
  * Star player usage goes up in playoffs — role players matter less
  * Coaching adjustments between games are real — blown-out teams adjust
  * Public massively overreacts to blowout wins and losses in playoffs
` : `
REGULAR SEASON MODE — APPLY THESE RULES:
- Back-to-backs are one of the biggest NBA edges:
  * Road B2B = significant disadvantage (biggest edge)
  * Home B2B = moderate disadvantage
  * Rested vs B2B = strong lean toward rested
  * Exception: elite deep-roster teams sometimes cover B2B at home
- Rest advantage (2+ days vs 0) = legitimate edge
- Motivation matters: playoff race, tanking, locked seeds, revenge games
- Public overvalues big market teams: Lakers, Warriors, Knicks, Celtics, Heat
- Look for trends: ATS, home/away, after wins/losses, vs specific opponents
`}

---

Run the FULL Vegas Vault AI NBA Model in this EXACT order. Do not skip any step.

STEP 1 — MATCHUP FOUNDATION
Who should win based purely on basketball? Ignore the line. Evaluate: pace matchup, offensive vs defensive strengths, star player matchup, style of play (fast/slow, three-point heavy/paint dominant), which team's strengths attack the other's weaknesses. This is the truth layer.

STEP 2 — RECORDS
Overall, home, away records. Streaks (overall, home, away). Last 5 and last 10. Real record vs padded record — who did they beat?

STEP 3 — RECENT FORM
Last 5 = accuracy (who's hot now). Last 10 = trend (consistency). Blowout wins vs close wins. Real form vs fake form. Winning ugly or dominating?

STEP 4 — HEAD TO HEAD
Use ESPN H2H and Covers.com data above. Last 5 matchups. Who controls the series. Margin of victory. ATS record from Covers. If playing at home, look specifically at the last time they played at home against this opponent.

STEP 5 — KEY PLAYER / LINEUP ANALYSIS
Star player matchup — who wins the best player battle. Second unit depth — does the bench hold leads? Better supporting cast? Key player on minutes restriction? Playing through injury? Factor in every player who meaningfully impacts the outcome for their team.

STEP 6 — PACE & OFFENSIVE/DEFENSIVE RATING
Offensive rating vs opponent's defensive rating — who has the advantage? Pace matchup — fast vs slow. Does the total make sense given pace? Three-point reliance vs paint dominance. Turnover tendencies vs steal rate.

STEP 7 — GAME SCRIPT
Classify:
- Blowout potential (15+ pt mismatch → favors spread or ML of heavy favorite)
- Competitive game (5-10 pt margin → favors spread or ML)
- Coin flip (too close → lean toward better value or pass)
This determines WHAT you bet, not just WHO.

STEP 8 — SERIES / SCHEDULE CONTEXT
Regular season: B2B analysis, rest advantage, schedule spot (emotional game after big win/loss, trap game, revenge game, playoff implications).
Playoffs: Apply series rules above exactly. Blowout repeat fade. Home court factor. Coaching adjustments.

STEP 9 — TRELL RULE
Check RotoWire injury report above plus every key and star player on both rosters — anyone whose absence or return significantly impacts their team's win probability.
ACTIVATES: First game a key player is OUT → Bet ON that team (market overreacts, team adjusts internally).
ACTIVATES: First game a key player RETURNS → Bet AGAINST that team (rust, chemistry disruption).
Does NOT apply if player has been out or back for multiple games.
State: ACTIVE or INACTIVE. If active: player name, team, direction.

STEP 10 — PRICING COMPREHENSION
Does the line make sense given the matchup? Opening line vs current — did it move right? Is the spread too big or small? Is the total set correctly given pace? Value on the number? Paying juice is acceptable if the play is clear.

STEP 11 — LINE MOVEMENT
Confirmation only — NOT decision making. Opening to current. Sharp money direction. Bet % vs money % alignment. If movement is against your read — re-examine injuries and lineup. Never switch sides because of movement alone.

STEP 12 — VEGAS VS PUBLIC + PROPAGANDA ANALYSIS
Public slot: Better team usually wins. Look for trends. Sometimes the scam play is on the public side.
Vegas slot: Looking for scams and mispriced reality. Scam play = the side you WANT to be on.
Where is public money? Where is sharp money? Aligned or split?

PROPAGANDA ANALYSIS (run every game — this is a major edge):
Using the CBS Sports preview and your knowledge of current media narratives, identify what story ESPN, CBS Sports, TNT, NBA TV, and sports radio are selling to the public about this game.
Ask: What narrative is being pushed right now?
Common propaganda patterns:
- "Team X is unstoppable" after a blowout win
- "Team Y is in crisis / falling apart" after a bad loss
- "Star player is taking over the series"
- "This team always wins at home in the playoffs"
- "The series is already over" after a 2-0 lead
- "Coach X is outcoaching Coach Y"
- Injury narrative being overblown or deliberately underplayed
- Media crowning a champion before the series is decided
Determine: Is the propaganda creating a betting opportunity by pushing the public too hard on one side? Is the public overreacting to what the media is telling them? Use this to sharpen your scam play identification and Vegas vs public analysis.

STEP 13 — SCAM PLAY IDENTIFICATION (MANDATORY ON EVERY VEGAS GAME)
Label: ACTIVE or INACTIVE
If active:
WHY IT LOOKS WRONG: Public narrative, media propaganda, recent blowout overreaction, star power bias, big market team inflation, hot streak making wrong side look obvious, CBS Sports angle pushing public money
WHY IT'S ACTUALLY CORRECT: Matchup reality, pace mismatch, B2B edge, rest advantage, pricing mismatch, series context, Trell Rule, line movement confirmation, propaganda fade opportunity

STEP 14 — TIER
LOCK Tier 1: Matchup clearly favors side, game script aligns, no major contradictions, propaganda working in our favor
Tier 2: Good edge with one uncertainty (B2B team sometimes covers, star questionable, line moved against you slightly)
Tier 3 / PASS: Weak edge, too close to call, conflicting signals, or game conflicts with its slot → AUTOMATIC PASS
Tiers based ONLY on matchup and analysis — NOT price or movement. Movement increases confidence but does NOT change tier.
If game situation conflicts with its assigned slot → automatic pass.

STEP 15 — BET TYPE
Do NOT default to ML. Evaluate every option and choose the sharpest play:

ML: When one team has clear win edge and no better value exists elsewhere.
SPREAD: When game script projects a clear margin. Use when spread is available.
OVER [total]: When both offenses are rolling, fast pace teams, neither defense is stopping the other, total set conservatively. Regular season overs hit more than playoffs.
UNDER [total]: When elite defenses clash, slow pace teams, playoff intensity tightens scoring, total set too high. CRITICAL: NBA Playoffs go UNDER at significantly higher rates than regular season — defensive adjustments, slower pace, more timeouts, and coaching schemes compress scoring. If total seems high for a playoff game, lean UNDER. Always evaluate the total as a primary play option — sometimes it's clearer than picking a side.

PLAYOFF TOTALS NOTE: Historical playoff data shows unders hit ~54-56% in playoff games vs 48-50% in regular season. If both teams have elite defenses and the total is 215+, the under is often the sharpest play regardless of which team you like.
Always choose the BEST play — not automatically ML. Spreads up to -190 acceptable if game script and safety align.

---

Return ONLY a valid JSON object — no preamble, no markdown, nothing outside the JSON:

{
  "summary": {
    "pick": "TEAM NAME",
    "betType": "ML or Spread or Over or Under",
    "spreadValue": "e.g. -4.5 or +6.5 or null",
    "tier": "1 or 2 or 3 or PASS",
    "tierLabel": "LOCK or Tier 2 or Tier 3 or PASS",
    "slot": "PUBLIC or VEGAS",
    "isScamPlay": true,
    "verdict": "One sentence final verdict.",
    "confidence": "HIGH or MEDIUM or LOW"
  },
  "analysis": {
    "matchupFoundation": "Who should win based purely on basketball. Pace, style, star matchup, offensive vs defensive strengths.",
    "records": "Record analysis. Home/away splits. Streaks. Last 5 and 10. Real vs padded record.",
    "recentForm": "Last 5 accuracy, last 10 trend. Blowouts vs close games. Real form vs fake form.",
    "headToHead": "H2H breakdown. Who controls the series. Last time at this home court.",
    "keyPlayerLineup": "Star player matchup. Bench depth. Minutes restrictions. Playing through injury. Who wins the supporting cast battle.",
    "paceOffDefRating": "Offensive rating vs opponent defensive rating. Pace matchup. Total implications.",
    "gameScript": "Blowout / Competitive / Coin flip. What this means for bet type.",
    "scheduleSeriesContext": "Regular season: B2B, rest, schedule spot. Playoffs: series score, blowout fade, home court.",
    "trellRule": "ACTIVE or INACTIVE. If active: player, team, direction, why.",
    "pricingComprehension": "Does the line make sense? Opening vs current. Appropriately priced?",
    "lineMovement": "Opening to current. Direction. Sharp vs public. Confirmation or concern.",
    "vegasVsPublicPropaganda": "Where is public? Sharp money? What narrative is media pushing? What propaganda exists? Is it creating a betting opportunity? How does it affect our pick?",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative, media propaganda, blowout overreaction, star bias, big market inflation.",
      "whyItsActuallyCorrect": "Matchup reality, B2B edge, rest advantage, pricing mismatch, series context, Trell Rule, line movement, propaganda fade."
    }
  },
  "finalVerdict": "2-3 sentences explaining the pick, bet type, and the core reason why."
}`;
}

// ── NBA MOCK GAMES (fallback when no live NBA games) ──────────────────────────

export const NBA_MOCK_GAMES = [
  {
    id: 101,
    sport: 'NBA',
    gameType: 'playoffs',
    rawTime: new Date().toISOString(),
    time: '7:30 PM CT',
    date: new Date().toISOString().split('T')[0],
    away: 'Oklahoma City Thunder',
    home: 'San Antonio Spurs',
    awayRecord: 'See standings', homeRecord: 'See standings',
    awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
    awayLast5: 'N/A', homeLast5: 'N/A',
    awayLast10: 'N/A', homeLast10: 'N/A',
    awayStreak: 'N/A', homeStreak: 'N/A',
    awayML: '-116', homeML: '-104',
    openingAwayML: '-110', openingHomeML: '-110',
    spread: 'OKC -1.5', total: '228.5',
    lineMovement: 'Slight movement toward OKC.',
    betPercentage: 'N/A', moneyPercentage: 'N/A',
    awayRest: 2, homeRest: 2,
    awayB2B: false, homeB2B: false,
    awayPPG: 'N/A', awayOppPPG: 'N/A',
    homePPG: 'N/A', homeOppPPG: 'N/A',
    awayOffRating: 'N/A', awayDefRating: 'N/A', awayPace: 'N/A',
    homeOffRating: 'N/A', homeDefRating: 'N/A', homePace: 'N/A',
    awayKeyPlayers: 'Shai Gilgeous-Alexander',
    homeKeyPlayers: 'Check roster',
    injuries: 'Check NBA injury report',
    h2hLast5: 'N/A', h2hAtHome: 'N/A',
    seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
    seriesHistory: 'N/A',
    cbsPreview: 'CBS Sports preview not available.',
    slot: 'VEGAS',
  },
  {
    id: 102,
    sport: 'NBA',
    gameType: 'playoffs',
    rawTime: new Date(Date.now() + 5400000).toISOString(),
    time: '9:00 PM CT',
    date: new Date().toISOString().split('T')[0],
    away: 'New York Knicks',
    home: 'Cleveland Cavaliers',
    awayRecord: 'See standings', homeRecord: 'See standings',
    awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
    awayLast5: 'N/A', homeLast5: 'N/A',
    awayLast10: 'N/A', homeLast10: 'N/A',
    awayStreak: 'N/A', homeStreak: 'N/A',
    awayML: '+114', homeML: '-135',
    openingAwayML: '+110', openingHomeML: '-130',
    spread: 'CLE -2.5', total: '214.0',
    lineMovement: 'Opened CLE -130, moved to -135. Money on Cleveland.',
    betPercentage: 'N/A', moneyPercentage: 'N/A',
    awayRest: 2, homeRest: 2,
    awayB2B: false, homeB2B: false,
    awayPPG: 'N/A', awayOppPPG: 'N/A',
    homePPG: 'N/A', homeOppPPG: 'N/A',
    awayOffRating: 'N/A', awayDefRating: 'N/A', awayPace: 'N/A',
    homeOffRating: 'N/A', homeDefRating: 'N/A', homePace: 'N/A',
    awayKeyPlayers: 'Jalen Brunson, Karl-Anthony Towns',
    homeKeyPlayers: 'Donovan Mitchell, Darius Garland, Evan Mobley',
    injuries: 'Check NBA injury report',
    h2hLast5: 'N/A', h2hAtHome: 'N/A',
    seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
    seriesHistory: 'N/A',
    cbsPreview: 'CBS Sports preview not available.',
    slot: 'PUBLIC',
  },
];
