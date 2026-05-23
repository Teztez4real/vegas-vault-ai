/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VEGAS VAULT AI MODEL — NBA VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Same 15-step flow as MLB. Same tier system.
 * NBA slot days: Public = Mon/Wed/Fri | Vegas = Tue/Thu/Sat/Sun
 * First game = opposite of day base.
 * Same time slot = hold. Different time slot = switch.
 *
 * Two modes: REGULAR SEASON and PLAYOFFS (different logic for each)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── SLOT SYSTEM (NBA) ─────────────────────────────────────────────────────────

export function assignNBASlots(games) {
  // NBA Slot Days:
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
    // Same time slot = hold (no switch)
    return { ...g, slot: currentSlot };
  });
}

// ── NBA PROMPT BUILDER ────────────────────────────────────────────────────────

export function buildNBAPrompt(gameData) {
  const isPlayoffs = gameData.gameType === 'playoffs';

  return `You are the Vegas Vault AI Model — NBA Edition. A professional basketball betting analysis system.

CORE PHILOSOPHY:
Identify when market pricing misrepresents reality. The matchup tells you what SHOULD happen. The line tells you what Vegas is PRESENTING. The edge lives in the gap. Psychology is more important than stats alone. Keep it simple — overanalyzing causes avoidable losses. The goal is consistent wins, not just value bets.

GAME DATA:
- Matchup: ${gameData.away} @ ${gameData.home}
- Date: ${gameData.date}
- Time: ${gameData.time}
- Game Type: ${isPlayoffs ? 'PLAYOFFS' : 'REGULAR SEASON'}
${isPlayoffs ? `- Playoff Series: Game ${gameData.seriesGame} | Series: ${gameData.away} ${gameData.awaySeriesWins}-${gameData.homeSeriesWins} ${gameData.home}` : ''}
- Slot: ${gameData.slot}

ODDS & LINE MOVEMENT:
- Current Line: ${gameData.away} ${gameData.awayML} / ${gameData.home} ${gameData.homeML}
- Opening Line: ${gameData.away} ${gameData.openingAwayML} / ${gameData.home} ${gameData.openingHomeML}
- Spread: ${gameData.spread}
- Total (O/U): ${gameData.total}
- Line Movement: ${gameData.lineMovement}
- % of Bets: ${gameData.betPercentage}
- % of Money: ${gameData.moneyPercentage}

RECORDS:
${gameData.away}: ${gameData.awayRecord} overall | ${gameData.awayAwayRecord} away | Last 5: ${gameData.awayLast5} | Last 10: ${gameData.awayLast10} | Away streak: ${gameData.awayStreak}
${gameData.home}: ${gameData.homeRecord} overall | ${gameData.homeHomeRecord} home | Last 5: ${gameData.homeLast5} | Last 10: ${gameData.homeLast10} | Home streak: ${gameData.homeStreak}

REST & BACK-TO-BACKS:
${gameData.away}: ${gameData.awayRest} days rest ${gameData.awayB2B ? '(BACK-TO-BACK ⚠️)' : '(rested)'}
${gameData.home}: ${gameData.homeRest} days rest ${gameData.homeB2B ? '(BACK-TO-BACK ⚠️)' : '(rested)'}

TEAM STATS:
${gameData.away}: PPG: ${gameData.awayPPG} | OPP PPG: ${gameData.awayOppPPG} | Off Rating: ${gameData.awayOffRating} | Def Rating: ${gameData.awayDefRating} | Pace: ${gameData.awayPace}
${gameData.home}: PPG: ${gameData.homePPG} | OPP PPG: ${gameData.homeOppPPG} | Off Rating: ${gameData.homeOffRating} | Def Rating: ${gameData.homeDefRating} | Pace: ${gameData.homePace}

KEY PLAYERS & INJURIES:
${gameData.away} key players: ${gameData.awayKeyPlayers}
${gameData.home} key players: ${gameData.homeKeyPlayers}
Injuries/Status: ${gameData.injuries}

HEAD TO HEAD:
Last 5 matchups: ${gameData.h2hLast5}
At ${gameData.home} (home, last time they played there): ${gameData.h2hAtHome}
${isPlayoffs ? `Playoff series history: ${gameData.seriesHistory}` : ''}

CBS SPORTS PREVIEW:
${gameData.cbsPreview}

---

${isPlayoffs ? `
PLAYOFF MODE — APPLY THESE RULES:
- Series context is the strongest edge in playoff betting. Apply exactly:
  * Team down 0-1: urgency, must respond → lean bounce-back
  * Team down 0-2: desperation, season on line → strong bounce-back lean
  * Team up 2-0: slight letdown possible, opponent desperate → regression possible
  * Team down 2-3: eliminate-or-go-home energy → one of the strongest edges in basketball betting
  * Team up 3-2: close-out game → favorites often cover, opponents play loose
  * Blowouts rarely repeat in playoffs (20+ pt loss → fade repeat blowout)
  * Home court is amplified in playoffs — crowd is a real factor
  * Star player usage increases in playoffs — role players matter less
  * Coaching adjustments between games are real — teams that got blown out adjust
  * Public massively overreacts to blowout wins and losses in playoffs — fade the overreaction
` : `
REGULAR SEASON MODE — APPLY THESE RULES:
- Back-to-backs are one of the biggest edges in NBA betting:
  * Road B2B = significant disadvantage (biggest edge)
  * Home B2B = moderate disadvantage
  * Rested team vs B2B team = strong lean toward rested
  * Exception: elite teams with deep rosters sometimes cover B2B on home floor
- Rest advantage (2+ days vs 0) = legitimate edge worth noting
- Motivation matters: playoff positioning, tanking teams, locked-in seeds, revenge games
- Public heavily overvalues big market teams: Lakers, Warriors, Knicks, Celtics, Heat — always check if line is inflated
- Trends matter: ATS trends home and away, against specific opponents, after wins/losses
- Look for schedule spots: teams coming off emotional wins or devastating losses
`}

---

Run the FULL Vegas Vault AI NBA Model in this EXACT order. Do not skip any step.

STEP 1 — MATCHUP FOUNDATION
Who should win based purely on basketball? Ignore the line. Evaluate: pace matchup, offensive vs defensive strengths, star player matchup, style of play (fast/slow, three-point heavy/paint dominant), which team's strengths attack the other's weaknesses.

STEP 2 — RECORDS
Overall, home, away records. Home/away streaks. Last 5 and last 10. Real record vs padded record (who did they beat?).

STEP 3 — RECENT FORM
Last 5 = accuracy (who's hot right now). Last 10 = trend (consistency). Blowout wins vs close wins. Real form vs fake form. Are they winning ugly or dominating?

STEP 4 — HEAD TO HEAD
Last 5 matchups. Who controls the series. Margin of victory. If playing at home, look specifically at last time they played at home against this opponent.

STEP 5 — KEY PLAYER / LINEUP ANALYSIS
Star player matchup — who wins the best player battle. Second unit depth — does the bench hold leads? Who has the better supporting cast? Any key player on minutes restriction? Any player playing through injury?

STEP 6 — PACE & OFFENSIVE/DEFENSIVE RATING
Offensive rating vs opponent's defensive rating — who has the advantage? Pace matchup — fast vs slow. Does the total make sense given pace? Three-point reliance vs paint dominance. Turnover tendencies vs opponent's steal rate.

STEP 7 — GAME SCRIPT
Classify as:
- Blowout potential (15+ point mismatch expected → favors spread or ML of heavy favorite)
- Competitive game (5-10 point margin → favors spread or ML)
- Coin flip (too close to call → lean toward better value or pass)
This determines WHAT you bet, not just WHO.

STEP 8 — SERIES / SCHEDULE CONTEXT
Regular season: Back-to-back analysis, rest advantage, schedule spot (emotional game after big win/loss, trap game, revenge game, playoff implications).
Playoffs: Series score context. Apply the playoff rules above exactly. Blowout repeat fade. Home court factor.

STEP 9 — TRELL RULE
Check every key and star player on both rosters — anyone whose absence or return significantly impacts win probability.
ACTIVATES on FIRST GAME a key player is OUT → Bet ON that team (market overreacts to star absence, team adjusts).
ACTIVATES on FIRST GAME a key player RETURNS → Bet AGAINST that team (rust, chemistry disruption, market overcorrects).
Does NOT apply if player has been out or back for multiple games already.
State: ACTIVE or INACTIVE. If active, name the player, their team, and the direction.

STEP 10 — PRICING COMPREHENSION
Does the line make sense given the matchup? Is this team appropriately priced? Is the spread too big or too small? Is the total set correctly given pace? Are you getting good value or being asked to lay too much juice? Note: paying juice is acceptable if the play is clear.

STEP 11 — LINE MOVEMENT
Confirmation only — NOT decision making. Where did the line open? Where is it now? Is sharp money confirming your side? If movement is against your read, re-examine injuries and lineup. Never switch sides or change tiers because of movement alone.

STEP 12 — VEGAS VS PUBLIC
Public slot: Straightforward — better team usually wins. Look for trends. Sometimes the scam play is on the public side.
Vegas slot: Looking for scams and mispriced reality. The scam play = the side you WANT to be on (not automatically the underdog or opposite side).
Where is the public money? Where is the sharp money? Are they aligned or split?

STEP 13 — SCAM PLAY IDENTIFICATION (MANDATORY ON EVERY VEGAS GAME)
Label: ACTIVE or INACTIVE
If active:
WHY IT LOOKS WRONG: public narrative, recent blowout, star player reputation, big market team bias, recent hot streak making the wrong team look unbeatable
WHY IT'S ACTUALLY CORRECT: matchup reality, pace mismatch, B2B disadvantage, rest edge, pricing mismatch, series context, Trell Rule, line movement confirmation

STEP 14 — TIER
🔒 Tier 1 LOCK: Matchup clearly favors side, game script aligns, no major contradictions, high confidence
⭐ Tier 2: Good edge with one uncertainty (B2B team covers sometimes, star player questionable, line moved against you)
⚠️ Tier 3 / PASS: Weak edge, too close to call, conflicting signals, or game conflicts with its slot situation → AUTOMATIC PASS
Tiers based ONLY on matchup and analysis. NOT price or movement. Movement increases confidence but does NOT change tier.
If the game situation conflicts with its assigned slot → automatic pass.

STEP 15 — BET TYPE
ML: Close game expected, uncertain margin
Spread: Clear margin expected, value on the number
Over: High pace, both offenses cooking, neither defense stopping the other
Under: Defensive battle, slow pace, key offensive players injured
Always choose the BEST play — not automatically ML. Spreads up to -190 acceptable if game script and safety align.

---

Return ONLY a valid JSON object — no preamble, no markdown, nothing outside the JSON:

{
  "summary": {
    "pick": "TEAM NAME",
    "betType": "ML or Spread or Over or Under",
    "spreadValue": "e.g. -4.5 or +6.5 (include only if spread bet, otherwise null)",
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
    "paceOffDefRating": "Offensive rating vs opponent defensive rating. Pace matchup. Total implications. Turnover and three-point tendencies.",
    "gameScript": "Blowout / Competitive / Coin flip. What this means for bet type.",
    "scheduleSeriesContext": "Regular season: B2B, rest, schedule spot, motivation, playoff implications. Playoffs: series score context, blowout fade, home court factor.",
    "trellRule": "ACTIVE or INACTIVE. If active: player name, team, direction, and why.",
    "pricingComprehension": "Does the line make sense? Is this team appropriately priced? Spread too big or small? Total set correctly?",
    "lineMovement": "Opening to current. Direction. Sharp vs public money. Confirmation or concern.",
    "vegasVsPublic": "Where is public? Where is sharp money? Trap potential. Big market bias check.",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative, recent blowout, star power bias, big market inflation making wrong side look obvious.",
      "whyItsActuallyCorrect": "Matchup reality, B2B edge, rest advantage, pricing mismatch, series context, Trell Rule, line movement."
    }
  },
  "finalVerdict": "2-3 sentences explaining the pick, bet type, and the core reason why."
}`;
}

