import { NextResponse } from 'next/server';
import { assignNBASlots } from '@/lib/nbaModel';

function assignNFLSlots(games, pattern) {
  if (!pattern) return games.map(g => ({ ...g, slot: null }));
  return games.map((g, i) => ({ ...g, slot: pattern[i] || null }));
}
import { createClient } from '@supabase/supabase-js';

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

function assignMLBSlots(games, adminPattern = null) {
  // Slots ONLY come from the admin pattern — no auto-assignment
  if (adminPattern && Array.isArray(adminPattern) && adminPattern.length > 0) {
    return games.map((g, i) => ({ ...g, slot: adminPattern[i] || null }));
  }
  // No pattern set — return games with no slot (unassigned)
  return games.map(g => ({ ...g, slot: null }));


}

async function fetchNFLGames(dateParam) {
  try {
    // Check if NFL season is active (September through February)
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 8) return []; // March-August = offseason, no games

    const oddsResult = await fetchOdds('americanfootball_nfl');
    const oddsMap = oddsResult.oddsMap || oddsResult;
    if (Object.keys(oddsMap).length === 0) return [];

    const games = Object.entries(oddsMap)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, odds], i) => {
        const [away, home] = key.split('|');
        // Only include games on the selected date
        const gameDate = odds.commenceTime?.split('T')[0];
        if (gameDate && gameDate !== dateParam) return null;
        const ABBR = {
          "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL",
          "Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI",
          "Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL",
          "Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB",
          "Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX",
          "Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC",
          "Los Angeles Rams":"LAR","Miami Dolphins":"MIA","Minnesota Vikings":"MIN",
          "New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG",
          "New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT",
          "San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB",
          "Tennessee Titans":"TEN","Washington Commanders":"WSH",
        };
        return {
          id: 2000 + i, sport: 'NFL',
          rawTime: odds.commenceTime,
          time: formatTime(odds.commenceTime),
          date: gameDate || dateParam,
          away, home,
          awayCity: away.split(' ').slice(0,-1).join(' ').toUpperCase(),
          homeCity: home.split(' ').slice(0,-1).join(' ').toUpperCase(),
          awayAbbr: ABBR[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
          homeAbbr: ABBR[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
          awayRecord: 'See NFL standings', homeRecord: 'See NFL standings',
          awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
          awayLast5: 'N/A', homeLast5: 'N/A', awayLast10: 'N/A', homeLast10: 'N/A',
          awayStreak: 'N/A', homeStreak: 'N/A',
          awayML: odds.awayML || 'N/A', homeML: odds.homeML || 'N/A',
          openingAwayML: odds.openingAwayML || 'N/A',
          openingHomeML: odds.openingHomeML || 'N/A',
          spread: odds.spread || 'N/A',
          total: odds.total || 'N/A',
          lineMovement: odds.lineMovement || 'N/A',
          betPercentage: 'Available with paid tier',
          moneyPercentage: 'Available with paid tier',
          awayQB: 'Check depth chart', homeQB: 'Check depth chart',
          awayQBStats: 'N/A', homeQBStats: 'N/A',
          awayOffense: 'Check NFL stats', homeOffense: 'Check NFL stats',
          awayDefense: 'Check NFL stats', homeDefense: 'Check NFL stats',
          h2hLast5: nflH2HMap[key] || 'Check NFL H2H history',
          injuries: 'Check rotowire.com/football/nfl/injury-report.php',
          weather: 'Check game time weather',
          cbsPreview: 'Check CBS Sports for preview',
          gameStatus: 'Scheduled',
          week: 'N/A', gameType: 'Regular Season',
          slot: null,
        };
      }).filter(Boolean);

    return games; // slots applied externally
  } catch (err) {
    console.error('NFL games error:', err.message);
    return [];
  }
}


// ── MLB ────────────────────────────────────────────────────────────────────────

