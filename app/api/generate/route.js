import { NextResponse } from 'next/server';
import { assignNBASlots, fetchNBAOdds, NBA_MOCK_GAMES } from '@/lib/nbaModel';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(isoString) {
  if (!isoString) return 'TBD';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
  }) + ' CT';
}

function assignMLBSlots(games) {
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const dayBase = dayOfYear % 2 === 0 ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');
  let currentSlot = opposite(dayBase);
  let lastTime = null;
  return games.map((g, i) => {
    if (i === 0) { lastTime = g.rawTime; return { ...g, slot: currentSlot }; }
    if (g.rawTime !== lastTime) { currentSlot = opposite(currentSlot); lastTime = g.rawTime; }
    return { ...g, slot: currentSlot };
  });
}

async function fetchMLBSchedule() {
  const today = todayStr();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,linescore`,
    { next: { revalidate: 600 } }
  );
  const data = await res.json();
  return data.dates?.[0]?.games || [];
}

async function fetchTeamRecord(teamId) {
  const season = new Date().getFullYear();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  for (const record of data.records || []) {
    for (const tr of record.teamRecords || []) {
      if (tr.team?.id === teamId) {
        const last10 = tr.records?.splitRecords?.find(r => r.type === 'lastTen');
        const last5 = tr.records?.splitRecords?.find(r => r.type === 'lastFive');
        const home = tr.records?.splitRecords?.find(r => r.type === 'home');
        const away = tr.records?.splitRecords?.find(r => r.type === 'away');
        return {
          overall: `${tr.wins}-${tr.losses}`,
          home: home ? `${home.wins}-${home.losses}` : 'N/A',
          away: away ? `${away.wins}-${away.losses}` : 'N/A',
          last5: last5 ? `${last5.wins}-${last5.losses}` : 'N/A',
          last10: last10 ? `${last10.wins}-${last10.losses}` : 'N/A',
          streak: tr.streak?.streakCode || 'N/A',
        };
      }
    }
  }
  return { overall: 'N/A', home: 'N/A', away: 'N/A', last5: 'N/A', last10: 'N/A', streak: 'N/A' };
}

async function fetchPitcherStats(pitcherId) {
  if (!pitcherId) return 'TBD';
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&group=pitching&season=${season}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const s = data.stats?.[0]?.splits?.[0]?.stat || {};
    return [
      s.era ? `${s.era} ERA` : null,
      s.whip ? `${s.whip} WHIP` : null,
      s.strikeOuts ? `${s.strikeOuts} K` : null,
      s.inningsPitched ? `${s.inningsPitched} IP` : null,
      (s.wins !== undefined && s.losses !== undefined) ? `${s.wins}-${s.losses}` : null,
    ].filter(Boolean).join(', ') || 'Stats unavailable';
  } catch {
    return 'Stats unavailable';
  }
}

async function fetchMLBOdds() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const oddsMap = {};
    for (const game of (Array.isArray(data) ? data : [])) {
      const key = `${game.away_team}|${game.home_team}`;
      const bookmaker = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const spreads = bookmaker?.markets?.find(m => m.key === 'spreads');
      const fmt = (p) => p ? (p > 0 ? `+${p}` : `${p}`) : 'N/A';
      const homeML = h2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find(o => o.name === game.home_team);
      const awaySpread = spreads?.outcomes?.find(o => o.name === game.away_team);
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
        runLine: homeSpread ? `Home ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${fmt(homeSpread.price)}) / Away ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point} (${fmt(awaySpread?.price)})` : 'N/A',
        lineMovement,
        betPercentage: 'Available with paid Odds API tier',
        moneyPercentage: 'Available with paid Odds API tier',
      };
    }
    return oddsMap;
  } catch { return {}; }
}

async function fetchCBSSportsPreview(awayTeam, homeTeam) {
  return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
}

async function assembleMLBGame(g, oddsMap) {
  const home = g.teams.home.team;
  const away = g.teams.away.team;
  const homePitcher = g.teams.home.probablePitcher;
  const awayPitcher = g.teams.away.probablePitcher;
  const oddsKey = `${away.name}|${home.name}`;
  const odds = oddsMap[oddsKey] || {};
  const [homeRecord, awayRecord, homePitcherStats, awayPitcherStats, cbsPreview] = await Promise.all([
    fetchTeamRecord(home.id),
    fetchTeamRecord(away.id),
    fetchPitcherStats(homePitcher?.id),
    fetchPitcherStats(awayPitcher?.id),
    fetchCBSSportsPreview(away.name, home.name),
  ]);
  return {
    id: g.gamePk, sport: 'MLB',
    rawTime: g.gameDate, time: formatTime(g.gameDate), date: todayStr(),
    away: away.name, home: home.name,
    awayRecord: awayRecord.overall, homeRecord: homeRecord.overall,
    awayAwayRecord: awayRecord.away, homeHomeRecord: homeRecord.home,
    awayLast5: awayRecord.last5, homeLast5: homeRecord.last5,
    awayLast10: awayRecord.last10, homeLast10: homeRecord.last10,
    awayStreak: awayRecord.streak, homeStreak: homeRecord.streak,
    awayML: odds.awayML || 'N/A', homeML: odds.homeML || 'N/A',
    runLine: odds.runLine || 'N/A',
    openingAwayML: odds.openingAwayML || 'N/A',
    openingHomeML: odds.openingHomeML || 'N/A',
    betPercentage: odds.betPercentage || 'N/A',
    moneyPercentage: odds.moneyPercentage || 'N/A',
    awayPitcher: awayPitcher?.fullName || 'TBD',
    homePitcher: homePitcher?.fullName || 'TBD',
    awayPitcherStats, homePitcherStats,
    awayBullpenERA: 'See team stats', homeBullpenERA: 'See team stats',
    awayOffense: `${awayRecord.overall} record, ${awayRecord.last10} last 10`,
    homeOffense: `${homeRecord.overall} record, ${homeRecord.last10} last 10`,
    h2hLast5: 'See MLB Stats', h2hAtHome: 'See MLB Stats',
    injuries: 'Check injury reports',
    lineMovement: odds.lineMovement || 'Odds API not connected',
    cbsPreview,
    seriesGame: g.seriesGameNumber || 1,
    seriesLength: g.gamesInSeries || 3,
    slot: 'PUBLIC',
  };
}

async function fetchNBAGames() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return NBA_MOCK_GAMES;
  try {
    const nbaOdds = await fetchNBAOdds(apiKey);
    if (Object.keys(nbaOdds).length === 0) return NBA_MOCK_GAMES;
    const games = Object.entries(nbaOdds).map(([key, odds], i) => {
      const [away, home] = key.split('|');
      return {
        id: 1000 + i, sport: 'NBA',
        gameType: 'playoffs',
        rawTime: new Date().toISOString(),
        time: 'TBD', date: todayStr(),
        away, home,
        awayRecord: 'N/A', homeRecord: 'N/A',
        awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
        awayLast5: 'N/A', homeLast5: 'N/A',
        awayLast10: 'N/A', homeLast10: 'N/A',
        awayStreak: 'N/A', homeStreak: 'N/A',
        awayML: odds.awayML, homeML: odds.homeML,
        openingAwayML: odds.openingAwayML,
        openingHomeML: odds.openingHomeML,
        spread: odds.spread, total: odds.total,
        lineMovement: odds.lineMovement,
        betPercentage: odds.betPercentage,
        moneyPercentage: odds.moneyPercentage,
        awayRest: 'N/A', homeRest: 'N/A',
        awayB2B: false, homeB2B: false,
        awayPPG: 'N/A', awayOppPPG: 'N/A',
        homePPG: 'N/A', homeOppPPG: 'N/A',
        awayOffRating: 'N/A', awayDefRating: 'N/A', awayPace: 'N/A',
        homeOffRating: 'N/A', homeDefRating: 'N/A', homePace: 'N/A',
        awayKeyPlayers: 'Check NBA roster',
        homeKeyPlayers: 'Check NBA roster',
        injuries: 'Check injury report',
        h2hLast5: 'N/A', h2hAtHome: 'N/A',
        seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
        seriesHistory: 'N/A',
        cbsPreview: `CBS Sports preview not available for ${away} @ ${home}`,
        slot: 'PUBLIC',
      };
    });
    return assignNBASlots(games);
  } catch {
    return NBA_MOCK_GAMES;
  }
}

export async function GET() {
  try {
    const [scheduleGames, mlbOdds, nbaGames] = await Promise.all([
      fetchMLBSchedule(),
      fetchMLBOdds(),
      fetchNBAGames(),
    ]);

    const mlbGames = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGames.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const mlbWithSlots = assignMLBSlots(mlbGames);

    const allGames = [...mlbWithSlots, ...nbaGames];

    return NextResponse.json({
      games: allGames,
      trellAlerts: [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}