// ── NBA MOCK GAME DATA (fallback) ─────────────────────────────────────────────

export const NBA_MOCK_GAMES = [
  {
    id: 101,
    sport: 'NBA',
    gameType: 'playoffs',
    rawTime: '2026-05-22T19:30:00Z',
    time: '7:30 PM CT',
    date: '2026-05-22',
    away: 'Oklahoma City Thunder',
    home: 'Denver Nuggets',
    awayRecord: '68-14', homeRecord: '55-27',
    awayAwayRecord: '31-10', homeHomeRecord: '31-10',
    awayLast5: '4-1', homeLast5: '3-2',
    awayLast10: '8-2', homeLast10: '6-4',
    awayStreak: 'W2', homeStreak: 'L1',
    awayML: '-130', homeML: '+110',
    openingAwayML: '-115', openingHomeML: '+115',
    spread: 'OKC -2.5',
    total: '218.5',
    betPercentage: 'N/A', moneyPercentage: 'N/A',
    lineMovement: 'Opened OKC -115, moved to -130. Sharp action on OKC.',
    awayRest: 2, homeRest: 2,
    awayB2B: false, homeB2B: false,
    awayPPG: '118.6', homeOppPPG: '110.2',
    awayOppPPG: '106.1', homePPG: '114.3',
    homeOppPPG: '112.8', awayPPG2: '118.6',
    awayOffRating: '122.1', awayDefRating: '108.4', awayPace: '99.2',
    homeOffRating: '116.8', homeDefRating: '113.1', homePace: '96.4',
    awayKeyPlayers: 'Shai Gilgeous-Alexander (avg 32.8 PPG), Jalen Williams (22.1 PPG), Chet Holmgren (14.2 PPG)',
    homeKeyPlayers: 'Nikola Jokic (avg 29.4 PPG, 13.1 REB), Jamal Murray (21.2 PPG), Michael Porter Jr (16.8 PPG)',
    injuries: 'Nuggets: Aaron Gordon (questionable, knee) | Thunder: all clear',
    h2hLast5: 'OKC 3-2 in last 5 regular season matchups',
    h2hAtHome: 'Nuggets 2-1 vs OKC at Ball Arena last 3',
    seriesGame: 3,
    awaySeriesWins: 2, homeSeriesWins: 0,
    seriesHistory: 'Nuggets beat OKC in first round 2024. OKC seeking revenge.',
    cbsPreview: 'CBS Sports preview not available — use available data.',
    slot: 'VEGAS',
  },
  {
    id: 102,
    sport: 'NBA',
    gameType: 'playoffs',
    rawTime: '2026-05-22T21:00:00Z',
    time: '9:00 PM CT',
    date: '2026-05-22',
    away: 'Boston Celtics',
    home: 'Cleveland Cavaliers',
    awayRecord: '61-21', homeRecord: '64-18',
    awayAwayRecord: '28-13', homeHomeRecord: '36-5',
    awayLast5: '3-2', homeLast5: '4-1',
    awayLast10: '6-4', homeLast10: '8-2',
    awayStreak: 'W1', homeStreak: 'W3',
    awayML: '-115', homeML: '-105',
    openingAwayML: '-130', openingHomeML: '+110',
    spread: 'CLE -1.5',
    total: '214.0',
    betPercentage: 'N/A', moneyPercentage: 'N/A',
    lineMovement: 'Opened Boston -130, moved to -115. Sharp money shifting toward Cleveland.',
    awayRest: 2, homeRest: 2,
    awayB2B: false, homeB2B: false,
    awayPPG: '120.6', awayOppPPG: '110.1',
    homePPG: '123.4', homeOppPPG: '107.8',
    awayOffRating: '121.3', awayDefRating: '109.8', awayPace: '97.8',
    homeOffRating: '124.1', homeDefRating: '107.2', homePace: '98.1',
    awayKeyPlayers: 'Jayson Tatum (26.4 PPG), Jaylen Brown (23.1 PPG), Jrue Holiday (13.2 PPG)',
    homeKeyPlayers: 'Donovan Mitchell (33.1 PPG playoffs), Darius Garland (19.4 PPG), Evan Mobley (17.2 PPG)',
    injuries: 'Celtics: Kristaps Porzingis (out, knee) | Cavaliers: all clear',
    h2hLast5: 'Split 2-2-1 in last 5 regular season',
    h2hAtHome: 'Cavaliers 3-0 vs Boston at Rocket Mortgage this season',
    seriesGame: 2,
    awaySeriesWins: 0, homeSeriesWins: 1,
    seriesHistory: 'Celtics beat Cavaliers in 2024 playoffs. Cleveland looking for revenge.',
    cbsPreview: 'CBS Sports preview not available — use available data.',
    slot: 'PUBLIC',
  },
];