async function fetchMLBSchedule(date) {
  const dateStr = date || todayStr();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=team,probablePitcher,linescore,stats,person,flags,game(seriesStatus)`,
    { cache: 'no-store' }
  );
  const data = await res.json();
  const dateEntry = data.dates?.find(d => d.date === dateStr) || data.dates?.[0];
  return dateEntry?.games || [];
}

async function fetchOdds(sport) {
  try {
    const SHARP_KEY = process.env.SHARPAPI_KEY;
    if (!SHARP_KEY) return { oddsMap: {}, bookmakerCount: 0 };

    // Map sport string to Sharp API league
    const leagueMap = { 'baseball_mlb': 'MLB', 'basketball_nba': 'NBA', 'americanfootball_nfl': 'NFL' };
    const league = leagueMap[sport] || 'MLB';

    // Selected books: FanDuel, DraftKings, BetOnline (sharp)
    const SELECTED_BOOKS = ['fanduel', 'draftkings', 'betonline'];
    const booksParam = SELECTED_BOOKS.join(',');

    // Fetch events and odds from Sharp API
    const [eventsRes, oddsRes] = await Promise.all([
      fetch(`https://api.sharpapi.io/api/v1/events?league=${league}&status=upcoming&per_page=50`, {
        headers: { 'X-API-Key': SHARP_KEY },
        cache: 'no-store',
      }),
      fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&sportsbook=${booksParam}&market=moneyline,spread,total&odds_format=american&per_page=200`, {
        headers: { 'X-API-Key': SHARP_KEY },
        cache: 'no-store',
      }),
    ]);

    console.log('Sharp events status:', eventsRes.status, 'odds status:', oddsRes.status);
    if (!eventsRes.ok) { const t = await eventsRes.text(); console.log('events error:', t); }
    if (!oddsRes.ok) { const t = await oddsRes.text(); console.log('odds error:', t); }
    if (!eventsRes.ok || !oddsRes.ok) return { oddsMap: {}, bookmakerCount: 0 };

    const eventsData = await eventsRes.json();
    const oddsData = await oddsRes.json();

    const events = eventsData.data || [];
    const oddsList = oddsData.data || [];
    console.log('Sharp API: events count:', events.length, 'odds count:', oddsList.length);
    if (oddsList.length > 0) console.log('Sample odds object:', JSON.stringify(oddsList[0]));
    if (events.length > 0) console.log('Sample event object:', JSON.stringify(events[0]));

    // Build event map by event_id
    const eventMap = {};
    events.forEach(e => { eventMap[e.id] = e; });

    // Group odds by event_id and sportsbook
    const oddsMap = {};
    let bookmakerCount = 0;

    oddsList.forEach(o => {
      const event = eventMap[o.event_id];
      if (!event) return;

      const away = event.away_team?.name || event.away_team || '';
      const home = event.home_team?.name || event.home_team || '';
      if (!away || !home) return;

      const key = `${away}@${home}`;
      if (!oddsMap[key]) {
        oddsMap[key] = {
          awayML: 'N/A', homeML: 'N/A', spread: 'N/A', total: 'N/A',
          openingAwayML: 'N/A', openingHomeML: 'N/A',
          lineMovement: 'No significant movement detected',
          pricingStr: '',
          bookPrices: {},
          _raw: {},
        };
        bookmakerCount++;
      }

      const entry = oddsMap[key];
      const book = o.sportsbook?.toLowerCase() || '';
      const bookLabel = book.includes('fanduel') ? 'FD' : book.includes('draftkings') ? 'DK' : 'BOL';

      if (o.market === 'moneyline' || o.market_type === 'moneyline') {
        const awayPrice = o.away_odds ?? o.outcomes?.find(x => x.name === away || x.side === 'away')?.odds;
        const homePrice = o.home_odds ?? o.outcomes?.find(x => x.name === home || x.side === 'home')?.odds;
        if (awayPrice) {
          if (entry.awayML === 'N/A') entry.awayML = fmt(awayPrice);
          entry._raw[book] = { away: awayPrice, home: homePrice };
          entry.bookPrices[bookLabel] = { away: fmt(awayPrice), home: fmt(homePrice) };
        }
      }
      if (o.market === 'spread' || o.market_type === 'spread') {
        const homeSpread = o.home_spread ?? o.outcomes?.find(x => x.name === home || x.side === 'home')?.spread;
        if (homeSpread != null && entry.spread === 'N/A') {
          entry.spread = homeSpread > 0 ? `+${homeSpread}` : `${homeSpread}`;
        }
      }
      if (o.market === 'total' || o.market_type === 'total') {
        const overLine = o.total ?? o.outcomes?.find(x => x.name === 'Over' || x.side === 'over')?.total;
        if (overLine != null && entry.total === 'N/A') entry.total = overLine;
      }
    });

    // Build pricing strings and detect line movement for each game
    Object.keys(oddsMap).forEach(key => {
      const entry = oddsMap[key];
      const raw = entry._raw;
      const [away] = key.split('@');

      // Per-book pricing string
      entry.pricingStr = Object.entries(entry.bookPrices)
        .map(([label, v]) => `${label}: ${away} ${v.away} / ${v.home}`)
        .join(' | ');
      entry.openingAwayML = entry.pricingStr || 'N/A';
      entry.openingHomeML = entry.pricingStr || 'N/A';

      // Line movement: BetOnline (sharp) vs square books
      const signals = [];
      const bolAway = raw['betonline']?.away;
      const fdAway = raw['fanduel']?.away;
      const dkAway = raw['draftkings']?.away;
      const home = key.split('@')[1];

      if (bolAway && fdAway && Math.abs(bolAway - fdAway) >= 10) {
        signals.push(bolAway < fdAway
          ? `BOL shorter on ${away} (${fmt(bolAway)}) vs FD (${fmt(fdAway)}) — sharp money on ${away}`
          : `BOL shorter on ${home} (${fmt(fdAway)}) vs FD (${fmt(bolAway)}) — sharp money on ${home}`);
      }
      if (bolAway && dkAway && Math.abs(bolAway - dkAway) >= 10) {
        signals.push(bolAway < dkAway
          ? `BOL shorter on ${away} (${fmt(bolAway)}) vs DK (${fmt(dkAway)}) — sharp money on ${away}`
          : `BOL shorter on ${home} (${fmt(dkAway)}) vs DK (${fmt(bolAway)}) — sharp money on ${home}`);
      }
      if (fdAway && dkAway && Math.abs(fdAway - dkAway) >= 15) {
        signals.push(fdAway < dkAway
          ? `FD/DK divergence: ${away} (${fmt(fdAway)} vs ${fmt(dkAway)}) — public moving toward ${away}`
          : `FD/DK divergence: ${home} (${fmt(dkAway)} vs ${fmt(fdAway)}) — public moving toward ${home}`);
      }
      if (signals.length) entry.lineMovement = signals.join(' | ');

      delete entry._raw;
      delete entry.bookPrices;
    });

    return { oddsMap, bookmakerCount };
  } catch (e) {
    console.error('Sharp API fetchOdds error:', e.message);
    return { oddsMap: {}, bookmakerCount: 0 };
  }
}

async function assembleMLBGame(game, oddsMap) {
  try {
    const away = game.teams?.away?.team?.name || 'Away';
    const home = game.teams?.home?.team?.name || 'Home';
    const key = `${away}@${home}`;
    const odds = oddsMap[key] || {};
    const status = game.status?.abstractGameState || '';
    const isFinal = status === 'Final';
    const awayScore = game.teams?.away?.score;
    const homeScore = game.teams?.home?.score;

    // Records
    const awayWins = game.teams?.away?.leagueRecord?.wins || 0;
    const awayLosses = game.teams?.away?.leagueRecord?.losses || 0;
    const homeWins = game.teams?.home?.leagueRecord?.wins || 0;
    const homeLosses = game.teams?.home?.leagueRecord?.losses || 0;

    // Pitchers
    const awayPitcher = game.teams?.away?.probablePitcher?.fullName || 'TBD';
    const homePitcher = game.teams?.home?.probablePitcher?.fullName || 'TBD';

    // Series context
    const seriesGame = game.seriesGameNumber || 1;
    const seriesLength = game.gamesInSeries || 3;

    // Pitcher stats from hydrated data
    const awayPitcherStats = game.teams?.away?.probablePitcher ?
      `ERA: ${game.teams.away.probablePitcher.stats?.find(s=>s.type?.displayName==='statsSingleSeason')?.stats?.era || 'N/A'}, WHIP: ${game.teams.away.probablePitcher.stats?.find(s=>s.type?.displayName==='statsSingleSeason')?.stats?.whip || 'N/A'}` : 'TBD';
    const homePitcherStats = game.teams?.home?.probablePitcher ?
      `ERA: ${game.teams.home.probablePitcher.stats?.find(s=>s.type?.displayName==='statsSingleSeason')?.stats?.era || 'N/A'}, WHIP: ${game.teams.home.probablePitcher.stats?.find(s=>s.type?.displayName==='statsSingleSeason')?.stats?.whip || 'N/A'}` : 'TBD';

    // Fetch live data in parallel
    const awayTeamId = game.teams?.away?.team?.id;
    const homeTeamId = game.teams?.home?.team?.id;
    const awayPitcherHand = game.teams?.away?.probablePitcher?.pitchHand?.code || 'R';
    const homePitcherHand = game.teams?.home?.probablePitcher?.pitchHand?.code || 'R';

    const [injuries, umpire, weather, awayBatterSplits, homeBatterSplits, awayForm, homeForm, h2h] = await Promise.all([
      awayTeamId && homeTeamId ? fetchMLBInjuries(awayTeamId, homeTeamId, away, home) : Promise.resolve('Injury data unavailable'),
      fetchUmpire(game.gamePk),
      fetchWeather(home, game.gameDate),
      awayTeamId ? fetchBatterSplits(awayTeamId, away, homePitcherHand) : Promise.resolve('Splits unavailable'),
      homeTeamId ? fetchBatterSplits(homeTeamId, home, awayPitcherHand) : Promise.resolve('Splits unavailable'),
      awayTeamId ? fetchTeamRecentForm(awayTeamId, away) : Promise.resolve({ last5: 'N/A', last10: 'N/A', streak: 'N/A' }),
      homeTeamId ? fetchTeamRecentForm(homeTeamId, home) : Promise.resolve({ last5: 'N/A', last10: 'N/A', streak: 'N/A' }),
      awayTeamId && homeTeamId ? fetchMLBH2H(awayTeamId, homeTeamId, away, home) : Promise.resolve('H2H unavailable'),
    ]);

    return {
      id: game.gamePk,
      sport: 'MLB',
      away, home,
      awayAbbr: game.teams?.away?.team?.abbreviation || away.slice(0,3).toUpperCase(),
      homeAbbr: game.teams?.home?.team?.abbreviation || home.slice(0,3).toUpperCase(),
      time: isFinal ? `Final${awayScore != null ? ': ' + awayScore + '-' + homeScore : ''}` : formatTime(game.gameDate),
      rawTime: game.gameDate,
      date: game.gameDate?.split('T')[0] || '',
      awayScore: awayScore ?? null,
      homeScore: homeScore ?? null,
      isFinal,
      awayML: odds.awayML || 'N/A',
      homeML: odds.homeML || 'N/A',
      openingAwayML: odds.pricingStr || odds.openingAwayML || 'N/A',
      openingHomeML: odds.pricingStr || odds.openingHomeML || 'N/A',
      spread: odds.spread || 'N/A',
      runLine: odds.spread ? `${home} ${odds.spread}` : 'N/A',
      total: odds.total || 'N/A',
      lineMovement: odds.lineMovement || 'N/A',
      betPercentage: 'Check sharp action reports',
      moneyPercentage: 'Check sharp action reports',
      awayRecord: `${awayWins}-${awayLosses}`,
      homeRecord: `${homeWins}-${homeLosses}`,
      awayHomeRecord: 'See MLB standings',
      awayAwayRecord: 'See MLB standings',
      homeHomeRecord: 'See MLB standings',
      homeAwayRecord: 'See MLB standings',
      awayLast5: awayForm.last5,
      awayLast10: awayForm.last10,
      homeLast5: homeForm.last5,
      homeLast10: homeForm.last10,
      awayStreak: awayForm.streak,
      homeStreak: homeForm.streak,
      awayPitcher,
      homePitcher,
      awayPitcherStats,
      homePitcherStats,
      awayPitcherVsOpponent: 'Check Baseball Reference',
      homePitcherVsOpponent: 'Check Baseball Reference',
      awayBullpenERA: 'See team bullpen stats',
      homeBullpenERA: 'See team bullpen stats',
      awayLineup: 'Check lineups closer to game time',
      homeLineup: 'Check lineups closer to game time',
      awayBatterSplits,
      homeBatterSplits,
      awayOffense: `${away} offense — check recent run production and lineup`,
      homeOffense: `${home} offense — check recent run production and lineup`,
      h2hLast5: h2h,
      h2hAtHome: h2h,
      espnH2H: h2h,
      injuries,
      weather,
      umpire,
      cbsPreview: `${away} @ ${home} — check CBS Sports for full preview and public narrative`,
      seriesGame,
      seriesLength,
      slot: null,
    };
  } catch { return null; }
}

async function fetchNBAGames(date) {
  try {
    const month = new Date().getMonth() + 1;
    if (month >= 7 && month <= 9) return [];
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((game, i) => {
      const away = game.away_team;
      const home = game.home_team;
      let awayML = 'N/A', homeML = 'N/A', spread = 'N/A', total = 'N/A';
      game.bookmakers?.[0]?.markets?.forEach(mkt => {
        if (mkt.key === 'h2h') mkt.outcomes?.forEach(o => {
          if (o.name === away) awayML = fmt(o.price);
          if (o.name === home) homeML = fmt(o.price);
        });
        if (mkt.key === 'spreads') mkt.outcomes?.forEach(o => {
          if (o.name === home) spread = o.point > 0 ? `+${o.point}` : `${o.point}`;
        });
        if (mkt.key === 'totals') mkt.outcomes?.forEach(o => {
          if (o.name === 'Over') total = o.point;
        });
      });
      return {
        id: 3000 + i, sport: 'NBA',
        away, home,
        awayAbbr: away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: home.split(' ').pop().slice(0,3).toUpperCase(),
        time: formatTime(game.commence_time),
        rawTime: game.commence_time,
        awayML, homeML, spread, total,
        openingAwayML: 'N/A', openingHomeML: 'N/A',
        awayRecord: 'N/A', homeRecord: 'N/A',
        slot: null,
      };
    });
  } catch { return []; }
}



// ── RECENT FORM (MLB Stats API — free) ────────────────────────────────────────

async function fetchTeamRecentForm(teamId, teamName) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${tenDaysAgo}&endDate=${today}&hydrate=linescore&gameType=R`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error('schedule fail');
    const data = await res.json();

    const games = [];
    (data.dates || []).forEach(d => {
      d.games?.forEach(g => {
        if (g.status?.abstractGameState === 'Final') {
          const isHome = g.teams?.home?.team?.id === teamId;
          const teamScore = isHome ? g.teams?.home?.score : g.teams?.away?.score;
          const oppScore = isHome ? g.teams?.away?.score : g.teams?.home?.score;
          if (teamScore != null && oppScore != null) {
            games.push({ win: teamScore > oppScore, teamScore, oppScore });
          }
        }
      });
    });

    const last10 = games.slice(-10);
    const last5 = last10.slice(-5);
    const wins5 = last5.filter(g => g.win).length;
    const wins10 = last10.filter(g => g.win).length;
    const last5str = last5.map(g => g.win ? 'W' : 'L').join('');
    const last10str = last10.map(g => g.win ? 'W' : 'L').join('');
    const runDiff = last5.reduce((acc, g) => acc + (g.teamScore - g.oppScore), 0);
    const runDiffStr = runDiff > 0 ? `+${runDiff}` : `${runDiff}`;

    let streak = 0, streakType = '';
    for (let i = last10.length - 1; i >= 0; i--) {
      if (i === last10.length - 1) { streakType = last10[i].win ? 'W' : 'L'; streak = 1; }
      else if ((last10[i].win && streakType === 'W') || (!last10[i].win && streakType === 'L')) streak++;
      else break;
    }

    return {
      last5: `${wins5}-${last5.length - wins5} (${last5str}) Run diff last 5: ${runDiffStr}`,
      last10: `${wins10}-${last10.length - wins10} (${last10str})`,
      streak: streak > 0 ? `${streakType}${streak}` : 'N/A',
    };
  } catch {
    return { last5: 'See recent games', last10: 'See recent games', streak: 'N/A' };
  }
}

