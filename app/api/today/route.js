import { NextResponse } from 'next/server';
import { assignNBASlots, NBA_MOCK_GAMES } from '@/lib/nbaModel';

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(isoString) {
  if (!isoString) return 'TBD';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
  }) + ' CT';
}

function fmt(price) {
  return price ? (price > 0 ? `+${price}` : `${price}`) : 'N/A';
}

// ── MLB SLOT SYSTEM ───────────────────────────────────────────────────────────
// PUBLIC days: Monday (1), Wednesday (3), Friday (5)
// VEGAS days:  Tuesday (2), Thursday (4), Saturday (6), Sunday (0)
//
// Rules:
// 1. First game = opposite of day base
// 2. Same time slot = hold
// 3. Single games in different time slots with no matching = hold
// 4. Matching time slots (2+ games same time) = switch
// 5. After matching group, next different time slot = switch
// 6. Last game different time slot = switch
// 7. Last game same time slot = hold

function assignMLBSlots(games) {
  const dayOfWeek = new Date().getDay();
  const publicDays = [1, 3, 5];
  const dayBase = publicDays.includes(dayOfWeek) ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');

  if (games.length === 0) return games;

  // Group games by time slot
  const timeGroups = [];
  let currentGroup = [games[0]];
  for (let i = 1; i < games.length; i++) {
    if (games[i].rawTime === games[i - 1].rawTime) {
      currentGroup.push(games[i]);
    } else {
      timeGroups.push(currentGroup);
      currentGroup = [games[i]];
    }
  }
  timeGroups.push(currentGroup);

  let currentSlot = opposite(dayBase);
  const result = [];
  let justHadMatchingGroup = false;

  for (let g = 0; g < timeGroups.length; g++) {
    const group = timeGroups[g];
    const isFirstGroup = g === 0;
    const isLastGroup = g === timeGroups.length - 1;
    const isMatchingGroup = group.length > 1;
    const isSingleGame = group.length === 1;

    if (isFirstGroup) {
      currentSlot = opposite(dayBase);
      justHadMatchingGroup = isMatchingGroup;
    } else if (isMatchingGroup) {
      currentSlot = opposite(currentSlot);
      justHadMatchingGroup = true;
    } else if (isSingleGame) {
      if (justHadMatchingGroup) {
        currentSlot = opposite(currentSlot);
        justHadMatchingGroup = false;
      } else if (isLastGroup) {
        currentSlot = opposite(currentSlot);
      }
    }

    for (const game of group) {
      result.push({ ...game, slot: currentSlot });
    }
  }

  return result;
}

// ── CBS SPORTS PREVIEW ────────────────────────────────────────────────────────

async function fetchCBSSportsPreview(awayTeam, homeTeam, sport = 'mlb') {
  try {
    const res = await fetch(`https://www.cbssports.com/${sport}/news/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
    const html = await res.text();
    const match = html.match(/class="[^"]*article[^"]*"[^>]*>([\s\S]{100,800}?)<\/[^>]+>/i);
    if (match) {
      return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    }
    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  } catch {
    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  }
}

// ── THE ODDS API ──────────────────────────────────────────────────────────────

async function fetchOdds(sportKey) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    if (!Array.isArray(data)) return {};
    const oddsMap = {};
    const bookmakerSet = new Set();
    for (const game of data) {
      game.bookmakers?.forEach(b => bookmakerSet.add(b.key));
      const key = `${game.away_team}|${game.home_team}`;
      const bookmaker = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const spreads = bookmaker?.markets?.find(m => m.key === 'spreads');
      const totals = bookmaker?.markets?.find(m => m.key === 'totals');
      const homeML = h2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find(o => o.name === game.home_team);
      const awaySpread = spreads?.outcomes?.find(o => o.name === game.away_team);
      const total = totals?.outcomes?.[0]?.point;
      const openBook = game.bookmakers?.[game.bookmakers.length - 1];
      const openH2h = openBook?.markets?.find(m => m.key === 'h2h');
      const openHomeML = openH2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const openAwayML = openH2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      let lineMovement = 'No significant movement';
      if (openHomeML && homeML && openHomeML !== homeML) {
        const diff = homeML - openHomeML;
        lineMovement = `Home opened ${fmt(openHomeML)}, now ${fmt(homeML)} (${diff > 0 ? 'moved toward home' : 'moved toward away'}, ${Math.abs(diff)} pts).`;
      } else if (homeML) {
        lineMovement = `Line stable. Home ${fmt(homeML)} / Away ${fmt(awayML)}.`;
      }
      oddsMap[key] = {
        homeML: fmt(homeML), awayML: fmt(awayML),
        openingHomeML: fmt(openHomeML), openingAwayML: fmt(openAwayML),
        spread: homeSpread ? `${game.home_team} ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} / ${game.away_team} ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point}` : 'N/A',
        runLine: homeSpread ? `Home ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${fmt(homeSpread.price)}) / Away ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point} (${fmt(awaySpread?.price)})` : 'N/A',
        total: total ? `${total}` : 'N/A',
        lineMovement,
        betPercentage: 'Available with paid Odds API tier',
        moneyPercentage: 'Available with paid Odds API tier',
        commenceTime: game.commence_time,
      };
    }
    return { oddsMap, bookmakerCount: bookmakerSet.size };
  } catch (err) {
    console.error(`Odds API error (${sportKey}):`, err.message);
    return { oddsMap: {}, bookmakerCount: 0 };
  }
}

// ── MLB STATS API ─────────────────────────────────────────────────────────────

async function fetchMLBSchedule(date) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date || todayStr()}&hydrate=team,probablePitcher,linescore`,
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
    fetchCBSSportsPreview(away.name, home.name, 'mlb'),
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
    gameStatus: g.status?.detailedState || 'Scheduled',
    seriesGame: g.seriesGameNumber || 1,
    seriesLength: g.gamesInSeries || 3,
    slot: 'PUBLIC',
  };
}

