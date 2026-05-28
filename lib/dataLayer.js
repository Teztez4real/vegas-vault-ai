/**
 * VEGAS VAULT AI — REAL DATA LAYER
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls live data from three sources and assembles complete game objects
 * ready to be injected directly into the Vegas Vault AI prompt engine.
 *
 * DATA SOURCES:
 *  1. MLB Stats API (statsapi.mlb.com) — FREE, no key required
 *     → Schedule, team records, lineups, pitcher stats, bullpen ERA
 *
 *  2. The Odds API (the-odds-api.com) — PAID, ~$50/mo starter tier
 *     → Moneylines, run lines, totals, line movement tracking
 *     Sign up: https://the-odds-api.com
 *     Env var: ODDS_API_KEY
 *
 *  3. RotoWire API (rotowire.com) — PAID, contact for pricing
 *     → Confirmed lineups, injuries, player news, Trell-rule triggers
 *     Sign up: https://www.rotowire.com/sports-data/
 *     Env var: ROTOWIRE_API_KEY
 *
 * HOW TO USE:
 *  const { getTodaysGames, getTodaysTennisMatches } = require('./dataLayer');
 *  const games = await getTodaysGames();         // returns array of MLB game objects
 *  const matches = await getTodaysTennisMatches(); // returns array of tennis match objects
 *
 * SLOT SYSTEM:
 *  The slot (PUBLIC / VEGAS) is automatically assigned per the Vegas Vault
 *  slot rules: first game = opposite of day base, alternates on new time slots.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────

const CONFIG = {
  ODDS_API_KEY: process.env.ODDS_API_KEY || "YOUR_ODDS_API_KEY",
  ROTOWIRE_API_KEY: process.env.ROTOWIRE_API_KEY || "YOUR_ROTOWIRE_API_KEY",
  MLB_STATS_BASE: "https://statsapi.mlb.com/api/v1",
  ODDS_API_BASE: "https://api.the-odds-api.com/v4",
  ROTOWIRE_BASE: "https://api.rotowire.com/baseball/v1",
  SEASON: new Date().getFullYear(),
};

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
}

function formatTime(isoString) {
  if (!isoString) return "TBD";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

function winLoss(wins, losses) {
  return `${wins}-${losses}`;
}

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
  return res.json();
}

// ── SLOT SYSTEM ───────────────────────────────────────────────────────────────
// Vegas Vault slot rules applied automatically to the day's game list.
// Rule: Day determines base (even day = Public base, odd day = Vegas base).
//       First game = OPPOSITE of base. Then alternates on each new time slot.

function assignSlots(games) {
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const dayBase = dayOfYear % 2 === 0 ? "PUBLIC" : "VEGAS";
  const opposite = (s) => (s === "PUBLIC" ? "VEGAS" : "PUBLIC");

  let currentSlot = opposite(dayBase); // first game is opposite
  let lastTime = null;

  return games.map((g, i) => {
    if (i === 0) {
      lastTime = g.rawTime;
      return { ...g, slot: currentSlot };
    }
    if (g.rawTime !== lastTime) {
      // New time slot → switch
      currentSlot = opposite(currentSlot);
      lastTime = g.rawTime;
    }
    return { ...g, slot: currentSlot };
  });
}

// ── MLB STATS API (FREE) ──────────────────────────────────────────────────────

async function fetchMLBSchedule(date = todayStr()) {
  const url = `${CONFIG.MLB_STATS_BASE}/schedule?sportId=1&date=${date}&hydrate=team,linescore,pitchers,probablePitcher,stats,broadcasts`;
  const data = await fetchJSON(url);
  // Find the entry that matches the requested date exactly — don't just take dates[0]
  const dateEntry = data.dates?.find(d => d.date === date) || data.dates?.[0];
  const games = dateEntry?.games || [];
  return games.filter((g) => g.status?.abstractGameState !== "Final");
}

async function fetchTeamStats(teamId) {
  // Season hitting + pitching stats for a team
  const [hitting, pitching] = await Promise.all([
    fetchJSON(
      `${CONFIG.MLB_STATS_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=${CONFIG.SEASON}`
    ),
    fetchJSON(
      `${CONFIG.MLB_STATS_BASE}/teams/${teamId}/stats?stats=season&group=pitching&season=${CONFIG.SEASON}`
    ),
  ]);
  const h = hitting.stats?.[0]?.splits?.[0]?.stat || {};
  const p = pitching.stats?.[0]?.splits?.[0]?.stat || {};
  return { hitting: h, pitching: p };
}

async function fetchTeamRecord(teamId) {
  const data = await fetchJSON(
    `${CONFIG.MLB_STATS_BASE}/standings?leagueId=103,104&season=${CONFIG.SEASON}&standingsTypes=regularSeason&hydrate=team`
  );
  for (const record of data.records || []) {
    for (const tr of record.teamRecords || []) {
      if (tr.team?.id === teamId) {
        return {
          overall: winLoss(tr.wins, tr.losses),
          home: winLoss(tr.homeRecords?.[0]?.wins || 0, tr.homeRecords?.[0]?.losses || 0),
          away: winLoss(tr.awayRecords?.[0]?.wins || 0, tr.awayRecords?.[0]?.losses || 0),
          streak: tr.streak?.streakCode || "—",
          last5: tr.records?.splitRecords?.find((r) => r.type === "lastTen")
            ? winLoss(
                tr.records.splitRecords.find((r) => r.type === "lastFive")?.wins || 0,
                tr.records.splitRecords.find((r) => r.type === "lastFive")?.losses || 0
              )
            : "N/A",
          last10: winLoss(
            tr.records?.splitRecords?.find((r) => r.type === "lastTen")?.wins || 0,
            tr.records?.splitRecords?.find((r) => r.type === "lastTen")?.losses || 0
          ),
        };
      }
    }
  }
  return { overall: "N/A", home: "N/A", away: "N/A", streak: "—", last5: "N/A", last10: "N/A" };
}

async function fetchPitcherStats(pitcherId) {
  if (!pitcherId) return "No probable pitcher listed";
  const data = await fetchJSON(
    `${CONFIG.MLB_STATS_BASE}/people/${pitcherId}/stats?stats=season&group=pitching&season=${CONFIG.SEASON}`
  );
  const s = data.stats?.[0]?.splits?.[0]?.stat || {};
  return [
    `${s.era || "—"} ERA`,
    `${s.whip || "—"} WHIP`,
    `${s.strikeOuts || 0} K in ${s.inningsPitched || "0"} IP`,
    `${s.wins || 0}-${s.losses || 0}`,
  ].join(", ");
}

async function fetchBullpenERA(teamId) {
  // Get all relievers' ERA aggregated
  const data = await fetchJSON(
    `${CONFIG.MLB_STATS_BASE}/teams/${teamId}/roster?rosterType=active&season=${CONFIG.SEASON}&hydrate=person(stats(type=season,group=pitching))`
  );
  const relievers = (data.roster || []).filter(
    (p) => p.position?.abbreviation === "RP" || p.position?.abbreviation === "CL"
  );
  const eras = relievers
    .map((p) => parseFloat(p.person?.stats?.[0]?.splits?.[0]?.stat?.era || "0"))
    .filter((e) => e > 0);
  if (!eras.length) return "N/A";
  return (eras.reduce((a, b) => a + b, 0) / eras.length).toFixed(2);
}

async function fetchH2H(homeTeamId, awayTeamId) {
  // Last 10 matchups between these two teams this season + last
  const data = await fetchJSON(
    `${CONFIG.MLB_STATS_BASE}/schedule?sportId=1&teamId=${homeTeamId}&opponentId=${awayTeamId}&startDate=${CONFIG.SEASON - 1}-03-01&endDate=${todayStr()}&hydrate=linescore`
  );
  const games = [];
  for (const d of data.dates || []) {
    for (const g of d.games || []) {
      if (g.status?.abstractGameState === "Final") {
        games.push(g);
      }
    }
  }
  const last5 = games.slice(-5);
  const homeWins = last5.filter((g) => {
    const homeScore = g.teams?.home?.score;
    const awayScore = g.teams?.away?.score;
    const homeIsOurHome = g.teams?.home?.team?.id === homeTeamId;
    return homeIsOurHome ? homeScore > awayScore : awayScore > homeScore;
  }).length;

  const homeAtHomeGames = last5.filter(
    (g) => g.teams?.home?.team?.id === homeTeamId
  );
  const homeAtHomeWins = homeAtHomeGames.filter(
    (g) => g.teams?.home?.score > g.teams?.away?.score
  ).length;

  return {
    last5Summary: `Last 5: ${homeWins}-${5 - homeWins} favor home team`,
    atHomeRecord: `${homeAtHomeWins}-${homeAtHomeGames.length - homeAtHomeWins} at home`,
  };
}

async function fetchSeriesContext(homeTeamId, awayTeamId) {
  // Find current series game number
  const data = await fetchJSON(
    `${CONFIG.MLB_STATS_BASE}/schedule?sportId=1&teamId=${homeTeamId}&startDate=${todayStr()}&endDate=${todayStr()}`
  );
  const game = data.dates?.[0]?.games?.[0];
  return {
    seriesGame: game?.seriesGameNumber || 1,
    seriesLength: game?.gamesInSeries || 3,
  };
}

// ── THE ODDS API (PAID) ───────────────────────────────────────────────────────

async function fetchMLBOdds() {
  const url = `${CONFIG.ODDS_API_BASE}/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${CONFIG.ODDS_API_KEY}`;
  const data = await fetchJSON(url);
  // Build a lookup map: "Away @ Home" → odds object
  const oddsMap = {};
  for (const game of data) {
    const key = `${game.away_team}|${game.home_team}`;
    const draftKings = game.bookmakers?.find((b) => b.key === "draftkings");
    const markets = draftKings?.markets || [];
    const h2h = markets.find((m) => m.key === "h2h");
    const spreads = markets.find((m) => m.key === "spreads");

    const homeML = h2h?.outcomes?.find((o) => o.name === game.home_team)?.price;
    const awayML = h2h?.outcomes?.find((o) => o.name === game.away_team)?.price;
    const homeSpread = spreads?.outcomes?.find((o) => o.name === game.home_team);

    oddsMap[key] = {
      homeML: homeML ? (homeML > 0 ? `+${homeML}` : `${homeML}`) : "N/A",
      awayML: awayML ? (awayML > 0 ? `+${awayML}` : `${awayML}`) : "N/A",
      runLine: homeSpread
        ? `Home ${homeSpread.point > 0 ? "+" : ""}${homeSpread.point} (${homeSpread.price > 0 ? "+" : ""}${homeSpread.price})`
        : "N/A",
      openingHomeML: null, // populated by line movement fetch below
    };
  }
  return oddsMap;
}

async function fetchLineMovement(homeTeam, awayTeam) {
  // The Odds API historical endpoint for line movement
  // Note: requires paid tier — returns odds snapshots over time
  try {
    const url = `${CONFIG.ODDS_API_BASE}/sports/baseball_mlb/odds-history?regions=us&markets=h2h&oddsFormat=american&apiKey=${CONFIG.ODDS_API_KEY}&date=${new Date().toISOString()}`;
    const data = await fetchJSON(url);
    const game = data.find(
      (g) =>
        g.home_team.includes(homeTeam.split(" ").pop()) ||
        g.away_team.includes(awayTeam.split(" ").pop())
    );
    if (!game) return "No line movement data available.";

    const snapshots = game.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
    if (snapshots.length < 2) return "Insufficient movement data.";

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const homeFirst = first.find?.((o) => o.name === game.home_team)?.price;
    const homeLast = last.find?.((o) => o.name === game.home_team)?.price;

    if (!homeFirst || !homeLast) return "Line movement data unavailable.";

    const diff = homeLast - homeFirst;
    const direction = diff > 0 ? "moved toward home" : diff < 0 ? "moved toward away" : "no movement";
    return `Opened ${homeFirst > 0 ? "+" : ""}${homeFirst}, now ${homeLast > 0 ? "+" : ""}${homeLast}. ${direction} (${Math.abs(diff)} points).`;
  } catch {
    return "Line movement data unavailable.";
  }
}

// ── ROTOWIRE API (PAID) ───────────────────────────────────────────────────────

async function fetchInjuries() {
  try {
    const data = await fetchJSON(
      `${CONFIG.ROTOWIRE_BASE}/injuries.json?apikey=${CONFIG.ROTOWIRE_API_KEY}`
    );
    // Build map: teamName → array of injury strings
    const injuryMap = {};
    for (const player of data || []) {
      const team = player.team;
      if (!injuryMap[team]) injuryMap[team] = [];
      injuryMap[team].push(
        `${player.name} (${player.position}, ${player.injury_status}: ${player.injury_desc})`
      );
    }
    return injuryMap;
  } catch {
    return {};
  }
}

async function fetchLineups(date = todayStr()) {
  try {
    const data = await fetchJSON(
      `${CONFIG.ROTOWIRE_BASE}/lineups.json?apikey=${CONFIG.ROTOWIRE_API_KEY}&date=${date}`
    );
    // Build map: gameId → { homeLineup, awayLineup }
    const lineupMap = {};
    for (const game of data || []) {
      lineupMap[`${game.away_team}|${game.home_team}`] = {
        homeLineup: game.home_lineup?.map((p) => p.name).join(", ") || "Lineup pending",
        awayLineup: game.away_lineup?.map((p) => p.name).join(", ") || "Lineup pending",
        homeLineupFull: game.home_lineup || [],
        awayLineupFull: game.away_lineup || [],
      };
    }
    return lineupMap;
  } catch {
    return {};
  }
}

// Trell Rule: find any star player first day OUT or first day RETURN
async function fetchTrellAlerts(injuryMap) {
  const STAR_PLAYERS = [
    "Shohei Ohtani", "Aaron Judge", "Mookie Betts", "Freddie Freeman",
    "Fernando Tatis Jr.", "Juan Soto", "Yordan Alvarez", "Ronald Acuna Jr.",
    "Mike Trout", "Julio Rodriguez", "Bobby Witt Jr.", "Corey Seager",
    "Paul Goldschmidt", "Nolan Arenado", "Elly De La Cruz", "Gunnar Henderson",
    "Rafael Devers", "Jose Ramirez", "Bryce Harper", "Kyle Tucker",
    "Jannik Sinner", "Carlos Alcaraz", "Novak Djokovic", "Coco Gauff",
  ];

  const alerts = [];
  for (const [team, injuries] of Object.entries(injuryMap)) {
    for (const injury of injuries) {
      for (const star of STAR_PLAYERS) {
        if (injury.includes(star)) {
          const isOut = injury.toLowerCase().includes("out") || injury.toLowerCase().includes("dl");
          alerts.push({
            player: star,
            team,
            status: isOut ? "OUT" : "QUESTIONABLE",
            direction: isOut ? `Bet ON ${team}` : `Watch — possible return`,
            raw: injury,
          });
        }
      }
    }
  }
  return alerts;
}

// ── OFFENSE SUMMARY ───────────────────────────────────────────────────────────

function buildOffenseSummary(teamStats, teamName, lineup) {
  const h = teamStats.hitting;
  const parts = [];
  if (h.avg) parts.push(`BA .${Math.round(h.avg * 1000)}`);
  if (h.ops) parts.push(`OPS .${Math.round(h.ops * 1000)}`);
  if (h.homeRuns) parts.push(`${h.homeRuns} HR`);
  if (lineup) parts.push(`Lineup: ${lineup}`);
  return parts.join(", ") || `${teamName} offense data pending`;
}

// ── ASSEMBLE FULL GAME OBJECT ─────────────────────────────────────────────────

async function assembleMLBGame(game, oddsMap, injuryMap, lineupMap) {
  const homeTeam = game.teams.home.team;
  const awayTeam = game.teams.away.team;
  const homePitcher = game.teams.home.probablePitcher;
  const awayPitcher = game.teams.away.probablePitcher;

  const oddsKey = `${awayTeam.name}|${homeTeam.name}`;
  const odds = oddsMap[oddsKey] || {};
  const lineupKey = `${awayTeam.name}|${homeTeam.name}`;
  const lineups = lineupMap[lineupKey] || {};

  const homeInjuries = (injuryMap[homeTeam.name] || []).join("; ") || "None reported";
  const awayInjuries = (injuryMap[awayTeam.name] || []).join("; ") || "None reported";

  // Parallel fetch for deep stats
  const [
    homeRecord, awayRecord,
    homeStats, awayStats,
    homePitcherStats, awayPitcherStats,
    homeBullpen, awayBullpen,
    h2h, series, lineMovement,
  ] = await Promise.all([
    fetchTeamRecord(homeTeam.id),
    fetchTeamRecord(awayTeam.id),
    fetchTeamStats(homeTeam.id),
    fetchTeamStats(awayTeam.id),
    fetchPitcherStats(homePitcher?.id),
    fetchPitcherStats(awayPitcher?.id),
    fetchBullpenERA(homeTeam.id),
    fetchBullpenERA(awayTeam.id),
    fetchH2H(homeTeam.id, awayTeam.id),
    fetchSeriesContext(homeTeam.id, awayTeam.id),
    fetchLineMovement(homeTeam.name, awayTeam.name),
  ]);

  return {
    id: game.gamePk,
    sport: "MLB",
    rawTime: game.gameDate,
    time: formatTime(game.gameDate),
    date: todayStr(),
    away: awayTeam.name,
    home: homeTeam.name,
    awayRecord: awayRecord.overall,
    homeRecord: homeRecord.overall,
    awayAwayRecord: awayRecord.away,
    homeHomeRecord: homeRecord.home,
    awayLast5: awayRecord.last5,
    homeLast5: homeRecord.last5,
    awayLast10: awayRecord.last10,
    homeLast10: homeRecord.last10,
    awayStreak: awayRecord.streak,
    homeStreak: homeRecord.streak,
    awayML: odds.awayML || "N/A",
    homeML: odds.homeML || "N/A",
    runLine: odds.runLine || "N/A",
    awayPitcher: awayPitcher?.fullName || "TBD",
    homePitcher: homePitcher?.fullName || "TBD",
    awayPitcherStats: awayPitcherStats,
    homePitcherStats: homePitcherStats,
    awayBullpenERA: awayBullpen,
    homeBullpenERA: homeBullpen,
    awayOffense: buildOffenseSummary(awayStats, awayTeam.name, lineups.awayLineup),
    homeOffense: buildOffenseSummary(homeStats, homeTeam.name, lineups.homeLineup),
    h2hLast5: h2h.last5Summary,
    h2hAtHome: h2h.atHomeRecord,
    injuries: `${homeTeam.name}: ${homeInjuries} | ${awayTeam.name}: ${awayInjuries}`,
    lineMovement: lineMovement,
    seriesGame: series.seriesGame,
    seriesLength: series.seriesLength,
    slot: "PUBLIC", // will be overwritten by assignSlots()
  };
}

// ── TENNIS DATA (The Odds API) ────────────────────────────────────────────────

async function fetchTennisOdds() {
  const url = `${CONFIG.ODDS_API_BASE}/sports/tennis_atp_french_open/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${CONFIG.ODDS_API_KEY}`;
  try {
    const data = await fetchJSON(url);
    return data || [];
  } catch {
    return [];
  }
}

async function assembleTennisMatch(match) {
  const player1 = match.home_team;
  const player2 = match.away_team;
  const draftKings = match.bookmakers?.find((b) => b.key === "draftkings");
  const h2h = draftKings?.markets?.find((m) => m.key === "h2h");
  const p1ML = h2h?.outcomes?.find((o) => o.name === player1)?.price;
  const p2ML = h2h?.outcomes?.find((o) => o.name === player2)?.price;

  return {
    id: match.id,
    sport: "Tennis",
    rawTime: match.commence_time,
    time: formatTime(match.commence_time),
    date: todayStr(),
    player1,
    player2,
    surface: "Clay", // French Open specific — update per tournament
    tournament: "Roland Garros",
    round: "Unknown", // ATP API or manual enrichment needed for round
    player1ML: p1ML ? (p1ML > 0 ? `+${p1ML}` : `${p1ML}`) : "N/A",
    player2ML: p2ML ? (p2ML > 0 ? `+${p2ML}` : `${p2ML}`) : "N/A",
    player1Ranking: "—",
    player2Ranking: "—",
    player1Last5: "See ATP tour data",
    player2Last5: "See ATP tour data",
    player1SurfaceRecord: "See ATP tour data",
    player2SurfaceRecord: "See ATP tour data",
    h2h: "See ATP H2H data",
    player1ServeStats: "See ATP serve data",
    player2ServeStats: "See ATP serve data",
    player1Fatigue: "Check tournament draw",
    player2Fatigue: "Check tournament draw",
    injuries: "Check ATP injury report",
    lineMovement: "See odds history",
    slot: "PUBLIC", // overwritten by assignSlots()
  };
}

// ── MAIN EXPORTS ──────────────────────────────────────────────────────────────

/**
 * getTodaysGames()
 * Returns a fully assembled array of MLB game objects for today,
 * with slots assigned, ready for the Vegas Vault AI prompt engine.
 */