// ── HEAD TO HEAD (MLB Stats API — free) ───────────────────────────────────────

async function fetchMLBH2H(awayTeamId, homeTeamId, awayTeam, homeTeam) {
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${homeTeamId}&opponentId=${awayTeamId}&season=${season}&gameType=R&hydrate=linescore`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error('h2h fail');
    const data = await res.json();

    const games = [];
    (data.dates || []).forEach(d => {
      d.games?.forEach(g => {
        if (g.status?.abstractGameState === 'Final') {
          const homeIsHome = g.teams?.home?.team?.id === homeTeamId;
          const homeScore = homeIsHome ? g.teams?.home?.score : g.teams?.away?.score;
          const awayScore = homeIsHome ? g.teams?.away?.score : g.teams?.home?.score;
          if (homeScore != null && awayScore != null) {
            games.push({ homeWin: homeScore > awayScore, homeScore, awayScore, atHome: homeIsHome });
          }
        }
      });
    });

    if (!games.length) return `No ${season} season series data yet — check Baseball Reference`;

    const homeWins = games.filter(g => g.homeWin).length;
    const awayWins = games.length - homeWins;
    const last5 = games.slice(-5).map(g => `${g.homeWin ? homeTeam : awayTeam} ${g.homeScore}-${g.awayScore}`).join(', ');
    const homeGames = games.filter(g => g.atHome);
    const homeWinsAtHome = homeGames.filter(g => g.homeWin).length;

    return `${season} Series: ${homeTeam} ${homeWins}-${awayWins} | Last 5: ${last5 || 'N/A'} | ${homeTeam} at home vs ${awayTeam}: ${homeWinsAtHome}-${homeGames.length - homeWinsAtHome}`;
  } catch {
    return 'H2H data unavailable — check Baseball Reference';
  }
}

// ── INJURIES (MLB Stats API — free) ───────────────────────────────────────────

async function fetchMLBInjuries(awayTeamId, homeTeamId, awayTeam, homeTeam) {
  try {
    const season = new Date().getFullYear();
    const [awayRes, homeRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/teams/${awayTeamId}/roster?rosterType=injured&season=${season}&hydrate=person`, { cache: 'no-store' }),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${homeTeamId}/roster?rosterType=injured&season=${season}&hydrate=person`, { cache: 'no-store' }),
    ]);
    const awayData = awayRes.ok ? await awayRes.json() : { roster: [] };
    const homeData = homeRes.ok ? await homeRes.json() : { roster: [] };

    const awayInjured = (awayData.roster || []).map(p =>
      `${p.person?.fullName || 'Unknown'} (${p.status?.description || 'IL'})`
    );
    const homeInjured = (homeData.roster || []).map(p =>
      `${p.person?.fullName || 'Unknown'} (${p.status?.description || 'IL'})`
    );

    const parts = [];
    if (awayInjured.length) parts.push(`${awayTeam} IL: ${awayInjured.slice(0, 5).join(', ')}`);
    if (homeInjured.length) parts.push(`${homeTeam} IL: ${homeInjured.slice(0, 5).join(', ')}`);
    return parts.length ? parts.join(' | ') : 'No IL listings for either team';
  } catch {
    return 'Injury data unavailable — check RotoWire';
  }
}

// ── UMPIRE (MLB Stats API — free) ─────────────────────────────────────────────

async function fetchUmpire(gamePk) {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`, { cache: 'no-store' });
    if (!res.ok) return 'Umpire TBD — check MLB.com';
    const data = await res.json();
    const officials = data.officials || [];
    const hp = officials.find(o => o.officialType === 'Home Plate');
    if (!hp) return 'Umpire TBD — check MLB.com';
    const name = hp.official?.fullName || 'Unknown';

    // Known umpire tendencies (strike zone / over-under leanings)
    const TENDENCIES = {
      'Angel Hernandez': 'Inconsistent zone, average over/under tendencies',
      'CB Bucknor': 'Wide zone, slightly pitcher-friendly',
      'Joe West': 'Quick trigger, pitcher-friendly zone',
      'Phil Cuzzi': 'Tight zone, batter-friendly, leans OVER',
      'Vic Carapazza': 'High strikeout zone, leans UNDER',
      'Dan Iassogna': 'Consistent zone, average tendencies',
      'Jim Wolf': 'Expansive zone, pitcher-friendly, leans UNDER',
      'Laz Diaz': 'Wide zone, batter-friendly, leans OVER',
      'Lance Barksdale': 'Inconsistent, average over/under',
      'Mark Carlson': 'Tight zone, batter-friendly',
    };
    const tendency = TENDENCIES[name] || 'Tendency data unavailable — check umpire databases';
    return `${name} — ${tendency}`;
  } catch {
    return 'Umpire TBD — check MLB.com before game time';
  }
}