// ── NBA GAMES ─────────────────────────────────────────────────────────────────

async function fetchNBAGames() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return assignNBASlots(NBA_MOCK_GAMES);
  try {
    const oddsResult = await fetchOdds('basketball_nba');
    const oddsMap = oddsResult.oddsMap || oddsResult;
    if (Object.keys(oddsMap).length === 0) return assignNBASlots(NBA_MOCK_GAMES);
    const games = await Promise.all(
      Object.entries(oddsMap).map(async ([key, odds], i) => {
        const [away, home] = key.split('|');
        const cbsPreview = await fetchCBSSportsPreview(away, home, 'nba');
        return {
          id: 1000 + i, sport: 'NBA', gameType: 'playoffs',
          rawTime: odds.commenceTime,
          time: formatTime(odds.commenceTime),
          date: odds.commenceTime?.split('T')[0] || todayStr(),
          away, home,
          awayRecord: 'See NBA standings', homeRecord: 'See NBA standings',
          awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
          awayLast5: 'N/A', homeLast5: 'N/A',
          awayLast10: 'N/A', homeLast10: 'N/A',
          awayStreak: 'N/A', homeStreak: 'N/A',
          awayML: odds.awayML, homeML: odds.homeML,
          openingAwayML: odds.openingAwayML, openingHomeML: odds.openingHomeML,
          spread: odds.spread, total: odds.total,
          lineMovement: odds.lineMovement,
          betPercentage: odds.betPercentage, moneyPercentage: odds.moneyPercentage,
          awayRest: 'Check schedule', homeRest: 'Check schedule',
          awayB2B: false, homeB2B: false,
          awayPPG: 'N/A', awayOppPPG: 'N/A',
          homePPG: 'N/A', homeOppPPG: 'N/A',
          awayOffRating: 'N/A', awayDefRating: 'N/A', awayPace: 'N/A',
          homeOffRating: 'N/A', homeDefRating: 'N/A', homePace: 'N/A',
          awayKeyPlayers: 'Check NBA roster', homeKeyPlayers: 'Check NBA roster',
          injuries: 'Check NBA injury report',
          h2hLast5: 'N/A', h2hAtHome: 'N/A',
          seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
          seriesHistory: 'N/A', cbsPreview, slot: 'PUBLIC',
        };
      })
    );
    return assignNBASlots(games);
  } catch (err) {
    console.error('NBA games error:', err.message);
    return assignNBASlots(NBA_MOCK_GAMES);
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    const dateParam = searchParams.get('date') || todayStr();
  const [scheduleGames, mlbOddsResult, nbaGames] = await Promise.all([
      fetchMLBSchedule(dateParam),
      fetchOdds('baseball_mlb'),
      fetchNBAGames(),
    ]);
    const mlbOdds = mlbOddsResult.oddsMap || mlbOddsResult;
    const mlbBookmakerCount = mlbOddsResult.bookmakerCount || 0;

    const mlbGamesRaw = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGamesRaw.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const mlbGames = assignMLBSlots(mlbGamesRaw);
    const allGames = [...mlbGames, ...nbaGames];

    return NextResponse.json({
      games: allGames,
      trellAlerts: [],
      bookmakerCount: mlbBookmakerCount,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
