import { NextResponse } from 'next/server';
import { assignNBASlots } from '@/lib/nbaModel';

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
  // ── TRY SHARPAPI FIRST ────────────────────────────────────────────────────
  const sharpKey = process.env.SHARPAPI_KEY;
  if (sharpKey) {
    try {
      const leagueMap = {
        'baseball_mlb': 'mlb',
        'basketball_nba': 'nba',
        'americanfootball_nfl': 'nfl',
        'basketball_nba_championship': 'nba',
      };
      const league = leagueMap[sportKey];
      if (!league) return { oddsMap: {}, bookmakerCount: 0 };

      // Fetch moneyline, run_line, and totals in parallel
      const [mlRes, rlRes, totRes] = await Promise.all([
        fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&market=moneyline`, { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
        fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&market=${league === 'mlb' ? 'run_line' : 'point_spread'}`, { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
        fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&market=total`, { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
      ]);

      const mlRows  = (await mlRes.json()).data  || [];
      const rlRows  = (await rlRes.json()).data  || [];
      const totRows = (await totRes.json()).data || [];
      const allRows = [...mlRows, ...rlRows, ...totRows];
      if (!allRows.length) throw new Error('No rows from SharpAPI');

      // Group by event key
      const eventMap = {};
      const bookmakerSet = new Set();
      const preferredBooks = ['draftkings','fanduel','betmgm','caesars','pinnacle','bovada'];

      for (const row of allRows) {
        const home = row.home_team;
        const away = row.away_team;
        if (!home || !away) continue;
        const key = `${away}|${home}`;
        if (!eventMap[key]) eventMap[key] = { home, away, commenceTime: row.event_start_time, books: {} };
        const book = (row.sportsbook || '').toLowerCase();
        bookmakerSet.add(book);
        if (!eventMap[key].books[book]) eventMap[key].books[book] = {};
        const mt = (row.market_type || '').toLowerCase();
        const sel = row.selection || '';
        const odds = row.odds_american;
        const line = row.line;
        const homeWord = home.split(' ').pop().toLowerCase();
        const selLow = sel.toLowerCase();
        const isHome = selLow.includes(homeWord) || sel === home;

        if (mt === 'moneyline') {
          if (!eventMap[key].books[book].h2h) eventMap[key].books[book].h2h = {};
          if (isHome) eventMap[key].books[book].h2h.homeML = odds;
          else eventMap[key].books[book].h2h.awayML = odds;
        } else if (mt === 'run_line' || mt === 'spread' || mt === 'puck_line' || mt === 'point_spread' || mt.includes('point_spread')) {
          if (!eventMap[key].books[book].spread) eventMap[key].books[book].spread = {};
          if (isHome) { eventMap[key].books[book].spread.homePoint = line; eventMap[key].books[book].spread.homeOdds = odds; }
          else { eventMap[key].books[book].spread.awayPoint = line; eventMap[key].books[book].spread.awayOdds = odds; }
        } else if (mt === 'total' || mt.includes('over_under')) {
          if (!eventMap[key].books[book].total && selLow === 'over') eventMap[key].books[book].total = line;
        }
      }

      // Build final oddsMap from grouped events
      const oddsMap = {};

      for (const [key, event] of Object.entries(eventMap)) {
        // Pick best available book
        let bookData = null;
        for (const preferred of preferredBooks) {
          const found = Object.entries(event.books).find(([b]) => b.toLowerCase().includes(preferred));
          if (found && found[1].h2h) { bookData = found[1]; break; }
        }
        if (!bookData) {
          const first = Object.values(event.books).find(b => b.h2h);
          if (first) bookData = first;
        }
        if (!bookData) continue;

        const homeML = bookData.h2h?.homeML;
        const awayML = bookData.h2h?.awayML;
        const homePoint = bookData.spread?.homePoint;
        const awayPoint = bookData.spread?.awayPoint;
        const homeSpreadOdds = bookData.spread?.homeOdds;
        const awaySpreadOdds = bookData.spread?.awayOdds;
        const total = bookData.total;

        // Line movement: compare DraftKings vs Pinnacle as open/current proxy
        const dkData = Object.entries(event.books).find(([b]) => b.toLowerCase().includes('draftkings'))?.[1];
        const pinData = Object.entries(event.books).find(([b]) => b.toLowerCase().includes('pinnacle'))?.[1];
        const openHomeML = pinData?.h2h?.homeML;
        const openAwayML = pinData?.h2h?.awayML;

        let lineMovement = 'Line stable';
        let rlm = null;
        if (openHomeML && homeML && openHomeML !== homeML) {
          const diff = homeML - openHomeML;
          const dir = diff > 0 ? 'moved toward home' : 'moved toward away';
          lineMovement = `DraftKings ${fmt(homeML)} vs Pinnacle ${fmt(openHomeML)} (${dir}, ${Math.abs(diff)} pts)`;
          // Rough RLM detection: if line moved toward away but home team is heavily bet
          rlm = diff < -5 ? event.away : diff > 5 ? event.home : null;
          if (rlm) lineMovement += ` | ⚡ SHARP SIGNAL: Line moved toward ${rlm}`;
        } else if (homeML) {
          lineMovement = `Line stable. Home ${fmt(homeML)} / Away ${fmt(awayML)}`;
        }

        // +EV: compare DraftKings to Pinnacle no-vig
        let homeEV = null, awayEV = null;
        if (dkData?.h2h?.homeML && pinData?.h2h?.homeML) {
          const dkHome = dkData.h2h.homeML;
          const pinHome = pinData.h2h.homeML;
          const pinAway = pinData.h2h.awayML;
          if (pinHome && pinAway) {
            // No-vig probability from Pinnacle
            const toProb = (ml) => ml < 0 ? (-ml)/(-ml+100) : 100/(ml+100);
            const pHome = toProb(pinHome);
            const pAway = toProb(pinAway);
            const vig = pHome + pAway;
            const nvHome = pHome / vig;
            const nvAway = pAway / vig;
            const dkProbHome = toProb(dkHome);
            homeEV = Math.round((nvHome - dkProbHome) * 100 * 10) / 10;
            awayEV = Math.round((nvAway - (1-dkProbHome)) * 100 * 10) / 10;
          }
        }

        oddsMap[key] = {
          homeML: fmt(homeML), awayML: fmt(awayML),
          openingHomeML: fmt(openHomeML || homeML),
          openingAwayML: fmt(openAwayML || awayML),
          spread: homePoint != null ? `${event.home} ${homePoint > 0 ? '+' : ''}${homePoint} / ${event.away} ${awayPoint > 0 ? '+' : ''}${awayPoint}` : 'N/A',
          runLine: homePoint != null ? `Home ${homePoint > 0 ? '+' : ''}${homePoint} (${fmt(homeSpreadOdds)}) / Away ${awayPoint > 0 ? '+' : ''}${awayPoint} (${fmt(awaySpreadOdds)})` : 'N/A',
          total: total ? `${total}` : 'N/A',
          lineMovement,
          betPercentage: 'N/A',
          moneyPercentage: 'N/A',
          homeEV, awayEV, rlm,
          commenceTime: event.commenceTime,
        };
      }

      console.log(`SharpAPI: ${Object.keys(oddsMap).length} games, ${bookmakerSet.size} books`);
      return { oddsMap, bookmakerCount: bookmakerSet.size };
    } catch (err) {
      console.error('SharpAPI error:', err.message);
    }
  }

  // ── FALLBACK: THE ODDS API ────────────────────────────────────────────────
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { oddsMap: {}, bookmakerCount: 0 };
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (!Array.isArray(data)) return { oddsMap: {}, bookmakerCount: 0 };
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
        betPercentage: 'N/A',
        moneyPercentage: 'N/A',
        commenceTime: game.commence_time,
      };
    }
    return { oddsMap, bookmakerCount: bookmakerSet.size };
  } catch (err) {
    console.error(`Odds API fallback error:`, err.message);
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


// ── MLB H2H (MLB Stats API) ───────────────────────────────────────────────────

async function fetchMLBH2H(awayTeamId, homeTeamId, awayTeamName, homeTeamName) {
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&teamId=${homeTeamId}&opponentId=${awayTeamId}&gameType=R`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return `No H2H data available — check MLB.com`;
    const data = await res.json();
    const games = [];
    for (const date of data.dates || []) {
      for (const game of date.games || []) {
        if (game.status?.abstractGameState === 'Final') {
          const home = game.teams?.home;
          const away = game.teams?.away;
          const winner = home?.isWinner ? home?.team?.name : away?.team?.name;
          games.push({ date: date.date, score: `${away?.team?.name} ${away?.score ?? '?'} @ ${home?.team?.name} ${home?.score ?? '?'}`, winner });
        }
      }
    }
    if (games.length === 0) return `No completed H2H games yet this season`;
    const last5 = games.slice(-5).reverse();
    const awayWins = games.filter(g => g.winner === awayTeamName).length;
    const homeWins = games.filter(g => g.winner === homeTeamName).length;
    const lines = last5.map(g => `${g.date}: ${g.score} (W: ${g.winner})`);
    return `Season series: ${homeTeamName} ${homeWins}-${awayWins} ${awayTeamName} | Last ${last5.length}: ${lines.join(' | ')}`;
  } catch {
    return `H2H unavailable — check MLB.com`;
  }
}

// ── WEATHER (Open-Meteo — free, no API key) ───────────────────────────────────

const BALLPARK_COORDS = {
  "Arizona Diamondbacks":  { lat:33.4455, lon:-112.0667, name:"Chase Field", dome:true },
  "Atlanta Braves":        { lat:33.8908, lon:-84.4678,  name:"Truist Park", dome:false },
  "Baltimore Orioles":     { lat:39.2838, lon:-76.6217,  name:"Camden Yards", dome:false },
  "Boston Red Sox":        { lat:42.3467, lon:-71.0972,  name:"Fenway Park", dome:false },
  "Chicago Cubs":          { lat:41.9484, lon:-87.6553,  name:"Wrigley Field", dome:false },
  "Chicago White Sox":     { lat:41.8300, lon:-87.6338,  name:"Guaranteed Rate Field", dome:false },
  "Cincinnati Reds":       { lat:39.0979, lon:-84.5069,  name:"GABP", dome:false },
  "Cleveland Guardians":   { lat:41.4962, lon:-81.6852,  name:"Progressive Field", dome:false },
  "Colorado Rockies":      { lat:39.7559, lon:-104.9942, name:"Coors Field", dome:false },
  "Detroit Tigers":        { lat:42.3390, lon:-83.0485,  name:"Comerica Park", dome:false },
  "Houston Astros":        { lat:29.7573, lon:-95.3555,  name:"Minute Maid Park", dome:true },
  "Kansas City Royals":    { lat:39.0517, lon:-94.4803,  name:"Kauffman Stadium", dome:false },
  "Los Angeles Angels":    { lat:33.8003, lon:-117.8827, name:"Angel Stadium", dome:false },
  "Los Angeles Dodgers":   { lat:34.0739, lon:-118.2400, name:"Dodger Stadium", dome:false },
  "Miami Marlins":         { lat:25.7781, lon:-80.2197,  name:"loanDepot Park", dome:true },
  "Milwaukee Brewers":     { lat:43.0280, lon:-87.9712,  name:"American Family Field", dome:true },
  "Minnesota Twins":       { lat:44.9817, lon:-93.2776,  name:"Target Field", dome:false },
  "New York Mets":         { lat:40.7571, lon:-73.8458,  name:"Citi Field", dome:false },
  "New York Yankees":      { lat:40.8296, lon:-73.9262,  name:"Yankee Stadium", dome:false },
  "Oakland Athletics":     { lat:37.7516, lon:-122.2005, name:"Oakland Coliseum", dome:false },
  "Philadelphia Phillies": { lat:39.9061, lon:-75.1665,  name:"Citizens Bank Park", dome:false },
  "Pittsburgh Pirates":    { lat:40.4469, lon:-80.0057,  name:"PNC Park", dome:false },
  "San Diego Padres":      { lat:32.7076, lon:-117.1570, name:"Petco Park", dome:false },
  "Seattle Mariners":      { lat:47.5914, lon:-122.3325, name:"T-Mobile Park", dome:true },
  "San Francisco Giants":  { lat:37.7786, lon:-122.3893, name:"Oracle Park", dome:false },
  "St. Louis Cardinals":   { lat:38.6226, lon:-90.1928,  name:"Busch Stadium", dome:false },
  "Tampa Bay Rays":        { lat:27.7683, lon:-82.6534,  name:"Tropicana Field", dome:true },
  "Texas Rangers":         { lat:32.7512, lon:-97.0832,  name:"Globe Life Field", dome:true },
  "Toronto Blue Jays":     { lat:43.6414, lon:-79.3894,  name:"Rogers Centre", dome:true },
  "Washington Nationals":  { lat:38.8730, lon:-77.0074,  name:"Nationals Park", dome:false },
};

function getWindDir(deg) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];
}

function getCondition(code) {
  if (code===0) return "Clear";
  if (code<=3) return "Partly cloudy";
  if (code<=49) return "Foggy";
  if (code<=67) return "Rain";
  if (code<=77) return "Snow";
  if (code<=82) return "Showers";
  return "Thunderstorms";
}

async function fetchWeather(homeTeam) {
  try {
    const park = BALLPARK_COORDS[homeTeam];
    if (!park) return "Weather: ballpark not found";
    if (park.dome) return `${park.name}: DOME — weather irrelevant`;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${park.lat}&longitude=${park.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return "Weather: unavailable";
    const data = await res.json();
    const c = data.current;
    const temp = Math.round(c.temperature_2m);
    const wind = Math.round(c.wind_speed_10m);
    const dir = getWindDir(c.wind_direction_10m);
    const cond = getCondition(c.weather_code);
    const precip = c.precipitation > 0 ? `, ${c.precipitation}mm precip` : '';
    let windNote = '';
    if (wind >= 15) {
      // Wind from S/SW blows out to CF at most parks (favors offense/over)
      const deg = c.wind_direction_10m;
      const blowsOut = (deg >= 135 && deg <= 270);
      windNote = blowsOut ? ' | ⬆ WIND OUT — favors OVER' : ' | ⬇ WIND IN — favors UNDER';
    }
    return `${park.name}: ${temp}°F, ${cond}, Wind ${wind}mph ${dir}${precip}${windNote}`;
  } catch {
    return "Weather: unavailable";
  }
}

// ── UMPIRE (MLB Stats API) ────────────────────────────────────────────────────

const UMPIRE_TENDENCIES = {
  "Angel Hernandez":    "Over 54% historically — wide zone, hitter-friendly",
  "Vic Carapazza":      "Over 57% historically — very hitter-friendly",
  "Jim Reynolds":       "Over 55% historically — generous zone",
  "Dan Iassogna":       "Over 55% historically — large zone gaps",
  "Joe West":           "Under 56% historically — tight zone, quick innings",
  "Jerry Layne":        "Under 54% historically — consistent, pitcher-friendly",
  "Mike Everitt":       "Under 53% historically — tight zone",
  "Bill Miller":        "Under 55% historically — pitcher-friendly veteran",
  "Hunter Wendelstedt": "Over 53% — slightly hitter-friendly",
  "CB Bucknor":         "Over 52% — wide zone, more walks",
};

async function fetchUmpire(gamePk) {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return "HP Umpire: TBD — check MLB.com before game time";
    const data = await res.json();
    const hp = (data.officials||[]).find(o => o.officialType === "Home Plate");
    if (!hp) return "HP Umpire: TBD — check MLB.com before game time";
    const name = hp.official?.fullName || "Unknown";
    const tendency = UMPIRE_TENDENCIES[name] || "Tendency data unavailable — neutral assumption";
    return `HP Umpire: ${name} | ${tendency}`;
  } catch {
    return "HP Umpire: TBD — check MLB.com before game time";
  }
}

// ── CONFIRMED LINEUP + BATTER SPLITS vs LHP/RHP ──────────────────────────────

async function fetchLineupAndSplits(gamePk, teamId, teamName) {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return { lineup: "Not yet confirmed", splits: "Unavailable" };
    const data = await res.json();
    const isHome = data.teams?.home?.team?.id === teamId;
    const teamData = isHome ? data.teams?.home : data.teams?.away;
    const battingOrder = teamData?.battingOrder || [];
    const players = teamData?.players || {};
    let lineupStr = "Not yet confirmed";
    if (battingOrder.length > 0) {
      lineupStr = battingOrder.slice(0,9).map((id,i) => {
        const p = players[`ID${id}`];
        const name = p?.person?.fullName || `#${id}`;
        const pos = p?.position?.abbreviation || "?";
        return `${i+1}.${name}(${pos})`;
      }).join(", ");
    }
    // Team splits vs LHP and RHP
    const season = new Date().getFullYear();
    const [lRes, rRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=vsLeft&group=hitting&season=${season}`, { signal: AbortSignal.timeout(4000) }),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=vsRight&group=hitting&season=${season}`, { signal: AbortSignal.timeout(4000) }),
    ]);
    let splitsStr = "Splits unavailable";
    if (lRes.ok && rRes.ok) {
      const lData = await lRes.json();
      const rData = await rRes.json();
      const lS = lData.stats?.[0]?.splits?.[0]?.stat || {};
      const rS = rData.stats?.[0]?.splits?.[0]?.stat || {};
      splitsStr = `vs LHP: ${lS.avg||'N/A'} AVG / ${lS.ops||'N/A'} OPS | vs RHP: ${rS.avg||'N/A'} AVG / ${rS.ops||'N/A'} OPS`;
    }
    return { lineup: lineupStr, splits: splitsStr };
  } catch {
    return { lineup: "Unavailable", splits: "Unavailable" };
  }
}

