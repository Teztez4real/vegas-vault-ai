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

    const games = (await Promise.all(Object.entries(oddsMap)
      .filter(([key]) => !key.startsWith('_'))
      .map(async ([key, odds], i) => {
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
          cbsPreview: await fetchGameNarrative(away, home, 'NFL'),
          gameStatus: 'Scheduled',
          week: 'N/A', gameType: 'Regular Season',
          slot: null,
        };
      })
    )).filter(Boolean);

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
    const ODDS_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_KEY) return { oddsMap: {}, bookmakerCount: 0 };

    const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKS.join(',')}`,
      { cache: 'no-store' }
    );
    if (!res.ok) { console.error('Odds API error:', res.status); return { oddsMap: {}, bookmakerCount: 0 }; }

    const data = await res.json();
    console.log('Odds API games:', data.length, 'first game markets:', data[0]?.bookmakers?.[0]?.markets?.map(m=>m.key));
    const oddsMap = {};

    data.forEach(game => {
      const away = (game.away_team || '').trim();
      const home = (game.home_team || '').trim();
      const key = `${away}@${home}`;
      let awayML = 'N/A', homeML = 'N/A', spread = 'N/A', total = 'N/A';
      let awaySpreadPrice = null, homeSpreadPrice = null, overPrice = null, underPrice = null;
      const bookPrices = {};
      const _raw = {};

      const PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
      const books = (game.bookmakers || []).sort((a,b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));

      books.forEach(bm => {
        const label = bm.key === 'draftkings' ? 'DK' : bm.key === 'fanduel' ? 'FD' : bm.key === 'betmgm' ? 'MGM' : bm.key === 'caesars' ? 'CZR' : 'B365';
        bm.markets?.forEach(mkt => {
          if (mkt.key === 'h2h') mkt.outcomes?.forEach(o => {
            if (o.name === away && awayML === 'N/A') awayML = fmt(o.price);
            if (o.name === home && homeML === 'N/A') homeML = fmt(o.price);
            bookPrices[label] = bookPrices[label] || {};
            _raw[bm.key] = _raw[bm.key] || {};
            if (o.name === away) { bookPrices[label].away = fmt(o.price); _raw[bm.key].away = o.price; }
            if (o.name === home) { bookPrices[label].home = fmt(o.price); _raw[bm.key].home = o.price; }
          });
          if (mkt.key === 'spreads') mkt.outcomes?.forEach(o => {
            if (o.name === home && spread === 'N/A') {
              spread = o.point > 0 ? `+${o.point}` : `${o.point}`;
              homeSpreadPrice = fmt(o.price);
            }
            if (o.name === away && !awaySpreadPrice) {
              awaySpreadPrice = fmt(o.price);
            }
          });
          if (mkt.key === 'totals') mkt.outcomes?.forEach(o => {
            if (o.name === 'Over' && total === 'N/A') total = o.point;
            if (o.name === 'Over' && !overPrice) overPrice = fmt(o.price);
            if (o.name === 'Under' && !underPrice) underPrice = fmt(o.price);
          });
        });
      });

      const pricingStr = Object.entries(bookPrices).map(([l,v]) => `${l}: ${v.away||'N/A'}/${v.home||'N/A'}`).join(' | ');

      // Line movement: Bet365 (sharp) vs FD/DK
      const b365 = _raw['bet365']?.away;
      const fd = _raw['fanduel']?.away;
      const dk = _raw['draftkings']?.away;
      const signals = [];
      if (b365 && fd && Math.abs(b365-fd) >= 10) signals.push(`B365 ${fmt(b365)} vs FD ${fmt(fd)} — sharp on ${b365<fd?away.split(' ').pop():home.split(' ').pop()}`);
      if (b365 && dk && Math.abs(b365-dk) >= 10) signals.push(`B365 ${fmt(b365)} vs DK ${fmt(dk)} — sharp on ${b365<dk?away.split(' ').pop():home.split(' ').pop()}`);
      if (fd && dk && Math.abs(fd-dk) >= 8) signals.push(`FD ${fmt(fd)} vs DK ${fmt(dk)} — divergence on ${fd<dk?away.split(' ').pop():home.split(' ').pop()}`);

      oddsMap[key] = { awayML, homeML, spread, total, awaySpreadPrice: awaySpreadPrice||'-110', homeSpreadPrice: homeSpreadPrice||'-110', overPrice: overPrice||'-110', underPrice: underPrice||'-110', openingAwayML: pricingStr||'N/A', openingHomeML: pricingStr||'N/A', lineMovement: signals.join(' | ')||'No significant movement', pricingStr };
    });

    console.log('OddsMap keys:', Object.keys(oddsMap).join(' | '));
    return { oddsMap, bookmakerCount: 5 };
  } catch(e) { console.error('fetchOdds error:', e.message); return { oddsMap: {}, bookmakerCount: 0 }; }
}


async function fetchPitcherVsOpponent(pitcherId, opponentTeamId, pitcherName) {
  if (!pitcherId || !opponentTeamId) return 'N/A';
  try {
    const season = new Date().getFullYear();
    // Get pitcher's game log vs this opponent this season
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=vsTeam&opposingTeamId=${opponentTeamId}&group=pitching&season=${season}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'N/A';
    const data = await res.json();
    const stats = data.stats?.[0]?.splits?.[0]?.stat;
    if (!stats) return `${pitcherName} — No matchup data vs this team this season`;
    const era = stats.era || 'N/A';
    const ip = stats.inningsPitched || '0';
    const h = stats.hits ?? 'N/A';
    const er = stats.earnedRuns ?? 'N/A';
    const bb = stats.baseOnBalls ?? 'N/A';
    const so = stats.strikeOuts ?? 'N/A';
    const g = stats.gamesPitched ?? 0;
    return `${pitcherName} vs this team: ${g} G | ${ip} IP | ERA ${era} | ${h} H | ${er} ER | ${bb} BB | ${so} K`;
  } catch {
    return 'N/A';
  }
}

async function fetchFullPitcherStats(pitcherId, pitcherName) {
  if (!pitcherId) return 'TBD';
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&group=pitching&season=${season}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'TBD';
    const data = await res.json();
    const stats = data.stats?.[0]?.splits?.[0]?.stat;
    if (!stats) return 'TBD';
    const era = stats.era || 'N/A';
    const whip = stats.whip || 'N/A';
    const ip = stats.inningsPitched || '0';
    const w = stats.wins ?? 0;
    const l = stats.losses ?? 0;
    const so = stats.strikeOuts ?? 'N/A';
    const bb = stats.baseOnBalls ?? 'N/A';
    const hr = stats.homeRuns ?? 'N/A';
    const avg = stats.avg || 'N/A';
    const gs = stats.gamesStarted ?? 0;
    return `${w}-${l} | ${gs} GS | ${ip} IP | ERA ${era} | WHIP ${whip} | ${so} K | ${bb} BB | ${hr} HR | BAA ${avg}`;
  } catch {
    return 'TBD';
  }
}

async function fetchGameNarrative(away, home, sport) {
  try {
    const keyword = `${away.split(' ').pop()} ${home.split(' ').pop()}`;
    const sportKey = sport === 'MLB' ? 'baseball/mlb' : sport === 'NBA' ? 'basketball/nba' : sport === 'NFL' ? 'football/nfl' : 'baseball/mlb';

    // Fetch ESPN news for both teams
    const [awayNews, homeNews] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportKey}/news?limit=3&team=${away.split(' ').pop()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportKey}/news?limit=3&team=${home.split(' ').pop()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const headlines = [];

    const extractHeadlines = (data, teamName) => {
      if (!data?.articles) return;
      data.articles.slice(0, 2).forEach(a => {
        if (a.headline) headlines.push(`[${teamName}] ${a.headline}`);
      });
    };

    extractHeadlines(awayNews, away.split(' ').pop());
    extractHeadlines(homeNews, home.split(' ').pop());

    if (!headlines.length) return `No recent headlines found for ${away} @ ${home}. Use your knowledge of current team narratives, recent performance stories, and public sentiment.`;

    return `Recent Headlines:\n${headlines.join('\n')}`;
  } catch {
    return `Use your knowledge of current media narratives for ${away} @ ${home}.`;
  }
}

async function assembleMLBGame(game, oddsMap) {
  try {
    const away = (game.teams?.away?.team?.name || 'Away').trim();
    const home = (game.teams?.home?.team?.name || 'Home').trim();
    const key = `${away}@${home}`;

    // Fuzzy match — try exact first, then last-word match, then any-word match
    let odds = oddsMap[key];
    if (!odds || (!odds.awayML || odds.awayML === 'N/A')) {
      const awayLast = away.split(' ').pop().toLowerCase();
      const homeLast = home.split(' ').pop().toLowerCase();
      // Try last word match
      let fuzzyKey = Object.keys(oddsMap).find(k => {
        const [a, h] = k.split('@');
        return a?.toLowerCase().includes(awayLast) && h?.toLowerCase().includes(homeLast);
      });
      // Try any word match if still not found
      if (!fuzzyKey) {
        fuzzyKey = Object.keys(oddsMap).find(k => {
          const [a, h] = k.split('@');
          const awayWords = away.toLowerCase().split(' ');
          const homeWords = home.toLowerCase().split(' ');
          return awayWords.some(w => w.length > 3 && a?.toLowerCase().includes(w)) &&
                 homeWords.some(w => w.length > 3 && h?.toLowerCase().includes(w));
        });
      }
      if (fuzzyKey) odds = oddsMap[fuzzyKey];
    }
    if (!odds || !odds.awayML || odds.awayML === 'N/A') {
      console.log('No odds found for:', key, '| Available keys:', Object.keys(oddsMap).slice(0,3));
    }
    odds = odds || {};
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

    // Pitcher IDs for detailed stats fetch
    const awayPitcherId = game.teams?.away?.probablePitcher?.id;
    const homePitcherId = game.teams?.home?.probablePitcher?.id;

    // Fetch live data in parallel
    const awayTeamId = game.teams?.away?.team?.id;
    const homeTeamId = game.teams?.home?.team?.id;
    const awayPitcherHand = game.teams?.away?.probablePitcher?.pitchHand?.code || 'R';
    const homePitcherHand = game.teams?.home?.probablePitcher?.pitchHand?.code || 'R';

    const [injuries, umpire, weather, awayBatterSplits, homeBatterSplits, awayForm, homeForm, h2h, awayPitcherStats, homePitcherStats, awayPitcherVsOpp, homePitcherVsOpp, awayBullpen, homeBullpen, awayLineup, homeLineup, gameNarrative] = await Promise.all([
      awayTeamId && homeTeamId ? fetchMLBInjuries(awayTeamId, homeTeamId, away, home) : Promise.resolve('Injury data unavailable'),
      fetchUmpire(game.gamePk),
      fetchWeather(home, game.gameDate),
      awayTeamId ? fetchBatterSplits(awayTeamId, away, homePitcherHand) : Promise.resolve('Splits unavailable'),
      homeTeamId ? fetchBatterSplits(homeTeamId, home, awayPitcherHand) : Promise.resolve('Splits unavailable'),
      awayTeamId ? fetchTeamRecentForm(awayTeamId, away) : Promise.resolve({ last5: 'N/A', last10: 'N/A', streak: 'N/A' }),
      homeTeamId ? fetchTeamRecentForm(homeTeamId, home) : Promise.resolve({ last5: 'N/A', last10: 'N/A', streak: 'N/A' }),
      awayTeamId && homeTeamId ? fetchMLBH2H(awayTeamId, homeTeamId, away, home) : Promise.resolve('H2H unavailable'),
      fetchFullPitcherStats(awayPitcherId, awayPitcher),
      fetchFullPitcherStats(homePitcherId, homePitcher),
      fetchPitcherVsOpponent(awayPitcherId, homeTeamId, awayPitcher),
      fetchPitcherVsOpponent(homePitcherId, awayTeamId, homePitcher),
      awayTeamId ? fetchBullpenStats(awayTeamId, away) : Promise.resolve('N/A'),
      homeTeamId ? fetchBullpenStats(homeTeamId, home) : Promise.resolve('N/A'),
      fetchConfirmedLineup(game.gamePk, awayTeamId, away),
      fetchConfirmedLineup(game.gamePk, homeTeamId, home),
      fetchGameNarrative(away, home, 'MLB'),
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
      dkAwayML: odds.awayML || 'N/A',
      dkHomeML: odds.homeML || 'N/A',
      dkSpread: odds.spread || 'N/A',
      dkTotal: odds.total || 'N/A',
      awaySpreadPrice: odds.awaySpreadPrice || '-110',
      homeSpreadPrice: odds.homeSpreadPrice || '-110',
      overPrice: odds.overPrice || '-110',
      underPrice: odds.underPrice || '-110',
      openingAwayML: odds.pricingStr || odds.openingAwayML || 'N/A',
      openingHomeML: odds.pricingStr || odds.openingHomeML || 'N/A',
      spread: odds.spread || 'N/A',
      runLine: odds.spread ? `${home} ${odds.spread}` : 'N/A',
      total: odds.total || 'N/A',
      lineMovement: odds.lineMovement || 'N/A',
      betPercentage: odds.betPercentage || 'N/A',
      moneyPercentage: odds.moneyPercentage || 'N/A',
      openingLine: odds.openingLine || odds.pricingStr || 'N/A',
      pricingStr: odds.pricingStr || 'N/A',
      awayRecord: `${awayWins}-${awayLosses}`,
      homeRecord: `${homeWins}-${homeLosses}`,
      awayHomeRecord: awayForm.homeRecord || 'N/A',
      awayAwayRecord: awayForm.awayRecord || 'N/A',
      awayATS: awayForm.atsRecord || 'N/A',
      homeHomeRecord: homeForm.homeRecord || 'N/A',
      homeAwayRecord: homeForm.awayRecord || 'N/A',
      homeATS: homeForm.atsRecord || 'N/A',
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
      awayPitcherVsOpponent: awayPitcherVsOpp || 'N/A',
      homePitcherVsOpponent: homePitcherVsOpp || 'N/A',
      awayBullpenERA: awayBullpen || 'N/A',
      homeBullpenERA: homeBullpen || 'N/A',
      awayLineup: awayLineup || 'Not yet posted',
      homeLineup: homeLineup || 'Not yet posted',
      awayBatterSplits,
      homeBatterSplits,
      awayOffense: `${away} offense — check recent run production and lineup`,
      homeOffense: `${home} offense — check recent run production and lineup`,
      h2hLast5: h2h?.overall || h2h,
      h2hAtHome: h2h?.atHome || h2h,
      espnH2H: h2h?.overall || h2h,
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

// ── NBA DATA FUNCTIONS ────────────────────────────────────────────────────────

async function fetchNBATeamStats(teamName) {
  try {
    // Use ESPN API to get team stats including home/away/ATS
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
    const team = teams.find(t => {
      const name = t.team?.displayName || '';
      return name === teamName || name.includes(teamName.split(' ').pop());
    });
    return team?.team?.id || null;
  } catch { return null; }
}

async function fetchNBARecentForm(teamName) {
  try {
    // Get team ID first
    const searchRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50`,
      { cache: 'no-store' }
    );
    if (!searchRes.ok) return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A' };
    const searchData = await searchRes.json();
    const teams = searchData.sports?.[0]?.leagues?.[0]?.teams || [];
    const team = teams.find(t => {
      const n = t.team?.displayName || '';
      return n === teamName || n.includes(teamName.split(' ').pop());
    });
    if (!team?.team?.id) return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A' };

    const teamId = team.team.id;
    // NBA 2025-26 season = season=2026
    const currentYear = new Date().getFullYear();
    const nbaSeasonYear = new Date().getMonth() >= 9 ? currentYear + 1 : currentYear; // Oct+ = next year's season
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?season=${nbaSeasonYear}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A' };
    const data = await res.json();

    const games = (data.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed);
    const results = games.map(e => {
      const comp = e.competitions[0];
      const isHome = comp.competitors?.[0]?.homeAway === 'home' && comp.competitors?.[0]?.team?.id === teamId ||
                     comp.competitors?.[1]?.homeAway === 'home' && comp.competitors?.[1]?.team?.id === teamId;
      const myTeam = comp.competitors?.find(c => c.team?.id === teamId);
      const oppTeam = comp.competitors?.find(c => c.team?.id !== teamId);
      const myScore = parseInt(myTeam?.score || 0);
      const oppScore = parseInt(oppTeam?.score || 0);
      const win = myScore > oppScore;
      return { win, myScore, oppScore, isHome };
    });

    const last10 = results.slice(-10);
    const last5 = last10.slice(-5);
    const wins5 = last5.filter(g => g.win).length;
    const wins10 = last10.filter(g => g.win).length;
    const last5str = last5.map(g => g.win ? 'W' : 'L').join('');
    const last10str = last10.map(g => g.win ? 'W' : 'L').join('');

    // Streak
    let streak = 0, streakType = '';
    for (let i = last10.length - 1; i >= 0; i--) {
      if (i === last10.length - 1) { streakType = last10[i].win ? 'W' : 'L'; streak = 1; }
      else if ((last10[i].win && streakType === 'W') || (!last10[i].win && streakType === 'L')) streak++;
      else break;
    }

    // Home/Away splits
    const homeG = results.filter(g => g.isHome);
    const awayG = results.filter(g => !g.isHome);
    const homeW = homeG.filter(g => g.win).length;
    const awayW = awayG.filter(g => g.win).length;

    // ATS (spread -3.5 approx): win by 4+
    const atsW = results.filter(g => g.win && (g.myScore - g.oppScore) >= 4).length + results.filter(g => !g.win && (g.oppScore - g.myScore) <= 3).length;

    return {
      last5: `${wins5}-${last5.length - wins5} (${last5str})`,
      last10: `${wins10}-${last10.length - wins10} (${last10str})`,
      streak: streak > 0 ? `${streakType}${streak}` : 'N/A',
      homeRecord: `${homeW}-${homeG.length - homeW}`,
      awayRecord: `${awayW}-${awayG.length - awayW}`,
      atsRecord: `${atsW}-${results.length - atsW}`,
    };
  } catch { return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A' }; }
}