// ── NBA API DATA FETCHER ───────────────────────────────────────────────────────
// Uses NBA Stats API (free) + The Odds API for lines

export async function fetchNBASchedule() {
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    // NBA Stats API - game schedule
    const res = await fetch(
      `https://stats.nba.com/stats/scoreboardV2?DayOffset=0&LeagueID=00&gameDate=${today.slice(4,6)}%2F${today.slice(6,8)}%2F${today.slice(0,4)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.nba.com/',
          'x-nba-stats-origin': 'stats',
          'x-nba-stats-token': 'true',
        },
        next: { revalidate: 600 }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.resultSets?.[0]?.rowSet || [];
  } catch {
    return [];
  }
}

export async function fetchNBAOdds(apiKey) {
  if (!apiKey) return {};
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const oddsMap = {};
    for (const game of (Array.isArray(data) ? data : [])) {
      const key = `${game.away_team}|${game.home_team}`;
      const bookmaker = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const spreads = bookmaker?.markets?.find(m => m.key === 'spreads');
      const totals = bookmaker?.markets?.find(m => m.key === 'totals');

      const fmt = (p) => p ? (p > 0 ? `+${p}` : `${p}`) : 'N/A';
      const homeML = h2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find(o => o.name === game.home_team);
      const total = totals?.outcomes?.[0]?.point;

      // Opening line from last bookmaker
      const openBook = game.bookmakers?.[game.bookmakers.length - 1];
      const openH2h = openBook?.markets?.find(m => m.key === 'h2h');
      const openHomeML = openH2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const openAwayML = openH2h?.outcomes?.find(o => o.name === game.away_team)?.price;

      let lineMovement = 'No significant movement';
      if (openHomeML && homeML && openHomeML !== homeML) {
        const diff = homeML - openHomeML;
        lineMovement = `Home opened ${fmt(openHomeML)}, now ${fmt(homeML)} (${diff > 0 ? 'moved toward home' : 'moved toward away'}, ${Math.abs(diff)} pts).`;
      }

      oddsMap[key] = {
        homeML: fmt(homeML), awayML: fmt(awayML),
        openingHomeML: fmt(openHomeML), openingAwayML: fmt(openAwayML),
        spread: homeSpread ? `${game.home_team} ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point}` : 'N/A',
        total: total ? `${total}` : 'N/A',
        lineMovement,
        betPercentage: 'Available with paid Odds API tier',
        moneyPercentage: 'Available with paid Odds API tier',
      };
    }
    return oddsMap;
  } catch {
    return {};
  }
}