// ── PITCHER VS THIS OPPONENT ──────────────────────────────────────────────────

async function fetchPitcherVsTeam(pitcherId, pitcherName, oppTeamId, oppTeamName) {
  if (!pitcherId) return `${pitcherName||"TBD"} vs ${oppTeamName}: Pitcher not confirmed`;
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=vsTeam&group=pitching&season=${season}&opposingTeamId=${oppTeamId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      const s = d.stats?.[0]?.splits?.[0]?.stat;
      if (s) return `${pitcherName} vs ${oppTeamName} this season: ${s.era||'N/A'} ERA, ${s.whip||'N/A'} WHIP, ${s.inningsPitched||0} IP, ${s.wins||0}-${s.losses||0} W-L, ${s.strikeOuts||0} K, ${s.homeRuns||0} HR allowed`;
    }
    // Try career
    const carRes = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=vsTeamTotal&group=pitching&opposingTeamId=${oppTeamId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (carRes.ok) {
      const cd = await carRes.json();
      const cs = cd.stats?.[0]?.splits?.[0]?.stat;
      if (cs) return `${pitcherName} career vs ${oppTeamName}: ${cs.era||'N/A'} ERA, ${cs.whip||'N/A'} WHIP, ${cs.inningsPitched||0} IP, ${cs.wins||0}-${cs.losses||0} W-L, ${cs.strikeOuts||0} K`;
    }
    return `${pitcherName} vs ${oppTeamName}: No matchup data yet this season`;
  } catch {
    return `${pitcherName} vs ${oppTeamName}: Splits unavailable`;
  }
}