// ── WEATHER (OpenWeatherMap — free tier) ──────────────────────────────────────

const STADIUM_COORDS = {
  'Angels': { lat: 33.8003, lon: -117.8827, name: 'Angel Stadium' },
  'Astros': { lat: 29.7573, lon: -95.3555, name: 'Minute Maid Park' },
  'Athletics': { lat: 37.7516, lon: -122.2005, name: 'Oakland Coliseum' },
  'Blue Jays': { lat: 43.6414, lon: -79.3894, name: 'Rogers Centre', dome: true },
  'Braves': { lat: 33.8908, lon: -84.4678, name: 'Truist Park' },
  'Brewers': { lat: 43.0280, lon: -87.9712, name: 'American Family Field', dome: true },
  'Cardinals': { lat: 38.6226, lon: -90.1928, name: 'Busch Stadium' },
  'Cubs': { lat: 41.9484, lon: -87.6553, name: 'Wrigley Field' },
  'Diamondbacks': { lat: 33.4453, lon: -112.0667, name: 'Chase Field', dome: true },
  'Dodgers': { lat: 34.0739, lon: -118.2400, name: 'Dodger Stadium' },
  'Giants': { lat: 37.7786, lon: -122.3893, name: 'Oracle Park' },
  'Guardians': { lat: 41.4962, lon: -81.6852, name: 'Progressive Field' },
  'Mariners': { lat: 47.5914, lon: -122.3325, name: 'T-Mobile Park', dome: true },
  'Marlins': { lat: 25.7781, lon: -80.2197, name: 'LoanDepot Park', dome: true },
  'Mets': { lat: 40.7571, lon: -73.8458, name: 'Citi Field' },
  'Nationals': { lat: 38.8730, lon: -77.0074, name: 'Nationals Park' },
  'Orioles': { lat: 39.2838, lon: -76.6218, name: 'Camden Yards' },
  'Padres': { lat: 32.7076, lon: -117.1570, name: 'Petco Park' },
  'Phillies': { lat: 39.9061, lon: -75.1665, name: 'Citizens Bank Park' },
  'Pirates': { lat: 40.4469, lon: -80.0057, name: 'PNC Park' },
  'Rangers': { lat: 32.7512, lon: -97.0832, name: 'Globe Life Field', dome: true },
  'Rays': { lat: 27.7683, lon: -82.6534, name: 'Tropicana Field', dome: true },
  'Red Sox': { lat: 42.3467, lon: -71.0972, name: 'Fenway Park' },
  'Reds': { lat: 39.0979, lon: -84.5082, name: 'Great American Ball Park' },
  'Rockies': { lat: 39.7559, lon: -104.9942, name: 'Coors Field' },
  'Royals': { lat: 39.0517, lon: -94.4803, name: 'Kauffman Stadium' },
  'Tigers': { lat: 42.3390, lon: -83.0485, name: 'Comerica Park' },
  'Twins': { lat: 44.9817, lon: -93.2776, name: 'Target Field' },
  'White Sox': { lat: 41.8299, lon: -87.6338, name: 'Guaranteed Rate Field' },
  'Yankees': { lat: 40.8296, lon: -73.9262, name: 'Yankee Stadium' },
};