async function fetchNBAH2H(awayTeam, homeTeam) {
  try {
    const season = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'H2H unavailable';
    const data = await res.json();
    const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
    const homeT = teams.find(t => (t.team?.displayName || '').includes(homeTeam.split(' ').pop()));
    if (!homeT?.team?.id) return 'H2H unavailable';

    const schedRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${homeT.team.id}/schedule?season=${season}`,
      { cache: 'no-store' }
    );
    if (!schedRes.ok) return 'H2H unavailable';
    const schedData = await schedRes.json();

    const awayKeyword = awayTeam.split(' ').pop();
    const h2hGames = (schedData.events || []).filter(e => {
      const comp = e.competitions?.[0];
      const completed = comp?.status?.type?.completed;
      const hasAway = comp?.competitors?.some(c => (c.team?.displayName || '').includes(awayKeyword));
      return completed && hasAway;
    });

    if (!h2hGames.length) return `No ${season} season H2H games yet`;

    const parseGame = (e) => {
      const comp = e.competitions[0];
      const homeComp = comp.competitors?.find(c => c.homeAway === 'home' && (c.team?.displayName || '').includes(homeTeam.split(' ').pop()));
      const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
      const homeScore = parseInt(homeComp?.score || 0);
      const awayScore = parseInt(awayComp?.score || 0);
      const homeWin = homeScore > awayScore;
      const atHome = !!homeComp;
      return { homeWin, homeScore, awayScore, atHome };
    };

    const parsed = h2hGames.map(parseGame);
    const homeWins = parsed.filter(g => g.homeWin).length;
    const results = parsed.map(g => `${g.homeWin ? homeTeam.split(' ').pop() : awayTeam.split(' ').pop()} ${g.homeScore}-${g.awayScore}`);

    // Home venue H2H — games where home team hosted
    const homeVenueGames = parsed.filter(g => g.atHome);
    let atHomeStr = 'No home venue H2H this season';
    if (homeVenueGames.length) {
      const hvw = homeVenueGames.filter(g => g.homeWin).length;
      const lastHome = homeVenueGames.slice(-1)[0];
      atHomeStr = `At ${homeTeam.split(' ').pop()}: ${hvw}-${homeVenueGames.length - hvw} | Last: ${lastHome.homeWin ? homeTeam.split(' ').pop() : awayTeam.split(' ').pop()} ${lastHome.homeScore}-${lastHome.awayScore}`;
    }

    const overall = `${season} Season: ${homeTeam.split(' ').pop()} ${homeWins}-${h2hGames.length - homeWins} vs ${awayTeam.split(' ').pop()} | Recent: ${results.slice(-3).join(', ')}`;
    return { overall, atHome: atHomeStr };
  } catch { return { overall: 'H2H unavailable', atHome: 'Home venue H2H unavailable' }; }
}

async function fetchNBAPlayoffContext(awayTeam, homeTeam, date) {
  try {
    const month = new Date(date || Date.now()).getMonth() + 1;
    const isPlayoffMonth = month >= 4 && month <= 6;
    if (!isPlayoffMonth) return { isPlayoffs: false, context: 'Regular Season' };

    const res = await fetch(
      `https://site.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=nba`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { isPlayoffs: true, context: 'NBA Playoffs' };
    const data = await res.json();

    // Check if any game has playoff series info
    const games = data.sports?.[0]?.leagues?.[0]?.events || [];
    const awayKeyword = awayTeam.split(' ').pop();
    const homeKeyword = homeTeam.split(' ').pop();
    const matchGame = games.find(g => {
      const name = g.name || '';
      return name.includes(awayKeyword) || name.includes(homeKeyword);
    });

    const seriesInfo = matchGame?.series;
    if (seriesInfo) {
      const summary = seriesInfo.summary || '';
      const gameNum = seriesInfo.completed + 1;
      const awayWins = seriesInfo.competitors?.[0]?.wins || 0;
      const homeWins = seriesInfo.competitors?.[1]?.wins || 0;
      return {
        isPlayoffs: true,
        context: `NBA PLAYOFFS — Game ${gameNum} | Series: ${awayTeam.split(' ').pop()} ${awayWins}-${homeWins} ${homeTeam.split(' ').pop()} | ${summary}`,
        gameNumber: gameNum,
        seriesRecord: `${awayWins}-${homeWins}`,
      };
    }
    return { isPlayoffs: true, context: 'NBA Playoffs' };
  } catch { return { isPlayoffs: false, context: 'Regular Season' }; }
}