async function assembleMLBGame(g, oddsMap) {
  const home = g.teams.home.team;
  const away = g.teams.away.team;
  const homePitcher = g.teams.home.probablePitcher;
  const awayPitcher = g.teams.away.probablePitcher;
  const oddsKey = `${away.name}|${home.name}`;
  const odds = oddsMap[oddsKey] || {};
  const [
    homeRecord, awayRecord, homePitcherStats, awayPitcherStats, cbsPreview,
    weather, umpire, homeLineupData, awayLineupData,
    homePitcherVsAway, awayPitcherVsHome, mlbH2H,
  ] = await Promise.all([
    fetchTeamRecord(home.id),
    fetchTeamRecord(away.id),
    fetchPitcherStats(homePitcher?.id),
    fetchPitcherStats(awayPitcher?.id),
    fetchCBSSportsPreview(away.name, home.name, 'mlb'),
    fetchWeather(home.name),
    fetchUmpire(g.gamePk),
    fetchLineupAndSplits(g.gamePk, home.id, home.name),
    fetchLineupAndSplits(g.gamePk, away.id, away.name),
    fetchPitcherVsTeam(homePitcher?.id, homePitcher?.fullName, away.id, away.name),
    fetchPitcherVsTeam(awayPitcher?.id, awayPitcher?.fullName, home.id, home.name),
    fetchMLBH2H(away.id, home.id, away.name, home.name),
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
    h2hLast5: mlbH2H, h2hAtHome: 'See season series above',
    injuries: 'Check rotowire.com for injury report',
    lineMovement: odds.lineMovement || 'Odds API not connected',
    homeEV: odds.homeEV || null,
    awayEV: odds.awayEV || null,
    rlm: odds.rlm || null,
    cbsPreview,
    weather,
    umpire,
    homeLineup: homeLineupData.lineup,
    awayLineup: awayLineupData.lineup,
    homeBatterSplits: homeLineupData.splits,
    awayBatterSplits: awayLineupData.splits,
    homePitcherVsOpponent: homePitcherVsAway,
    awayPitcherVsOpponent: awayPitcherVsHome,
    gameStatus: g.status?.detailedState || 'Scheduled',
    seriesGame: g.seriesGameNumber || 1,
    seriesLength: g.gamesInSeries || 3,
    slot: 'PUBLIC',
  };
}

// ── NBA GAMES ─────────────────────────────────────────────────────────────────

async function fetchNBAGames(dateParam) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];
  try {
    // Try regular season key first, then playoffs key
    let oddsMap = {};
    for (const sportKey of ['basketball_nba', 'basketball_nba_championship']) {
      const oddsResult = await fetchOdds(sportKey);
      const map = oddsResult.oddsMap || oddsResult;
      const validEntries = Object.entries(map).filter(([k]) => !k.startsWith('_'));
      if (validEntries.length > 0) {
        validEntries.forEach(([k, v]) => { oddsMap[k] = v; });
      }
    }
    if (Object.keys(oddsMap).length === 0) return [];

    const games = (await Promise.all(
      Object.entries(oddsMap)
        .filter(([key]) => !key.startsWith('_'))
        .map(async ([key, odds], i) => {
          const [away, home] = key.split('|');
          // Filter by selected date
          const gameDate = odds.commenceTime?.split('T')[0];
          if (dateParam && gameDate && gameDate !== dateParam) return null;

          const NBA_ABBR = {
            "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN",
            "Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE",
            "Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET",
            "Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND",
            "LA Clippers":"LAC","Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL",
            "Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL",
            "Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP",
            "New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL",
            "Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR",
            "Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR",
            "Utah Jazz":"UTA","Washington Wizards":"WAS",
          };

          return {
            id: 1000 + i, sport: 'NBA',
            rawTime: odds.commenceTime,
            time: formatTime(odds.commenceTime),
            date: gameDate || dateParam || todayStr(),
            away, home,
            awayCity: away.split(' ').slice(0,-1).join(' ').toUpperCase(),
            homeCity: home.split(' ').slice(0,-1).join(' ').toUpperCase(),
            awayAbbr: NBA_ABBR[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
            homeAbbr: NBA_ABBR[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
            awayRecord: 'See NBA standings', homeRecord: 'See NBA standings',
            awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
            awayLast5: 'N/A', homeLast5: 'N/A',
            awayLast10: 'N/A', homeLast10: 'N/A',
            awayStreak: 'N/A', homeStreak: 'N/A',
            awayML: odds.awayML || 'N/A', homeML: odds.homeML || 'N/A',
            openingAwayML: odds.openingAwayML || 'N/A',
            openingHomeML: odds.openingHomeML || 'N/A',
            spread: odds.spread || 'N/A', total: odds.total || 'N/A',
            lineMovement: odds.lineMovement || 'N/A',
            betPercentage: 'Available with paid tier',
            moneyPercentage: 'Available with paid tier',
            awayKeyPlayers: 'Check NBA roster', homeKeyPlayers: 'Check NBA roster',
            injuries: 'Check rotowire.com/basketball/nba/injury-report.php',
            h2hLast5: 'N/A', h2hAtHome: 'N/A',
            seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
            seriesHistory: 'N/A',
            awayPPG: 'N/A', homePPG: 'N/A',
            awayOffRating: 'N/A', homeOffRating: 'N/A',
            awayDefRating: 'N/A', homeDefRating: 'N/A',
            awayPace: 'N/A', homePace: 'N/A',
            cbsPreview: 'Check CBS Sports for preview',
            gameStatus: 'Scheduled', slot: 'PUBLIC',
            homeEV: odds.homeEV || null,
            awayEV: odds.awayEV || null,
            rlm: odds.rlm || null,
          };
        })
    )).filter(Boolean);

    return assignNBASlots(games);
  } catch (err) {
    console.error('NBA games error:', err.message);
    return [];
  }
}

// ── NFL GAMES ─────────────────────────────────────────────────────────────────

function assignNFLSlots(games) {
  return games.map((g, i) => ({ ...g, slot: i % 2 === 0 ? 'PUBLIC' : 'VEGAS' }));
}

async function fetchNFLGames(dateParam) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];
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
          h2hLast5: 'Check NFL H2H history',
          injuries: 'Check rotowire.com/football/nfl/injury-report.php',
          weather: 'Check game time weather',
          cbsPreview: 'Check CBS Sports for preview',
          gameStatus: 'Scheduled',
          week: 'N/A', gameType: 'Regular Season',
          slot: 'PUBLIC',
        };
      }).filter(Boolean);

    return assignNFLSlots(games);
  } catch (err) {
    console.error('NFL games error:', err.message);
    return [];
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    const dateParam = searchParams.get('date') || todayStr();
  const [scheduleGames, mlbOddsResult, nbaGames, nflGames] = await Promise.all([
      fetchMLBSchedule(dateParam),
      fetchOdds('baseball_mlb'),
      fetchNBAGames(dateParam),
      fetchNFLGames(dateParam),
    ]);
    const mlbOdds = mlbOddsResult.oddsMap || mlbOddsResult;
    const mlbBookmakerCount = mlbOddsResult.bookmakerCount || 0;

    const mlbGamesRaw = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGamesRaw.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const mlbGames = assignMLBSlots(mlbGamesRaw);
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
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