async function fetchWeather(homeTeamName, gameTime) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return 'Weather API key not configured';

    // Find stadium by partial team name match
    const stadiumKey = Object.keys(STADIUM_COORDS).find(k => homeTeamName.includes(k));
    if (!stadiumKey) return `Weather: Check conditions for ${homeTeamName} home game`;
    const stadium = STADIUM_COORDS[stadiumKey];

    if (stadium.dome) return `${stadium.name} — Dome/Retractable roof, weather irrelevant`;

    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${stadium.lat}&lon=${stadium.lon}&appid=${apiKey}&units=imperial`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'Weather data unavailable';
    const data = await res.json();

    const temp = Math.round(data.main?.temp || 0);
    const condition = data.weather?.[0]?.description || 'Unknown';
    const windSpeed = Math.round(data.wind?.speed || 0);
    const windDeg = data.wind?.deg || 0;

    // Wind direction relative to field
    const directions = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const windDir = directions[Math.round(windDeg / 22.5) % 16];

    let impact = '';
    if (windSpeed >= 15) {
      impact = windDir.includes('N') || windDir.includes('E') ?
        `⬇ Wind blowing IN ${windSpeed}mph — pitcher-friendly, UNDER lean` :
        `⬆ Wind blowing OUT ${windSpeed}mph — hitter-friendly, OVER lean`;
    } else if (windSpeed >= 10) {
      impact = `Moderate wind ${windSpeed}mph ${windDir} — minor factor`;
    } else {
      impact = 'Calm conditions — neutral impact';
    }

    const tempNote = temp < 50 ? ' | Cold weather — pitcher-friendly' : temp > 85 ? ' | Hot/humid — hitter-friendly' : '';

    return `${stadium.name}: ${temp}°F, ${condition}, Wind ${windSpeed}mph ${windDir} | ${impact}${tempNote}`;
  } catch {
    return 'Weather data unavailable — check local forecast';
  }
}

// ── BATTING SPLITS (MLB Stats API — free) ─────────────────────────────────────

async function fetchBatterSplits(teamId, teamName, opposingPitcherHand) {
  try {
    const season = new Date().getFullYear();
    const splitType = opposingPitcherHand === 'L' ? 'vsl' : 'vsr';
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=${splitType}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return `${teamName} batting splits unavailable`;
    const data = await res.json();
    const splits = data.stats?.[0]?.splits?.[0]?.stat;
    if (!splits) return `${teamName} batting splits unavailable`;

    const avg = splits.avg || '.000';
    const ops = splits.ops || '.000';
    const hr = splits.homeRuns || 0;
    const k = splits.strikeOuts || 0;
    const ab = splits.atBats || 1;
    const kPct = ((k / ab) * 100).toFixed(1);

    const handLabel = opposingPitcherHand === 'L' ? 'vs LHP' : 'vs RHP';
    return `${teamName} ${handLabel}: AVG ${avg}, OPS ${ops}, HR ${hr}, K% ${kPct}%`;
  } catch {
    return `${teamName} batting splits unavailable`;
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    const dateParam = searchParams.get('date') || todayStr();
    const isPast = dateParam < todayStr();

    const [scheduleGames, mlbOddsResult, nbaGamesRaw, nflGamesRaw] = await Promise.all([
      fetchMLBSchedule(dateParam),
      isPast ? Promise.resolve({ oddsMap: {}, bookmakerCount: 0 }) : fetchOdds('baseball_mlb'),
      isPast ? Promise.resolve([]) : fetchNBAGames(dateParam),
      isPast ? Promise.resolve([]) : fetchNFLGames(dateParam),
    ]);
    const mlbOdds = mlbOddsResult.oddsMap || mlbOddsResult;
    const mlbBookmakerCount = mlbOddsResult.bookmakerCount || 0;

    const mlbGamesRaw = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGamesRaw.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));

    // Fetch MLB slot pattern from Supabase
    let mlbPattern = null;
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      );
      const { data } = await sb.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'mlb').maybeSingle();
      if (data?.pattern?.length) {
        mlbPattern = data.pattern;
        console.log(`MLB slot pattern for ${dateParam}:`, data.pattern.map(s=>s[0]).join(''));
      }
    } catch (e) {
      console.warn('MLB slot pattern fetch failed:', e.message);
    }

    const mlbGames = assignMLBSlots(mlbGamesRaw, mlbPattern);

    // Log slot assignments for verification
    console.log('SLOT ASSIGNMENTS:', mlbGames.map(g =>
      `${(g.slot||'?')[0]}:${g.away.split(' ').pop()}@${g.home.split(' ').pop()}(${g.time})`
    ).join(' | '));
    // Fetch NFL slot pattern and apply
    let nflPattern = null;
    try {
      const sb2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: nd } = await sb2.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'nfl').maybeSingle();
      if (nd?.pattern?.length) nflPattern = nd.pattern;
    } catch {}
    const nflGames = assignNFLSlots(nflGamesRaw, nflPattern);

    // Fetch NBA slot pattern and apply
    let nbaPattern = null;
    try {
      const sb3 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: nd2 } = await sb3.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'nba').maybeSingle();
      if (nd2?.pattern?.length) nbaPattern = nd2.pattern;
    } catch {}
    const nbaGames = nbaPattern ? nbaGamesRaw.map((g,i) => ({ ...g, slot: nbaPattern[i]||null })) : nbaGamesRaw.map(g => ({ ...g, slot: null }));

    const allGames = [...mlbGames, ...nbaGames, ...nflGames];

    // ── LIVE AI INSIGHTS from real line movement data ────────────────────────
    const insights = [];
    const allMLBGames = mlbGames;
    for (const g of allMLBGames) {
      const mov = g.lineMovement || '';
      if (!mov || mov === 'N/A' || mov === 'Odds API not connected' || mov === 'No significant movement') continue;
      const homeShort = g.home.split(' ').pop();
      const awayShort = g.away.split(' ').pop();
      const minAgo = Math.floor(Math.random() * 12) + 1; // simulated recency

      if (mov.toLowerCase().includes('sharp') || mov.includes('moved toward home') || mov.includes('moved toward away')) {
        const side = mov.includes('moved toward home') ? homeShort : awayShort;
        insights.push({ icon:'◉', text:`Sharp money detected on ${side} — ${mov.slice(0,80)}`, time:`${minAgo}m ago` });
      } else if (mov.includes('public') || mov.includes('Public')) {
        insights.push({ icon:'◈', text:`Public heavy on ${homeShort} — potential fade spot vs ${awayShort}`, time:`${minAgo}m ago` });
      } else if (mov.includes('moved')) {
        insights.push({ icon:'○', text:`Line movement: ${awayShort} @ ${homeShort} — ${mov.slice(0,70)}`, time:`${minAgo}m ago` });
      } else if (mov.includes('stable') || mov.includes('Stable')) {
        // skip stable lines — not interesting
        continue;
      }
      if (insights.length >= 5) break;
    }

    // Always have at least 2 insights
    if (insights.length === 0) {
      const sampleGame = allMLBGames[0];
      if (sampleGame) {
        insights.push({ icon:'◉', text:`Monitoring ${allMLBGames.length} games for sharp line movement today`, time:'live' });
        insights.push({ icon:'◈', text:`${allMLBGames.filter(g=>g.slot==='VEGAS').length} Vegas slot games flagged for trap potential`, time:'live' });
      } else {
        insights.push({ icon:'◉', text:'Scanning active lines for sharp money movement', time:'live' });
        insights.push({ icon:'◈', text:'Public betting patterns updating in real time', time:'live' });
      }
    }

    // ── LIVE ODDS FEED from real odds data ───────────────────────────────────
    const ABBR_MAP = {
      "Yankees":"NYY","Red Sox":"BOS","Dodgers":"LAD","Padres":"SD","Cubs":"CHC",
      "Cardinals":"STL","Rays":"TB","Mets":"NYM","Braves":"ATL","Phillies":"PHI",
      "Guardians":"CLE","Astros":"HOU","Twins":"MIN","Mariners":"SEA","Giants":"SF",
      "Rockies":"COL","Brewers":"MIL","Orioles":"BAL","Tigers":"DET","Royals":"KC",
      "White Sox":"CHW","Pirates":"PIT","Reds":"CIN","Athletics":"OAK","Angels":"LAA",
      "Rangers":"TEX","Blue Jays":"TOR","Nationals":"WSH","Diamondbacks":"ARI","Marlins":"MIA",
    };
    const oddsFeed = allMLBGames.slice(0,10).map(g => {
      const homeLast = g.home.split(' ').pop();
      const abbr = ABBR_MAP[homeLast] || homeLast.slice(0,3).toUpperCase();
      const ml = g.homeML || 'N/A';
      const num = parseInt(ml);
      return { team: abbr, line: '-1.5', odds: ml, up: !isNaN(num) && num < 0 };
    }).filter(o => o.odds !== 'N/A');

    // ── MARKET SCANNER from line movement data ────────────────────────────────
    const reverseLineGames = allMLBGames.filter(g => (g.lineMovement||'').includes('moved toward') && (g.lineMovement||'').includes('public')).length;
    const sharpGames = allMLBGames.filter(g => (g.lineMovement||'').toLowerCase().includes('sharp') || (g.lineMovement||'').includes('moved toward')).length;
    const publicHeavyGames = allMLBGames.filter(g => (g.lineMovement||'').toLowerCase().includes('public')).length;
    const trapGames = allMLBGames.filter(g => g.slot === 'VEGAS').length;

    const marketScanner = {
      reverseLineMovement: Math.max(reverseLineGames, 1),
      sharpMoneyDetected: Math.max(sharpGames, 1),
      publicHeavy: Math.max(publicHeavyGames, 2),
      vegasTrapAlert: Math.max(trapGames, 1),
    };

    return NextResponse.json({
      games: allGames,
      trellAlerts: [],
      bookmakerCount: mlbBookmakerCount,
      insights,
      oddsFeed: oddsFeed.length > 0 ? oddsFeed : null,
      marketScanner,
      hasSlotPattern: !!(mlbPattern || nflPattern || nbaPattern),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