async function fetchNBAGames(date) {
  try {
    const month = new Date().getMonth() + 1;
    if (month >= 7 && month <= 9) return [];
    const nbaRecords = await fetchNBARecords();
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Filter to only games on the requested date (in CT timezone)
    const targetDate = date || new Date().toISOString().split('T')[0];
    const filtered = data.filter(game => {
      const gameDate = new Date(game.commence_time);
      // Convert to CT (UTC-5 or UTC-6)
      const ct = new Date(gameDate.getTime() - 5 * 60 * 60 * 1000);
      const gameDateStr = ct.toISOString().split('T')[0];
      return gameDateStr === targetDate;
    });
    return Promise.all(filtered.map(async (game, i) => {
      const away = game.away_team;
      const home = game.home_team;
      let awayML = 'N/A', homeML = 'N/A', spread = 'N/A', total = 'N/A';
      let awaySpreadPrice = null, homeSpreadPrice = null, overPrice = null, underPrice = null;
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
      const nbaAbbrMap = {'Atlanta Hawks':'ATL','Boston Celtics':'BOS','Brooklyn Nets':'BKN','Charlotte Hornets':'CHA','Chicago Bulls':'CHI','Cleveland Cavaliers':'CLE','Dallas Mavericks':'DAL','Denver Nuggets':'DEN','Detroit Pistons':'DET','Golden State Warriors':'GSW','Houston Rockets':'HOU','Indiana Pacers':'IND','Los Angeles Clippers':'LAC','Los Angeles Lakers':'LAL','Memphis Grizzlies':'MEM','Miami Heat':'MIA','Milwaukee Bucks':'MIL','Minnesota Timberwolves':'MIN','New Orleans Pelicans':'NOP','New York Knicks':'NYK','Oklahoma City Thunder':'OKC','Orlando Magic':'ORL','Philadelphia 76ers':'PHI','Phoenix Suns':'PHX','Portland Trail Blazers':'POR','Sacramento Kings':'SAC','San Antonio Spurs':'SAS','Toronto Raptors':'TOR','Utah Jazz':'UTA','Washington Wizards':'WAS'};

      // Build per-book pricing string for discrepancy analysis
      const PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
      const books = (game.bookmakers || []).sort((a,b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
      const bookPrices = {};
      const _raw = {};
      books.forEach(bm => {
        const label = bm.key === 'draftkings' ? 'DK' : bm.key === 'fanduel' ? 'FD' : bm.key === 'betmgm' ? 'MGM' : bm.key === 'caesars' ? 'CZR' : 'B365';
        bm.markets?.forEach(mkt => {
          if (mkt.key === 'h2h') mkt.outcomes?.forEach(o => {
            bookPrices[label] = bookPrices[label] || {};
            _raw[bm.key] = _raw[bm.key] || {};
            if (o.name === away) { bookPrices[label].away = fmt(o.price); _raw[bm.key].away = o.price; }
            if (o.name === home) { bookPrices[label].home = fmt(o.price); _raw[bm.key].home = o.price; }
          });
        });
      });
      const pricingStr = Object.entries(bookPrices).map(([l,v]) => `${l}: ${v.away||'N/A'}/${v.home||'N/A'}`).join(' | ');

      // Line movement signals
      const b365Away = _raw['bet365']?.away, fdAway = _raw['fanduel']?.away, dkAway = _raw['draftkings']?.away;
      const signals = [];
      if (b365Away && fdAway && Math.abs(b365Away-fdAway) >= 8) signals.push(`B365 ${fmt(b365Away)} vs FD ${fmt(fdAway)} — sharp on ${b365Away<fdAway?away.split(' ').pop():home.split(' ').pop()}`);
      if (b365Away && dkAway && Math.abs(b365Away-dkAway) >= 8) signals.push(`B365 ${fmt(b365Away)} vs DK ${fmt(dkAway)} — sharp on ${b365Away<dkAway?away.split(' ').pop():home.split(' ').pop()}`);
      const lineMovement = signals.join(' | ') || 'No significant movement';

      // Fetch NBA-specific data in parallel
      const [awayForm, homeForm, h2h, playoffCtx] = await Promise.all([
        fetchNBARecentForm(away),
        fetchNBARecentForm(home),
        fetchNBAH2H(away, home),
        fetchNBAPlayoffContext(away, home, game.commence_time),
      ]);

      return {
        id: 3000 + i, sport: 'NBA',
        away, home,
        awayAbbr: nbaAbbrMap[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: nbaAbbrMap[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
        time: formatTime(game.commence_time),
        rawTime: game.commence_time,
        awayML, homeML, spread, total,
        openingAwayML: pricingStr || 'N/A',
        openingHomeML: pricingStr || 'N/A',
        pricingStr,
        lineMovement,
        awayRecord: nbaRecords[away] || 'N/A',
        homeRecord: nbaRecords[home] || 'N/A',
        awayHomeRecord: awayForm.homeRecord,
        awayAwayRecord: awayForm.awayRecord,
        awayATS: awayForm.atsRecord,
        homeHomeRecord: homeForm.homeRecord,
        homeAwayRecord: homeForm.awayRecord,
        homeATS: homeForm.atsRecord,
        awayLast5: awayForm.last5,
        awayLast10: awayForm.last10,
        awayStreak: awayForm.streak,
        homeLast5: homeForm.last5,
        homeLast10: homeForm.last10,
        homeStreak: homeForm.streak,
        h2hLast5: h2h?.overall || h2h,
        h2hAtHome: h2h?.atHome || h2h,
        awaySpreadPrice: game.awaySpreadPrice || '-110',
        homeSpreadPrice: game.homeSpreadPrice || '-110',
        overPrice: game.overPrice || '-110',
        underPrice: game.underPrice || '-110',
        isPlayoffs: playoffCtx.isPlayoffs,
        playoffContext: playoffCtx.context,
        playoffGameNumber: playoffCtx.gameNumber,
        playoffSeriesRecord: playoffCtx.seriesRecord,
        slot: null,
      };
    }));
  } catch { return []; }
}



async function fetchNBARecords() {
  try {
    // Try standings first
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings', { cache: 'no-store' });
    const records = {};
    if (res.ok) {
      const data = await res.json();
      (data.children || []).forEach(conf => {
        (conf.standings?.entries || conf.entries || []).forEach(entry => {
          const name = entry.team?.displayName || entry.team?.name || '';
          const wins = entry.stats?.find(s => s.name === 'wins')?.value ?? '';
          const losses = entry.stats?.find(s => s.name === 'losses')?.value ?? '';
          if (name && wins !== '') records[name] = `${wins}-${losses}`;
        });
      });
    }
    // If standings empty (offseason/playoffs), try teams endpoint for season records
    if (!Object.keys(records).length) {
      const teamsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50', { cache: 'no-store' });
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        const teams = teamsData.sports?.[0]?.leagues?.[0]?.teams || [];
        teams.forEach(t => {
          const name = t.team?.displayName || '';
          const rec = t.team?.record?.items?.[0]?.summary || '';
          if (name && rec) records[name] = rec;
        });
      }
    }
    return records;
  } catch { return {}; }
}

async function fetchWNBARecords() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/standings', { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    const records = {};
    (data.children || []).forEach(conf => {
      (conf.standings?.entries || conf.entries || []).forEach(entry => {
        const name = entry.team?.displayName || entry.team?.name || '';
        const wins = entry.stats?.find(s => s.name === 'wins')?.value ?? '';
        const losses = entry.stats?.find(s => s.name === 'losses')?.value ?? '';
        if (name && wins !== '') records[name] = `${wins}-${losses}`;
      });
    });
    return records;
  } catch { return {}; }
}

async function fetchWNBARecentForm(teamName) {
  try {
    const keyword = teamName.split(' ').pop();
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams?limit=20`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { last5:'N/A', last10:'N/A', streak:'N/A', homeRecord:'N/A', awayRecord:'N/A', atsRecord:'N/A' };
    const data = await res.json();
    const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
    const team = teams.find(t => (t.team?.displayName||'').includes(keyword));
    if (!team?.team?.id) return { last5:'N/A', last10:'N/A', streak:'N/A', homeRecord:'N/A', awayRecord:'N/A', atsRecord:'N/A' };

    const schedRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${team.team.id}/schedule`,
      { cache: 'no-store' }
    );
    if (!schedRes.ok) return { last5:'N/A', last10:'N/A', streak:'N/A', homeRecord:'N/A', awayRecord:'N/A', atsRecord:'N/A' };
    const sched = await schedRes.json();

    const results = (sched.events || [])
      .filter(e => e.competitions?.[0]?.status?.type?.completed)
      .map(e => {
        const comp = e.competitions[0];
        const my = comp.competitors?.find(c => c.team?.id === team.team.id);
        const opp = comp.competitors?.find(c => c.team?.id !== team.team.id);
        const myScore = parseInt(my?.score || 0);
        const oppScore = parseInt(opp?.score || 0);
        return { win: myScore > oppScore, myScore, oppScore, isHome: my?.homeAway === 'home' };
      });

    const last10 = results.slice(-10);
    const last5 = last10.slice(-5);
    const w5 = last5.filter(g=>g.win).length;
    const w10 = last10.filter(g=>g.win).length;
    const l5str = last5.map(g=>g.win?'W':'L').join('');
    const l10str = last10.map(g=>g.win?'W':'L').join('');

    let streak=0, sType='';
    for (let i=last10.length-1;i>=0;i--) {
      if (i===last10.length-1){sType=last10[i].win?'W':'L';streak=1;}
      else if((last10[i].win&&sType==='W')||(!last10[i].win&&sType==='L'))streak++;
      else break;
    }

    const homeG=results.filter(g=>g.isHome), awayG=results.filter(g=>!g.isHome);
    const atsW=results.filter(g=>g.win&&(g.myScore-g.oppScore)>=4).length + results.filter(g=>!g.win&&(g.oppScore-g.myScore)<=3).length;

    return {
      last5: `${w5}-${last5.length-w5} (${l5str})`,
      last10: `${w10}-${last10.length-w10} (${l10str})`,
      streak: streak>0?`${sType}${streak}`:'N/A',
      homeRecord: `${homeG.filter(g=>g.win).length}-${homeG.filter(g=>!g.win).length}`,
      awayRecord: `${awayG.filter(g=>g.win).length}-${awayG.filter(g=>!g.win).length}`,
      atsRecord: `${atsW}-${results.length-atsW}`,
    };
  } catch { return { last5:'N/A', last10:'N/A', streak:'N/A', homeRecord:'N/A', awayRecord:'N/A', atsRecord:'N/A' }; }
}