async function getTodaysGames() {
  try {
    console.log("[Vegas Vault] Fetching today's MLB schedule...");
    const [scheduleGames, oddsMap, injuryMap, lineupMap] = await Promise.all([
      fetchMLBSchedule(),
      fetchMLBOdds(),
      fetchInjuries(),
      fetchLineups(),
    ]);

    console.log(`[Vegas Vault] Found ${scheduleGames.length} games. Assembling data...`);

    const assembled = await Promise.all(
      scheduleGames.map((g) => assembleMLBGame(g, oddsMap, injuryMap, lineupMap))
    );

    // Sort by game time, then assign slots
    assembled.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const withSlots = assignSlots(assembled);

    console.log("[Vegas Vault] MLB data layer ready.");
    return withSlots;
  } catch (err) {
    console.error("[Vegas Vault] Data layer error:", err.message);
    throw err;
  }
}

/**
 * getTodaysTennisMatches()
 * Returns tennis match objects for today's ATP/WTA slate.
 */
async function getTodaysTennisMatches() {
  try {
    console.log("[Vegas Vault] Fetching tennis matches...");
    const matches = await fetchTennisOdds();
    const today = todayStr();
    const todayMatches = matches.filter((m) =>
      m.commence_time?.startsWith(today)
    );
    const assembled = await Promise.all(
      todayMatches.map((m) => assembleTennisMatch(m))
    );
    assembled.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const withSlots = assignSlots(assembled);
    console.log(`[Vegas Vault] Tennis data layer ready. ${withSlots.length} matches.`);
    return withSlots;
  } catch (err) {
    console.error("[Vegas Vault] Tennis data layer error:", err.message);
    return [];
  }
}