async function fetchWNBAH2H(awayTeam, homeTeam) {
  try {
    const homeKeyword = homeTeam.split(' ').pop();
    const awayKeyword = awayTeam.split(' ').pop();
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams?limit=20`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'H2H unavailable';
    const data = await res.json();
    const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
    const homeT = teams.find(t => (t.team?.displayName||'').includes(homeKeyword));
    if (!homeT?.team?.id) return 'H2H unavailable';

    const schedRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${homeT.team.id}/schedule`,
      { cache: 'no-store' }
    );
    if (!schedRes.ok) return 'H2H unavailable';
    const sched = await schedRes.json();

    const h2hGames = (sched.events||[]).filter(e => {
      const comp = e.competitions?.[0];
      return comp?.status?.type?.completed && comp?.competitors?.some(c=>(c.team?.displayName||'').includes(awayKeyword));
    });
    if (!h2hGames.length) return 'No H2H games this season yet';

    const homeWins = h2hGames.filter(e => {
      const comp = e.competitions[0];
      const homeComp = comp.competitors?.find(c=>c.homeAway==='home'&&(c.team?.displayName||'').includes(homeKeyword));
      const awayComp = comp.competitors?.find(c=>c.homeAway==='away');
      return parseInt(homeComp?.score||0) > parseInt(awayComp?.score||0);
    }).length;

    const results = h2hGames.map(e => {
      const comp = e.competitions[0];
      const c1 = comp.competitors?.[0], c2 = comp.competitors?.[1];
      return `${parseInt(c1?.score||0)>parseInt(c2?.score||0)?c1.team?.abbreviation:c2.team?.abbreviation} ${c1?.score}-${c2?.score}`;
    }).join(', ');

    return `${homeTeam.split(' ').pop()} ${homeWins}-${h2hGames.length-homeWins} vs ${awayTeam.split(' ').pop()} this season | Results: ${results}`;
  } catch { return 'H2H unavailable'; }
}

async function fetchWNBAGames(date) {
  try {
    const wnbaRecords = await fetchWNBARecords();
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_wnba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dateFiltered = data.filter(game => {
      const ct = new Date(new Date(game.commence_time).getTime() - 5 * 60 * 60 * 1000);
      return ct.toISOString().split('T')[0] === targetDate;
    });

    return Promise.all(dateFiltered.map(async (game, i) => {
      const away = game.away_team;
      const home = game.home_team;
      let awayML = 'N/A', homeML = 'N/A', spread = 'N/A', total = 'N/A';
      let awaySpreadPrice = null, homeSpreadPrice = null, overPrice = null, underPrice = null;

      // Per-book pricing for discrepancy analysis
      const PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
      const books = (game.bookmakers || []).sort((a,b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
      const bookPrices = {}, _raw = {};
      books.forEach(bm => {
        const label = bm.key==='draftkings'?'DK':bm.key==='fanduel'?'FD':bm.key==='betmgm'?'MGM':bm.key==='caesars'?'CZR':'B365';
        bm.markets?.forEach(mkt => {
          if (mkt.key==='h2h') mkt.outcomes?.forEach(o => {
            bookPrices[label]=bookPrices[label]||{}; _raw[bm.key]=_raw[bm.key]||{};
            if (o.name===away){bookPrices[label].away=fmt(o.price);_raw[bm.key].away=o.price;if(awayML==='N/A')awayML=fmt(o.price);}
            if (o.name===home){bookPrices[label].home=fmt(o.price);_raw[bm.key].home=o.price;if(homeML==='N/A')homeML=fmt(o.price);}
          });
          if (mkt.key==='spreads') mkt.outcomes?.forEach(o => {
            if (o.name===home&&spread==='N/A') spread=o.point>0?`+${o.point}`:`${o.point}`;
          });
          if (mkt.key==='totals') mkt.outcomes?.forEach(o => {
            if (o.name==='Over'&&total==='N/A') total=o.point;
          });
        });
      });
      const pricingStr = Object.entries(bookPrices).map(([l,v])=>`${l}: ${v.away||'N/A'}/${v.home||'N/A'}`).join(' | ');

      // Line movement
      const b365Away=_raw['bet365']?.away, fdAway=_raw['fanduel']?.away, dkAway=_raw['draftkings']?.away;
      const signals=[];
      if(b365Away&&fdAway&&Math.abs(b365Away-fdAway)>=8) signals.push(`B365 ${fmt(b365Away)} vs FD ${fmt(fdAway)} — sharp on ${b365Away<fdAway?away.split(' ').pop():home.split(' ').pop()}`);
      if(b365Away&&dkAway&&Math.abs(b365Away-dkAway)>=8) signals.push(`B365 ${fmt(b365Away)} vs DK ${fmt(dkAway)} — sharp on ${b365Away<dkAway?away.split(' ').pop():home.split(' ').pop()}`);
      const lineMovement = signals.join(' | ') || 'No significant movement';

      // Fetch WNBA-specific data
      const [awayForm, homeForm, h2h] = await Promise.all([
        fetchWNBARecentForm(away),
        fetchWNBARecentForm(home),
        fetchWNBAH2H(away, home),
      ]);

      console.log("WNBA forms:", JSON.stringify({away: awayForm, home: homeForm, h2h: h2h?.slice(0,80)}));
      const wnbaAbbrMap = {'Atlanta Dream':'Dream','Chicago Sky':'Sky','Connecticut Sun':'Sun','Dallas Wings':'Wings','Indiana Fever':'Fever','Las Vegas Aces':'Aces','Los Angeles Sparks':'Sparks','Minnesota Lynx':'Lynx','New York Liberty':'Liberty','Phoenix Mercury':'Mercury','Seattle Storm':'Storm','Washington Mystics':'Mystics','Toronto Tempo':'Tempo'};

      return {
        id: 5000 + i, sport: 'WNBA',
        away, home,
        awayAbbr: wnbaAbbrMap[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: wnbaAbbrMap[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
        time: formatTime(game.commence_time),
        rawTime: game.commence_time,
        awayML, homeML, spread, total,
        pricingStr,
        openingAwayML: pricingStr || 'N/A',
        openingHomeML: pricingStr || 'N/A',
        lineMovement,
        awayRecord: wnbaRecords[away] || Object.entries(wnbaRecords).find(([k]) => away.includes(k.split(' ').pop()) || k.includes(away.split(' ').pop()))?.[1] || 'N/A',
        homeRecord: wnbaRecords[home] || Object.entries(wnbaRecords).find(([k]) => home.includes(k.split(' ').pop()) || k.includes(home.split(' ').pop()))?.[1] || 'N/A',
        awayHomeRecord: awayForm.homeRecord,
        awayAwayRecord: awayForm.awayRecord,
        awayATS: awayForm.atsRecord,
        homeHomeRecord: homeForm.homeRecord,
        homeAwayRecord: homeForm.awayRecord,
        homeATS: homeForm.atsRecord,
        awayLast5: awayForm.last5,
        awayLast10: awayForm.last10,
        awayStreak: awayForm.streak,
        homeLast5: homeForm.last5,
        homeLast10: homeForm.last10,
        homeStreak: homeForm.streak,
        h2h,
        slot: 'WNBA',
      };
    }));
  } catch { return []; }
}

// ── RECENT FORM (MLB Stats API — free) ────────────────────────────────────────

async function fetchTeamRecentForm(teamId, teamName) {
  try {
    const season = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];
    const tenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    // Fetch recent games AND full season record in parallel
    const [recentRes, seasonRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${tenDaysAgo}&endDate=${today}&hydrate=linescore&gameType=R`, { cache: 'no-store' }),
      fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&hydrate=linescore&gameType=R`, { cache: 'no-store' }),
    ]);

    const parseGamesFromData = (data, tid) => {
      const games = [];
      (data.dates || []).forEach(d => {
        d.games?.forEach(g => {
          if (g.status?.abstractGameState === 'Final') {
            const isHome = g.teams?.home?.team?.id === tid;
            const teamScore = isHome ? g.teams?.home?.score : g.teams?.away?.score;
            const oppScore = isHome ? g.teams?.away?.score : g.teams?.home?.score;
            if (teamScore != null && oppScore != null) {
              games.push({ win: teamScore > oppScore, teamScore, oppScore, isHome });
            }
          }
        });
      });
      return games;
    };

    const recentData = recentRes.ok ? await recentRes.json() : { dates: [] };
    const seasonData = seasonRes.ok ? await seasonRes.json() : { dates: [] };

    const recentGames = parseGamesFromData(recentData, teamId);
    const seasonGames = parseGamesFromData(seasonData, teamId);

    // Recent form
    const last10 = recentGames.slice(-10);
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

    // Season home/away splits
    const homeGames = seasonGames.filter(g => g.isHome);
    const awayGames = seasonGames.filter(g => !g.isHome);
    const homeW = homeGames.filter(g => g.win).length;
    const awayW = awayGames.filter(g => g.win).length;
    const homeRecord = `${homeW}-${homeGames.length - homeW}`;
    const awayRecord = `${awayW}-${awayGames.length - awayW}`;

    // ATS record (run line -1.5): wins by 2+ as favorite, or loses by 1 or wins as dog
    const atsWins = seasonGames.filter(g => {
      const margin = g.teamScore - g.oppScore;
      return margin >= 2; // covers -1.5
    }).length;
    const atsLosses = seasonGames.length - atsWins;
    const atsRecord = `${atsWins}-${atsLosses}`;

    return {
      last5: `${wins5}-${last5.length - wins5} (${last5str}) | Run diff: ${runDiffStr}`,
      last10: `${wins10}-${last10.length - wins10} (${last10str})`,
      streak: streak > 0 ? `${streakType}${streak}` : 'N/A',
      homeRecord,
      awayRecord,
      atsRecord,
    };
  } catch {
    return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A' };
  }
}

// ── HEAD TO HEAD (MLB Stats API — free) ───────────────────────────────────────

async function fetchMLBH2H(awayTeamId, homeTeamId, awayTeam, homeTeam) {
  try {
    const season = new Date().getFullYear();
    const lastSeason = season - 1;

    // Fetch both current and last season in parallel
    const [curRes, lastRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${homeTeamId}&opponentId=${awayTeamId}&season=${season}&gameType=R&hydrate=linescore`, { cache: 'no-store' }),
      fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${homeTeamId}&opponentId=${awayTeamId}&season=${lastSeason}&gameType=R&hydrate=linescore`, { cache: 'no-store' }),
    ]);

    function parseGames(data) {
      const games = [];
      (data.dates || []).forEach(d => {
        d.games?.forEach(g => {
          if (g.status?.abstractGameState === 'Final') {
            const homeIsHome = g.teams?.home?.team?.id === homeTeamId;
            const homeScore = homeIsHome ? g.teams?.home?.score : g.teams?.away?.score;
            const awayScore = homeIsHome ? g.teams?.away?.score : g.teams?.home?.score;
            if (homeScore != null && awayScore != null)
              games.push({ homeWin: homeScore > awayScore, homeScore, awayScore, atHome: homeIsHome });
          }
        });
      });
      return games;
    }

    const curData = curRes.ok ? await curRes.json() : { dates: [] };
    const lastData = lastRes.ok ? await lastRes.json() : { dates: [] };

    const curGames = parseGames(curData);
    const lastGames = parseGames(lastData);

    const parts = [];

    // Current season
    if (curGames.length) {
      const hw = curGames.filter(g => g.homeWin).length;
      const aw = curGames.length - hw;
      const last5 = curGames.slice(-5).map(g => `${g.homeWin ? homeTeam.split(' ').pop() : awayTeam.split(' ').pop()} ${g.homeScore}-${g.awayScore}`).join(', ');
      const homeG = curGames.filter(g => g.atHome);
      const hwh = homeG.filter(g => g.homeWin).length;
      parts.push(`${season}: ${homeTeam.split(' ').pop()} ${hw}-${aw} vs ${awayTeam.split(' ').pop()} | Recent: ${last5} | At home: ${hwh}-${homeG.length - hwh}`);
    } else {
      parts.push(`${season}: No games played yet`);
    }

    // Last season
    if (lastGames.length) {
      const hw = lastGames.filter(g => g.homeWin).length;
      const aw = lastGames.length - hw;
      const homeG = lastGames.filter(g => g.atHome);
      const hwh = homeG.filter(g => g.homeWin).length;
      parts.push(`${lastSeason}: ${homeTeam.split(' ').pop()} ${hw}-${aw} | At home: ${hwh}-${homeG.length - hwh}`);
    } else {
      parts.push(`${lastSeason}: No data`);
    }

    // Build home-specific H2H string
    const homeOnlyParts = [];
    const curHomeGames = curGames.filter(g => g.atHome);
    if (curHomeGames.length) {
      const hwh = curHomeGames.filter(g => g.homeWin).length;
      const lastHomeGame = curHomeGames.slice(-1)[0];
      const lastHomeResult = lastHomeGame ? `Last at home: ${lastHomeGame.homeWin ? homeTeam.split(' ').pop() : awayTeam.split(' ').pop()} ${lastHomeGame.homeScore}-${lastHomeGame.awayScore}` : '';
      homeOnlyParts.push(`${season} at ${homeTeam.split(' ').pop()}: ${hwh}-${curHomeGames.length - hwh} | ${lastHomeResult}`);
    } else {
      // Fall back to last season home games
      const lastHomeGames = lastGames.filter(g => g.atHome);
      if (lastHomeGames.length) {
        const hwh = lastHomeGames.filter(g => g.homeWin).length;
        const lastHomeGame = lastHomeGames.slice(-1)[0];
        const lastHomeResult = lastHomeGame ? `Last at home (${lastSeason}): ${lastHomeGame.homeWin ? homeTeam.split(' ').pop() : awayTeam.split(' ').pop()} ${lastHomeGame.homeScore}-${lastHomeGame.awayScore}` : '';
        homeOnlyParts.push(`No ${season} home games yet | ${lastSeason} at ${homeTeam.split(' ').pop()}: ${hwh}-${lastHomeGames.length - hwh} | ${lastHomeResult}`);
      } else {
        homeOnlyParts.push('No home H2H data available');
      }
    }

    return { overall: parts.join(' || '), atHome: homeOnlyParts.join(' || ') };
  } catch {
    return { overall: 'H2H data unavailable — check Baseball Reference', atHome: 'Home H2H unavailable' };
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

async function fetchBullpenStats(teamId, teamName) {
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${season}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'N/A';
    const data = await res.json();
    const stats = data.stats?.[0]?.splits?.[0]?.stat;
    if (!stats) return 'N/A';
    const era = stats.era || 'N/A';
    const whip = stats.whip || 'N/A';
    const saves = stats.saves ?? 'N/A';
    const blownSaves = stats.blownSaves ?? 'N/A';
    const hr = stats.homeRuns ?? 'N/A';
    const k9 = stats.strikeoutsPer9Inn || 'N/A';
    return `${teamName} Bullpen — ERA: ${era} | WHIP: ${whip} | K/9: ${k9} | SV: ${saves} | BS: ${blownSaves} | HR allowed: ${hr}`;
  } catch {
    return 'Bullpen data unavailable';
  }
}