/**
 * getTrellAlerts()
 * Returns active Trell Rule triggers for today.
 * Run this independently to populate the alerts panel.
 */
async function getTrellAlerts() {
  const injuryMap = await fetchInjuries();
  return fetchTrellAlerts(injuryMap);
}

/**
 * getAllTodaysData()
 * Convenience wrapper — returns MLB games, tennis matches, and Trell alerts
 * all in one call. Use this to populate the full dashboard on load.
 */
async function getAllTodaysData() {
  const [mlbGames, tennisMatches, trellAlerts] = await Promise.all([
    getTodaysGames(),
    getTodaysTennisMatches(),
    getTrellAlerts(),
  ]);
  return {
    games: [...mlbGames, ...tennisMatches],
    trellAlerts,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getTodaysGames,
  getTodaysTennisMatches,
  getTrellAlerts,
  getAllTodaysData,
};

// ── QUICK TEST (run with: node dataLayer.js) ──────────────────────────────────
if (require.main === module) {
  getAllTodaysData()
    .then((data) => {
      console.log("\n── TODAY'S GAMES ──");
      data.games.forEach((g) => {
        const matchup =
          g.sport === "Tennis"
            ? `${g.player1} vs ${g.player2}`
            : `${g.away} @ ${g.home}`;
        console.log(`[${g.slot}] ${g.sport} | ${g.time} | ${matchup}`);
      });
      console.log("\n── TRELL ALERTS ──");
      if (data.trellAlerts.length === 0) console.log("None");
      data.trellAlerts.forEach((a) =>
        console.log(`🚨 ${a.player} (${a.team}): ${a.status} → ${a.direction}`)
      );
    })
    .catch(console.error);
}