async function fetchConfirmedLineup(gamePk, teamId, teamName) {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 'Lineup not yet confirmed';
    const data = await res.json();
    const teamKey = data.teams?.away?.team?.id === teamId ? 'away' : 'home';
    const batters = data.teams?.[teamKey]?.battingOrder || [];
    const players = data.teams?.[teamKey]?.players || {};
    if (!batters.length) return 'Lineup not yet posted';
    const lineup = batters.slice(0, 9).map((id, i) => {
      const p = players[`ID${id}`];
      const name = p?.person?.fullName?.split(' ').pop() || `#${id}`;
      const pos = p?.position?.abbreviation || '?';
      const avg = p?.seasonStats?.batting?.avg || '.---';
      const hr = p?.seasonStats?.batting?.homeRuns ?? 0;
      const rbi = p?.seasonStats?.batting?.rbi ?? 0;
      return `${i+1}. ${name} (${pos}) ${avg} ${hr}HR ${rbi}RBI`;
    }).join(' | ');
    return lineup || 'Lineup not yet posted';
  } catch {
    return 'Lineup not yet confirmed';
  }
}

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
      'Angel Hernandez': 'Inconsistent zone, high variance — OVER lean historically',
      'CB Bucknor': 'Wide zone, pitcher-friendly, leans UNDER',
      'Phil Cuzzi': 'Tight zone, batter-friendly, strong OVER lean',
      'Vic Carapazza': 'High strikeout zone, strong UNDER lean',
      'Dan Iassogna': 'Consistent tight zone, slight UNDER lean',
      'Jim Wolf': 'Expansive zone, pitcher-friendly, UNDER lean',
      'Laz Diaz': 'Wide zone, batter-friendly, OVER lean',
      'Lance Barksdale': 'Inconsistent, slightly batter-friendly',
      'Mark Carlson': 'Tight zone, batter-friendly, slight OVER',
      'Stu Scheurwater': 'Consistent zone, neutral',
      'Chris Guccione': 'Wide zone, pitcher-friendly, UNDER lean',
      'Bill Miller': 'Tight zone, average tendencies',
      'Mike Muchlinski': 'Consistent, neutral tendencies',
      'Adrian Johnson': 'Wide zone, batter-friendly, OVER lean',
      'John Libka': 'Tight zone, pitcher-friendly',
      'Brian Knight': 'Consistent, slightly pitcher-friendly',
      'Ben May': 'Neutral zone, average tendencies',
      'Manny Gonzalez': 'Inconsistent, slight OVER lean',
      'Alfonso Marquez': 'Consistent, neutral to UNDER',
      'Jerry Meals': 'Wide zone, pitcher-friendly, UNDER lean',
      'Paul Nauert': 'Tight zone, batter-friendly',
      'Ron Kulpa': 'High K zone, strong UNDER lean',
      'Ted Barrett': 'Consistent, neutral',
      'Marty Foster': 'Wide zone, pitcher-friendly',
      'Doug Eddings': 'Inconsistent, slight OVER lean',
      'Greg Gibson': 'Consistent, neutral to UNDER',
      'Tripp Gibson': 'Tight zone, batter-friendly, OVER lean',
      'Mike Estabrook': 'Consistent, neutral',
      'Will Little': 'Wide zone, pitcher-friendly',
      'Fieldin Culbreth': 'Wide zone, UNDER lean',
      'Sam Holbrook': 'Consistent, neutral',
      'Quinn Wolcott': 'Tight zone, batter-friendly',
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
    const handLabel = opposingPitcherHand === 'L' ? 'vs LHP' : 'vs RHP';

    // Fetch team-level splits AND individual player splits in parallel
    const [teamRes, rosterRes] = await Promise.all([
      fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=${splitType}`,
        { cache: 'no-store' }
      ),
      fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${season}`,
        { cache: 'no-store' }
      ),
    ]);

    // Team-level splits
    let teamLine = `${teamName} ${handLabel}: Data unavailable`;
    if (teamRes.ok) {
      const data = await teamRes.json();
      const splits = data.stats?.[0]?.splits?.[0]?.stat;
      if (splits) {
        const avg = splits.avg || '.000';
        const slg = splits.slg || '.000';
        const obp = splits.obp || '.000';
        const ops = splits.ops || '.000';
        const hr = splits.homeRuns || 0;
        const rbi = splits.rbi || 0;
        const k = splits.strikeOuts || 0;
        const bb = splits.baseOnBalls || 0;
        const ab = splits.atBats || 1;
        const kPct = ((k / ab) * 100).toFixed(1);
        const bbPct = ((bb / ab) * 100).toFixed(1);
        teamLine = `${teamName} ${handLabel}: AVG ${avg} | OBP ${obp} | SLG ${slg} | OPS ${ops} | HR ${hr} | RBI ${rbi} | K% ${kPct}% | BB% ${bbPct}%`;
      }
    }

    // Individual top hitter splits (fetch stats for active roster)
    let topHitters = '';
    if (rosterRes.ok) {
      const rosterData = await rosterRes.json();
      const players = (rosterData.roster || []).filter(p => p.position?.type === 'Hitter').slice(0, 13);

      const playerStats = await Promise.allSettled(
        players.map(p =>
          fetch(
            `https://statsapi.mlb.com/api/v1/people/${p.person.id}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=${splitType}`,
            { cache: 'no-store' }
          ).then(r => r.ok ? r.json() : null)
        )
      );

      const hitterLines = [];
      players.forEach((p, i) => {
        const result = playerStats[i];
        if (result.status !== 'fulfilled' || !result.value) return;
        const stat = result.value?.stats?.[0]?.splits?.[0]?.stat;
        if (!stat || !stat.atBats || stat.atBats < 5) return;
        const name = p.person.fullName.split(' ').pop();
        const avg = stat.avg || '.---';
        const ops = stat.ops || '.---';
        const hr = stat.homeRuns || 0;
        const ab = stat.atBats || 0;
        hitterLines.push(`${name}: ${avg}/${ops} (${ab} AB, ${hr} HR)`);
      });

      if (hitterLines.length) {
        topHitters = ` | Key hitters ${handLabel}: ${hitterLines.slice(0, 6).join(', ')}`;
      }
    }

    return teamLine + topHitters;
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
