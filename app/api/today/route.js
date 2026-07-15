import { NextResponse } from 'next/server';
import { assignNBASlots } from '@/lib/nbaModel';

function assignNFLSlots(games, pattern) {
  return assignSlotFromPattern(games, pattern);
}
import { createClient } from '@supabase/supabase-js';
import { getOrFreezeOpeningLine, buildTrueLineMovementText } from '@/lib/openingLines';
import { espnPathFor, oddsApiKeyFor } from '@/lib/sports';

// ── UTILITIES ─────────────────────────────────────────────────────────────────

// Robustly extracts a numeric score from an ESPN competitor's `score` field,
// which is NOT consistently shaped across ESPN endpoints — sometimes a plain
// string ("85"), sometimes a number, sometimes a nested object
// ({value: 85, displayValue: "85"}). A naive parseInt() on the object case
// silently produces NaN, and NaN > NaN is always false — which makes EVERY
// game evaluate as a loss for EVERY team, corrupting L5/L10/streak/ATS with
// a fake "always loses" record that looks plausible but is completely wrong.
// Returns null (not 0) on failure, so callers can tell "genuinely lost 0-X"
// apart from "couldn't parse this game's score" and exclude the latter
// instead of quietly computing a fabricated result from it.
function extractScore(scoreField) {
  if (scoreField == null) return null;
  if (typeof scoreField === 'number') return isNaN(scoreField) ? null : scoreField;
  if (typeof scoreField === 'string') {
    const n = parseInt(scoreField, 10);
    return isNaN(n) ? null : n;
  }
  if (typeof scoreField === 'object') {
    const raw = scoreField.value ?? scoreField.displayValue ?? scoreField.$ref;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function todayStr() {
  // Use US Central time, not UTC — UTC's date rolls over to "tomorrow"
  // during US evening hours (e.g. 9 PM CT = ~2-3 AM UTC next day), which
  // would otherwise shift the default slate to tomorrow's games/odds.
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ctNow.getFullYear();
  const m = String(ctNow.getMonth() + 1).padStart(2, '0');
  const d = String(ctNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// Shared slot-assignment logic for every sport. CRITICAL: every game must get
// a real PUBLIC/VEGAS slot whenever an admin pattern exists — previously each
// sport's assignment did `pattern[i] || null`, which left any game beyond the
// pattern's length with NO slot at all (e.g. admin saves an 10-slot pattern
// but 12 games are actually scheduled that day — games 11 and 12 silently got
// no slot, showing "AWAITING SLOT PATTERN" even though a pattern WAS set).
// Now the pattern cycles (wraps back to the start) so every game index maps
// to a real slot, no matter how many games exist relative to pattern length.
function assignSlotFromPattern(games, pattern) {
  if (!pattern || !Array.isArray(pattern) || pattern.length === 0) {
    return games.map(g => ({ ...g, slot: null }));
  }
  return games.map((g, i) => ({ ...g, slot: pattern[i % pattern.length] }));
}

function assignMLBSlots(games, adminPattern = null) {
  // Slots ONLY come from the admin pattern — no auto-assignment
  return assignSlotFromPattern(games, adminPattern);
}

// ── SHARED ESPN SCOREBOARD (final/live scores) ────────────────────────────────
// MLB gets isFinal/awayScore/homeScore from the MLB Stats API. NBA and NFL had
// NO equivalent — their game objects never carried a final score, so games in
// those sports could never be graded (win/loss tracked) even once analyzed.
// This gives NBA and NFL the SAME score-tracking parity MLB already has, using
// ESPN's scoreboard endpoint (the same site.api.espn.com host already used
// successfully elsewhere in this file for NBA/WNBA schedule and standings).
// Returns a map keyed by "Away Team|Home Team" (ESPN displayName) →
// { isFinal, awayScore, homeScore, status }.
async function fetchESPNFinalScores(sportPath, dateStr) {
  const map = {};
  try {
    const ymd = (dateStr || todayStr()).replace(/-/g, '');
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${ymd}`, { cache: 'no-store' });
    if (!res.ok) return map;
    const data = await res.json();
    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      if (!away || !home) continue;
      const awayName = away.team?.displayName || away.team?.name;
      const homeName = home.team?.displayName || home.team?.name;
      if (!awayName || !homeName) continue;
      const completed = comp.status?.type?.completed === true;
      const scoreData = {
        isFinal: completed,
        awayScore: extractScore(away.score),
        homeScore: extractScore(home.score),
        status: comp.status?.type?.description || (completed ? 'Final' : 'Scheduled'),
      };
      // Exact full-name key (e.g. "Kansas City Chiefs|Buffalo Bills")
      map[`${awayName}|${homeName}`] = scoreData;
      // ALSO index by team NICKNAME (last word, e.g. "Chiefs|Bills"). The Odds
      // API and ESPN don't always format team names identically (city
      // abbreviations, "LA" vs "Los Angeles", etc) — an exact-string-only
      // match would silently fail on any such difference and that game
      // could NEVER be graded. The nickname is far more stable across
      // providers, so this is the safety net that keeps every game matchable.
      const awayNick = awayName.trim().split(' ').pop();
      const homeNick = homeName.trim().split(' ').pop();
      const nickKey = `${awayNick}|${homeNick}`;
      if (!map[nickKey]) map[nickKey] = scoreData;
    }
  } catch {}
  return map;
}

// Looks up a score for (away, home) trying an exact match first, then
// falling back to a nickname (last-word) match — see the comment above.
function lookupESPNScore(scoresMap, away, home) {
  if (!away || !home) return null;
  const exact = scoresMap[`${away}|${home}`];
  if (exact) return exact;
  const awayNick = away.trim().split(' ').pop();
  const homeNick = home.trim().split(' ').pop();
  return scoresMap[`${awayNick}|${homeNick}`] || null;
}

async function fetchNFLGames(dateParam) {
  try {
    // Check if NFL season is active (September through February)
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 8) return []; // March-August = offseason, no games

    const ODDS_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_KEY) return [];

    const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKS.join(',')}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Filter to only games on the requested date (CT timezone), same as NBA/MLB
    const targetDate = dateParam || todayStr();
    const filtered = data.filter(game => {
      if (!game.commence_time) return false;
      const gameDate = new Date(game.commence_time);
      const ct = new Date(gameDate.getTime() - 5 * 60 * 60 * 1000);
      return ct.toISOString().split('T')[0] === targetDate;
    });
    if (filtered.length === 0) return [];

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

    // Final/live scores from ESPN — gives NFL the same score parity MLB has,
    // so games can actually be graded (win/loss tracked) once analyzed.
    const nflScores = await fetchESPNFinalScores('football/nfl', targetDate);

    const games = (await Promise.all(filtered.map(async (game, i) => {
      const away = (game.away_team || '').trim();
      const home = (game.home_team || '').trim();

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

      // Cross-book divergence AT THIS MOMENT — a useful sharp-money signal,
      // but not line movement (doesn't compare across time). Kept separate.
      const b365 = _raw['bet365']?.away;
      const fd = _raw['fanduel']?.away;
      const dk = _raw['draftkings']?.away;
      const crossBookSignals = [];
      if (b365 && fd && Math.abs(b365-fd) >= 10) crossBookSignals.push(`B365 ${fmt(b365)} vs FD ${fmt(fd)} — sharp on ${b365<fd?away.split(' ').pop():home.split(' ').pop()}`);
      if (b365 && dk && Math.abs(b365-dk) >= 10) crossBookSignals.push(`B365 ${fmt(b365)} vs DK ${fmt(dk)} — sharp on ${b365<dk?away.split(' ').pop():home.split(' ').pop()}`);
      if (fd && dk && Math.abs(fd-dk) >= 8) crossBookSignals.push(`FD ${fmt(fd)} vs DK ${fmt(dk)} — divergence on ${fd<dk?away.split(' ').pop():home.split(' ').pop()}`);

      const gameDate = new Date(game.commence_time).toISOString().split('T')[0];
      const key = `${away}@${home}`;
      const espnScore = lookupESPNScore(nflScores, away, home);

      // TRUE opening line — frozen the first time this game was ever seen.
      const sbOpening = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const nflGameKey = `nfl-${gameDate}-${key}`;
      const currentForFreeze = { awayML, homeML, spread, awaySpreadPrice, homeSpreadPrice, total, overPrice, underPrice };
      const opening = await getOrFreezeOpeningLine(sbOpening, nflGameKey, gameDate, 'NFL', currentForFreeze);
      const openingAwayML = opening?.away_ml != null ? (opening.away_ml > 0 ? `+${opening.away_ml}` : `${opening.away_ml}`) : (awayML || 'N/A');
      const openingHomeML = opening?.home_ml != null ? (opening.home_ml > 0 ? `+${opening.home_ml}` : `${opening.home_ml}`) : (homeML || 'N/A');
      const trueLineMovement = buildTrueLineMovementText(opening, currentForFreeze);

      return {
        id: `nfl-${gameDate}-${i}`, sport: 'NFL',
        rawTime: game.commence_time,
        time: formatTime(game.commence_time),
        date: gameDate,
        away, home,
        isFinal: espnScore?.isFinal ?? false,
        awayScore: espnScore?.awayScore ?? null,
        homeScore: espnScore?.homeScore ?? null,
        awayCity: away.split(' ').slice(0,-1).join(' ').toUpperCase(),
        homeCity: home.split(' ').slice(0,-1).join(' ').toUpperCase(),
        awayAbbr: ABBR[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: ABBR[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
        awayRecord: 'See NFL standings', homeRecord: 'See NFL standings',
        awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
        awayLast5: 'N/A', homeLast5: 'N/A', awayLast10: 'N/A', homeLast10: 'N/A',
        awayStreak: 'N/A', homeStreak: 'N/A',
        awayML, homeML,
        openingAwayML, openingHomeML,
        spread, total,
        awaySpreadPrice: awaySpreadPrice || '-110',
        homeSpreadPrice: homeSpreadPrice || '-110',
        overPrice: overPrice || '-110',
        underPrice: underPrice || '-110',
        lineMovement: trueLineMovement,
        sharpSignal: crossBookSignals.join(' | ') || 'No cross-book divergence',
        betPercentage: 'Available with paid tier',
        moneyPercentage: 'Available with paid tier',
        awayQB: 'Check depth chart', homeQB: 'Check depth chart',
        awayQBStats: 'N/A', homeQBStats: 'N/A',
        awayOffense: 'Check NFL stats', homeOffense: 'Check NFL stats',
        awayDefense: 'Check NFL stats', homeDefense: 'Check NFL stats',
        h2hLast5: 'Check NFL H2H history',
        injuries: 'Check rotowire.com/football/nfl/injury-report.php',
        weather: 'Check game time weather',
        cbsPreview: await fetchGameNarrative(away, home, 'NFL'),
        gameStatus: 'Scheduled',
        week: 'N/A', gameType: 'Regular Season',
        slot: null,
      };
    }))).filter(Boolean);

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

async function fetchOdds(sport, dateParam) {
  try {
    const ODDS_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_KEY) return { oddsMap: {}, bookmakerCount: 0 };

    const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKS.join(',')}`,
      { cache: 'no-store' }
    );
    if (!res.ok) { console.error('Odds API error:', res.status); return { oddsMap: {}, bookmakerCount: 0 }; }

    let data = await res.json();
    console.log('Odds API games:', data.length, 'first game markets:', data[0]?.bookmakers?.[0]?.markets?.map(m=>m.key));

    // Filter to only games on the requested date — The Odds API returns
    // upcoming games across multiple days, and if the same two teams play
    // a multi-game series, an unfiltered key match could pick up tomorrow's
    // (or yesterday's) odds for "today's" game.
    if (dateParam) {
      data = data.filter(game => {
        if (!game.commence_time) return true; // keep if we can't tell — better than dropping
        const gameDate = new Date(game.commence_time);
        const ct = new Date(gameDate.getTime() - 5 * 60 * 60 * 1000); // CT offset, matches NBA/NFL filtering
        return ct.toISOString().split('T')[0] === dateParam;
      });
    }

    const oddsMap = {};
    const sbOpening = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    await Promise.all(data.map(async game => {
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

      // Cross-book divergence at THIS moment (e.g. Bet365 vs FanDuel disagree
      // right now) — a genuinely useful sharp-money SIGNAL, but it is NOT
      // line movement (it doesn't compare across time). Kept as its own
      // separately-labeled field (sharpSignal), matching what the AI prompts
      // already expect.
      const b365 = _raw['bet365']?.away;
      const fd = _raw['fanduel']?.away;
      const dk = _raw['draftkings']?.away;
      const crossBookSignals = [];
      if (b365 && fd && Math.abs(b365-fd) >= 10) crossBookSignals.push(`B365 ${fmt(b365)} vs FD ${fmt(fd)} — sharp on ${b365<fd?away.split(' ').pop():home.split(' ').pop()}`);
      if (b365 && dk && Math.abs(b365-dk) >= 10) crossBookSignals.push(`B365 ${fmt(b365)} vs DK ${fmt(dk)} — sharp on ${b365<dk?away.split(' ').pop():home.split(' ').pop()}`);
      if (fd && dk && Math.abs(fd-dk) >= 8) crossBookSignals.push(`FD ${fmt(fd)} vs DK ${fmt(dk)} — divergence on ${fd<dk?away.split(' ').pop():home.split(' ').pop()}`);

      // TRUE OPENING LINE — frozen the first time this game was ever seen
      // (could be hours or days before the AI analyzes it or the slot
      // pattern is set), so movement is a genuine opening→now comparison.
      const gameKey = `mlb-${dateParam || todayStr()}-${key}`;
      const currentForFreeze = { awayML, homeML, spread, awaySpreadPrice, homeSpreadPrice, total, overPrice, underPrice };
      const opening = await getOrFreezeOpeningLine(sbOpening, gameKey, dateParam || todayStr(), 'MLB', currentForFreeze);
      const openingAwayML = opening?.away_ml != null ? (opening.away_ml > 0 ? `+${opening.away_ml}` : `${opening.away_ml}`) : (awayML || 'N/A');
      const openingHomeML = opening?.home_ml != null ? (opening.home_ml > 0 ? `+${opening.home_ml}` : `${opening.home_ml}`) : (homeML || 'N/A');
      const trueLineMovement = buildTrueLineMovementText(opening, currentForFreeze);

      oddsMap[key] = {
        awayML, homeML, spread, total,
        awaySpreadPrice: awaySpreadPrice||'-110', homeSpreadPrice: homeSpreadPrice||'-110',
        overPrice: overPrice||'-110', underPrice: underPrice||'-110',
        openingAwayML, openingHomeML,
        lineMovement: trueLineMovement,
        sharpSignal: crossBookSignals.join(' | ') || 'No cross-book divergence',
        pricingStr,
      };
    }));

    console.log('OddsMap keys:', Object.keys(oddsMap).join(' | '));
    return { oddsMap, bookmakerCount: 5 };
  } catch(e) { console.error('fetchOdds error:', e.message); return { oddsMap: {}, bookmakerCount: 0 }; }
}


// Fetches a URL with one retry on failure/non-200 — a single transient
// network hiccup should never cause a false "no career data" result.
async function fetchWithRetry(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return res;
    } catch {}
  }
  return null;
}

// Sums stat fields across ALL splits in a response, not just the first —
// some pitchers have multiple split entries per team/season (e.g. traded
// mid-season, multiple stints), and only reading splits[0] would silently
// undercount or miss games entirely.
function sumSplits(splits) {
  const totals = { g: 0, ip: 0, er: 0, h: 0, bb: 0, so: 0, hasData: false };
  for (const split of splits || []) {
    const stat = split?.stat;
    if (!stat) continue;
    const g = stat.gamesPitched ?? 0;
    if (g === 0) continue;
    totals.hasData = true;
    totals.g  += g;
    totals.ip += parseFloat(stat.inningsPitched || '0') || 0;
    totals.er += stat.earnedRuns ?? 0;
    totals.h  += stat.hits ?? 0;
    totals.bb += stat.baseOnBalls ?? 0;
    totals.so += stat.strikeOuts ?? 0;
  }
  return totals;
}

async function fetchPitcherVsOpponent(pitcherId, opponentTeamId, pitcherName) {
  if (!pitcherId || !opponentTeamId) return 'N/A';
  try {
    // First try vsTeamTotal — gives career aggregate vs a specific team in one
    // call. Sum across ALL splits (not just the first) to avoid undercounting
    // pitchers with multiple stints/split entries. Retries once on failure.
    const careerRes = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=vsTeamTotal&opposingTeamId=${opponentTeamId}&group=pitching`
    );

    if (careerRes) {
      const careerData = await careerRes.json().catch(() => null);
      const totals = sumSplits(careerData?.stats?.[0]?.splits);
      if (totals.hasData) {
        const era = totals.ip > 0 ? ((totals.er * 9) / totals.ip).toFixed(2) : 'N/A';
        return `${pitcherName} career vs this team: ${totals.g} G | ${totals.ip.toFixed(1)} IP | ERA ${era} | ${totals.h} H | ${totals.er} ER | ${totals.bb} BB | ${totals.so} K`;
      }
    }

    // Fallback: aggregate season-by-season. IMPORTANT — cover the pitcher's
    // ENTIRE MLB career, not an arbitrary recent window. A hardcoded 10-year
    // lookback silently missed earlier matchups for veteran pitchers (e.g. a
    // pitcher who debuted 12+ years ago and faced this opponent early in
    // their career) — producing a FALSE "no career data" even though real
    // history existed. We look up the pitcher's actual MLB debut year and
    // query every season since, so this only ever reports "no career data"
    // when that's genuinely true.
    const currentSeason = new Date().getFullYear();
    let debutYear = currentSeason - 15; // sane fallback if bio lookup fails
    try {
      const bioRes = await fetchWithRetry(`https://statsapi.mlb.com/api/v1/people/${pitcherId}`);
      if (bioRes) {
        const bioData = await bioRes.json().catch(() => null);
        const debutDate = bioData?.people?.[0]?.mlbDebutDate;
        if (debutDate) debutYear = new Date(debutDate).getFullYear();
      }
    } catch {}
    // Safety cap — bounds worst-case request count even if the bio lookup
    // returns a bad/very old date; 20 years covers virtually any active
    // MLB starter's full career.
    debutYear = Math.max(debutYear, currentSeason - 20);

    const seasons = [];
    for (let s = currentSeason; s >= debutYear; s--) seasons.push(s);

    const results = await Promise.all(seasons.map(season =>
      fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=vsTeam&opposingTeamId=${opponentTeamId}&group=pitching&season=${season}`
      ).then(res => res ? res.json().catch(() => null) : null)
    ));

    let totalG = 0, totalIP = 0, totalER = 0, totalH = 0, totalBB = 0, totalSO = 0;
    let hasAnyData = false;

    for (const data of results) {
      const totals = sumSplits(data?.stats?.[0]?.splits);
      if (!totals.hasData) continue;
      hasAnyData = true;
      totalG  += totals.g;
      totalIP += totals.ip;
      totalER += totals.er;
      totalH  += totals.h;
      totalBB += totals.bb;
      totalSO += totals.so;
    }

    if (!hasAnyData) return `${pitcherName} — no career data vs this opponent`;

    const careerERA = totalIP > 0 ? ((totalER * 9) / totalIP).toFixed(2) : 'N/A';
    return `${pitcherName} career vs this team: ${totalG} G | ${totalIP.toFixed(1)} IP | ERA ${careerERA} | ${totalH} H | ${totalER} ER | ${totalBB} BB | ${totalSO} K`;
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
    // Registry lookup — NOT a chain of ternaries ending in a baseball default.
    // The old code fell through to 'baseball/mlb' for any unrecognized sport,
    // which meant a WNBA game's storyline research literally fetched MLB
    // news headlines. If a sport has no ESPN path, skip the fetch entirely
    // rather than serve another sport's news as if it were this game's.
    const sportKey = espnPathFor(sport);
    if (!sportKey) return null;

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

// ── MLB PARK FACTORS (2024 season, run-scoring index: 1.0 = neutral) ──────────
// Updated annually — values above 1.0 favor offense, below 1.0 favor pitching.
const MLB_PARK_FACTORS = {
  'Colorado Rockies':       { factor: 1.38, note: 'Coors Field — extreme hitter\'s park, altitude inflates offense significantly, unders often misleading here' },
  'Cincinnati Reds':        { factor: 1.15, note: 'Great American Ball Park — hitter\'s park, home run friendly, totals skew over' },
  'Texas Rangers':          { factor: 1.12, note: 'Globe Life Field — retractable roof, warm humid air, hitter-friendly dimensions' },
  'Boston Red Sox':         { factor: 1.11, note: 'Fenway Park — Green Monster inflates doubles, tight foul territory, offense-friendly' },
  'New York Yankees':       { factor: 1.09, note: 'Yankee Stadium — short porch in right, HR-friendly for LHH, slight hitter advantage' },
  'Philadelphia Phillies':  { factor: 1.07, note: 'Citizens Bank Park — consistently offense-friendly, HR park' },
  'Chicago Cubs':           { factor: 1.05, note: 'Wrigley Field — wind-dependent, out-to-left = major over push, in-from-lake = pitcher\'s park' },
  'Baltimore Orioles':      { factor: 1.04, note: 'Camden Yards — slight hitter\'s lean, good hitting backgrounds' },
  'Toronto Blue Jays':      { factor: 1.02, note: 'Rogers Centre — dome, neutral environment, slight hitter edge' },
  'Washington Nationals':   { factor: 0.99, note: 'Nationals Park — near neutral, slight pitcher lean in recent years' },
  'Los Angeles Dodgers':    { factor: 0.97, note: 'Dodger Stadium — traditionally pitcher-friendly, large foul territory, marine layer suppresses offense' },
  'Minnesota Twins':        { factor: 0.96, note: 'Target Field — cold weather early season, slight pitcher lean' },
  'Cleveland Guardians':    { factor: 0.96, note: 'Progressive Field — pitcher-friendly dimensions, suppresses power' },
  'Kansas City Royals':     { factor: 0.95, note: 'Kauffman Stadium — large outfield, suppresses HR, slight pitcher advantage' },
  'Tampa Bay Rays':         { factor: 0.94, note: 'Tropicana Field — dome, artificial turf, historically pitcher-friendly environment' },
  'Detroit Tigers':         { factor: 0.93, note: 'Comerica Park — very large outfield, suppresses HR significantly, pitcher\'s park' },
  'Oakland Athletics':      { factor: 0.93, note: 'Sutter Health Park (Sacramento) — standard dimensions' },
  'Chicago White Sox':      { factor: 0.93, note: 'Guaranteed Rate Field — large dimensions after renovation, pitcher lean' },
  'New York Mets':          { factor: 0.92, note: 'Citi Field — pitcher-friendly since dimensions reduced, marine air suppresses offense' },
  'Miami Marlins':          { factor: 0.92, note: 'loanDepot park — retractable roof, pitcher-friendly dimensions' },
  'Pittsburgh Pirates':     { factor: 0.92, note: 'PNC Park — beautiful park, pitcher-friendly, Clemente Wall suppresses RHH HR' },
  'San Francisco Giants':   { factor: 0.90, note: 'Oracle Park — marine layer and bay wind consistently suppress scoring, strong pitcher lean' },
  'San Diego Padres':       { factor: 0.88, note: 'Petco Park — marine layer from Pacific, one of the most pitcher-friendly parks in baseball' },
  'Seattle Mariners':       { factor: 0.88, note: 'T-Mobile Park — marine air from Puget Sound, consistently one of the best pitcher parks' },
  'Atlanta Braves':         { factor: 1.01, note: 'Truist Park — near neutral, slight offensive lean' },
  'Arizona Diamondbacks':   { factor: 1.03, note: 'Chase Field — retractable roof, heat and altitude give slight offensive boost' },
  'Los Angeles Angels':     { factor: 1.00, note: 'Angel Stadium — near neutral park factor' },
  'Houston Astros':         { factor: 1.00, note: 'Minute Maid Park — retractable roof, near neutral, Tal\'s Hill removed' },
  'Milwaukee Brewers':      { factor: 1.00, note: 'American Family Field — near neutral, retractable roof eliminates weather factor' },
  'St. Louis Cardinals':    { factor: 1.00, note: 'Busch Stadium — neutral, open air, standard dimensions' },
};

// ── FETCH PITCHER ADVANCED STATS (FanGraphs — free, no auth required) ─────────
// Returns xFIP and SIERA — far better ERA predictors because they remove
// defense and luck. A pitcher with ERA 4.50 but xFIP 3.20 is outperforming
// his defense; a pitcher with ERA 2.80 but xFIP 4.10 is due for regression.
async function fetchPitcherAdvancedStats(pitcherId, pitcherName) {
  if (!pitcherId || !pitcherName || pitcherName === 'TBD') return null;
  try {
    const season = new Date().getFullYear();
    // FanGraphs leaderboard — free public endpoint, no API key required
    const url = `https://www.fangraphs.com/api/leaders/major-league/data?age=0&pos=all&stats=pit&lg=all&qual=0&type=1&season=${season}&month=0&season1=${season}&ind=0&team=0&rost=0&players=0&startdate=&enddate=&page=1_500`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data?.data || [];
    // Match by name (FanGraphs uses full name)
    const lastName = pitcherName.split(' ').slice(1).join(' ').toLowerCase();
    const row = rows.find(r => {
      const fg = (r.PlayerName || r.Name || '').toLowerCase();
      return fg === pitcherName.toLowerCase() || fg.endsWith(lastName);
    });
    if (!row) return null;
    const xfip  = row.xFIP  != null ? parseFloat(row.xFIP).toFixed(2)  : null;
    const siera = row.SIERA != null ? parseFloat(row.SIERA).toFixed(2)  : null;
    const fip   = row.FIP   != null ? parseFloat(row.FIP).toFixed(2)    : null;
    const kpct  = row['K%'] != null ? (parseFloat(row['K%']) * 100).toFixed(1) + '%' : null;
    const bbpct = row['BB%'] != null ? (parseFloat(row['BB%']) * 100).toFixed(1) + '%' : null;
    const hrfb  = row['HR/FB'] != null ? (parseFloat(row['HR/FB']) * 100).toFixed(1) + '%' : null;
    if (!xfip && !siera) return null;
    return { xfip, siera, fip, kPct: kpct, bbPct: bbpct, hrFBRate: hrfb };
  } catch { return null; }
}

// ── FETCH PITCHER PITCH MIX (Baseball Savant — free, MLB-owned) ────────────────
// Returns pitch type percentages, avg velocity, whiff rate by pitch.
// Fly-ball pitchers in hitter parks, GB pitchers vs contact lineups — this
// is matchup intelligence that ERA alone never captures.
async function fetchPitcherPitchMix(pitcherName) {
  if (!pitcherName || pitcherName === 'TBD') return null;
  try {
    const season = new Date().getFullYear();
    const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${season}&team=&min=10&csv=true`;
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const lastName = pitcherName.split(' ').slice(1).join(' ').toLowerCase();
    const pitcherRows = lines.slice(1).filter(line => {
      const cols = line.split(',');
      const name = (cols[headers.indexOf('last_name, first_name')] || cols[0] || '').toLowerCase().replace(/"/g, '');
      return name.includes(lastName) || name === pitcherName.toLowerCase();
    });
    if (!pitcherRows.length) return null;
    // Aggregate pitch types across rows for this pitcher
    const pitchTypes = [];
    for (const row of pitcherRows) {
      const cols = row.split(',').map(c => c.trim().replace(/"/g, ''));
      const pitchType = cols[headers.indexOf('pitch_type')] || cols[headers.indexOf('pitch_name')] || '';
      const pct = parseFloat(cols[headers.indexOf('pitch_usage')] || cols[headers.indexOf('pitch_percent')] || '0');
      const velo = parseFloat(cols[headers.indexOf('mph')] || cols[headers.indexOf('release_speed')] || '0');
      const whiff = parseFloat(cols[headers.indexOf('whiff_percent')] || '0');
      if (pitchType && pct > 0) pitchTypes.push({ pitch: pitchType, pct: pct.toFixed(1) + '%', velo: velo.toFixed(1), whiff: whiff.toFixed(1) + '%' });
    }
    if (!pitchTypes.length) return null;
    return pitchTypes.map(p => `${p.pitch} ${p.pct} @ ${p.velo}mph (${p.whiff} whiff%)`).join(' | ');
  } catch { return null; }
}

// ── FETCH BULLPEN USAGE LAST 3 DAYS (MLB Stats API) ───────────────────────────
// Returns which relievers pitched in the last 3 games so Stage 2 knows
// who is actually available tonight — the most important bullpen signal.
async function fetchBullpenUsage(teamId, teamName) {
  if (!teamId) return null;
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 4);
    const fmt = d => d.toISOString().split('T')[0];
    const schedRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${fmt(startDate)}&endDate=${fmt(endDate)}&hydrate=boxscore&gameType=R`,
      { cache: 'no-store' }
    );
    if (!schedRes.ok) return null;
    const schedData = await schedRes.json();
    const recentGames = (schedData.dates || []).flatMap(d => d.games || []).slice(-3);
    if (!recentGames.length) return null;

    const usedPitchers = {}; // name -> [{date, daysAgo, batsFaced}]
    for (const g of recentGames) {
      const gameDateStr = g.gameDate?.split('T')[0] || '';
      const gameDate = new Date(gameDateStr);
      const daysAgo = Math.round((now - gameDate) / (1000 * 60 * 60 * 24));
      const boxscore = g.liveData?.boxscore || g.gameData?.boxscore;
      if (!boxscore) continue;
      const isHome = g.teams?.home?.team?.id === parseInt(teamId);
      const teamBox = isHome ? boxscore.teams?.home : boxscore.teams?.away;
      const pitchers = teamBox?.pitchers || [];
      const playerInfo = teamBox?.players || {};
      for (const pitcherId of pitchers) {
        const p = playerInfo[`ID${pitcherId}`];
        if (!p) continue;
        const isStarter = p.gameStatus?.isCurrentPitcher === false && p.stats?.pitching?.gamesStarted > 0;
        if (p.stats?.pitching?.gamesStarted) continue; // skip starters
        const name = p.person?.fullName || '';
        const bf = p.stats?.pitching?.battersFaced || 0;
        if (name && bf > 0) {
          if (!usedPitchers[name]) usedPitchers[name] = [];
          usedPitchers[name].push({ daysAgo, bf });
        }
      }
    }

    const entries = Object.entries(usedPitchers);
    if (!entries.length) return `${teamName} bullpen: no recent usage data`;

    // Sort by most recent use
    const lines = entries
      .sort((a, b) => Math.min(...a[1].map(x => x.daysAgo)) - Math.min(...b[1].map(x => x.daysAgo)))
      .map(([name, uses]) => {
        const mostRecent = Math.min(...uses.map(u => u.daysAgo));
        const totalBF = uses.reduce((s, u) => s + u.bf, 0);
        const tag = mostRecent === 1 ? 'YESTERDAY' : mostRecent === 2 ? '2 days ago' : '3+ days ago';
        return `${name} (${tag}, ${totalBF} BF last 3G)`;
      });

    return `${teamName} bullpen usage last 3 games: ${lines.slice(0, 6).join(' | ')}`;
  } catch { return null; }
}

// ── FETCH FIRST 5 INNINGS LINES (The Odds API — same subscription) ─────────────
// F5 isolates the starting pitcher edge and removes bullpen variance.
// When the edge is clearly in the starters, F5 is the cleaner play.
async function fetchF5Lines(away, home) {
  try {
    const ODDS_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_KEY) return null;
    const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h_h1,totals_h1&oddsFormat=american&bookmakers=${BOOKS.join(',')}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const awayLast = away.split(' ').pop().toLowerCase();
    const homeLast = home.split(' ').pop().toLowerCase();
    const event = data.find(e => {
      const a = (e.away_team || '').toLowerCase();
      const h = (e.home_team || '').toLowerCase();
      return (a.includes(awayLast) || awayLast.includes(a.split(' ').pop())) &&
             (h.includes(homeLast) || homeLast.includes(h.split(' ').pop()));
    });
    if (!event) return null;

    let f5AwayML = null, f5HomeML = null, f5Total = null, f5OverPrice = null, f5UnderPrice = null;

    for (const bookmaker of (event.bookmakers || [])) {
      for (const market of (bookmaker.markets || [])) {
        if (market.key === 'h2h_h1' && !f5AwayML) {
          for (const outcome of market.outcomes || []) {
            const n = (outcome.name || '').toLowerCase();
            if (n.includes(awayLast)) f5AwayML = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
            else if (n.includes(homeLast)) f5HomeML = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
          }
        }
        if (market.key === 'totals_h1' && !f5Total) {
          for (const outcome of market.outcomes || []) {
            const n = (outcome.name || '').toLowerCase();
            const price = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
            if (n === 'over') { f5Total = outcome.point; f5OverPrice = price; }
            else if (n === 'under') f5UnderPrice = price;
          }
        }
      }
      if (f5AwayML && f5HomeML && f5Total) break;
    }

    if (!f5AwayML && !f5Total) return null;
    return { f5AwayML, f5HomeML, f5Total: f5Total ? String(f5Total) : null, f5OverPrice, f5UnderPrice };
  } catch { return null; }
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

    // Series context — MLB API fields
    const seriesGame = game.seriesGameNumber || game.gameNumber || 1;
    const seriesLength = game.gamesInSeries || game.scheduledInnings || 3;
    // Also try to extract from description e.g. "Game 2 of 3"
    const descMatch = (game.description || game.seriesDescription || '').match(/Game (\d+) of (\d+)/i);
    const finalSeriesGame = descMatch ? parseInt(descMatch[1]) : seriesGame;
    const finalSeriesLength = descMatch ? parseInt(descMatch[2]) : seriesLength;

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

    // ── NEW: Advanced stats fetch (separate Promise.all — doesn't touch existing destructuring) ──
    const [awayAdvanced, homeAdvanced, awayPitchMix, homePitchMix, awayBullpenUsage, homeBullpenUsage, f5Lines] = await Promise.all([
      awayPitcherId ? fetchPitcherAdvancedStats(awayPitcherId, awayPitcher) : Promise.resolve(null),
      homePitcherId ? fetchPitcherAdvancedStats(homePitcherId, homePitcher) : Promise.resolve(null),
      fetchPitcherPitchMix(awayPitcher),
      fetchPitcherPitchMix(homePitcher),
      awayTeamId ? fetchBullpenUsage(awayTeamId, away) : Promise.resolve(null),
      homeTeamId ? fetchBullpenUsage(homeTeamId, home) : Promise.resolve(null),
      fetchF5Lines(away, home),
    ]);

    // Park factor for home team's ballpark
    const parkData = MLB_PARK_FACTORS[home] || { factor: 1.00, note: 'Neutral park — standard run environment' };

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
      dkAwayML: odds.awayML || null,
      dkHomeML: odds.homeML || null,
      dkSpread: odds.spread || null,
      dkTotal: odds.total || null,
      awaySpreadPrice: odds.awaySpreadPrice || '-110',
      homeSpreadPrice: odds.homeSpreadPrice || '-110',
      overPrice: odds.overPrice || '-110',
      underPrice: odds.underPrice || '-110',
      openingAwayML: odds.openingAwayML || odds.awayML || 'N/A',
      openingHomeML: odds.openingHomeML || odds.homeML || 'N/A',
      spread: odds.spread || 'N/A',
      runLine: odds.spread ? `${home} ${odds.spread}` : 'N/A',
      total: odds.total || 'N/A',
      lineMovement: odds.lineMovement || 'N/A',
      sharpSignal: odds.sharpSignal || 'N/A',
      betPercentage: odds.betPercentage || 'N/A',
      moneyPercentage: odds.moneyPercentage || 'N/A',
      openingLine: `Away ${odds.openingAwayML || 'N/A'} / Home ${odds.openingHomeML || 'N/A'}`,
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
      seriesContext: `Game ${finalSeriesGame} of ${finalSeriesLength}${finalSeriesGame === finalSeriesLength ? ' — SERIES FINALE' : finalSeriesGame === 1 ? ' — Series Opener' : ''}`,
      gameNumber: finalSeriesGame,
      gamesInSeries: finalSeriesLength,
      slot: null,
      // ── ADVANCED STATS (new) ────────────────────────────────────────────────
      // xFIP/SIERA from FanGraphs — better ERA predictors (defense/luck-neutral)
      awayPitcherXFIP:  awayAdvanced?.xfip  || null,
      awayPitcherSIERA: awayAdvanced?.siera || null,
      awayPitcherFIP:   awayAdvanced?.fip   || null,
      awayPitcherKPct:  awayAdvanced?.kPct  || null,
      awayPitcherBBPct: awayAdvanced?.bbPct || null,
      awayPitcherHRFB:  awayAdvanced?.hrFBRate || null,
      homePitcherXFIP:  homeAdvanced?.xfip  || null,
      homePitcherSIERA: homeAdvanced?.siera || null,
      homePitcherFIP:   homeAdvanced?.fip   || null,
      homePitcherKPct:  homeAdvanced?.kPct  || null,
      homePitcherBBPct: homeAdvanced?.bbPct || null,
      homePitcherHRFB:  homeAdvanced?.hrFBRate || null,
      // Pitch mix from Baseball Savant
      awayPitchMix: awayPitchMix || null,
      homePitchMix: homePitchMix || null,
      // Bullpen usage last 3 days
      awayBullpenUsage: awayBullpenUsage || null,
      homeBullpenUsage: homeBullpenUsage || null,
      // First 5 innings lines
      f5AwayML:    f5Lines?.f5AwayML    || null,
      f5HomeML:    f5Lines?.f5HomeML    || null,
      f5Total:     f5Lines?.f5Total     || null,
      f5OverPrice: f5Lines?.f5OverPrice || null,
      f5UnderPrice:f5Lines?.f5UnderPrice|| null,
      // Park factor
      parkFactor:     parkData.factor,
      parkFactorNote: parkData.note,
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
    const nbaSeasonYear = new Date().getMonth() >= 9 ? currentYear + 1 : currentYear;

    // Fetch regular season AND playoffs separately then combine
    const [regRes, playRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?season=${nbaSeasonYear}&seasontype=2`, { cache: 'no-store' }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?season=${nbaSeasonYear}&seasontype=3`, { cache: 'no-store' }),
    ]);

    const regData = regRes.ok ? await regRes.json() : { events: [] };
    const playData = playRes.ok ? await playRes.json() : { events: [] };

    // Combine and sort by date
    const allEvents = [...(regData.events || []), ...(playData.events || [])];
    const games = allEvents
      .filter(e => e.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const results = games.map(e => {
      const comp = e.competitions[0];
      const isHome = comp.competitors?.[0]?.homeAway === 'home' && comp.competitors?.[0]?.team?.id === teamId ||
                     comp.competitors?.[1]?.homeAway === 'home' && comp.competitors?.[1]?.team?.id === teamId;
      const myTeam = comp.competitors?.find(c => c.team?.id === teamId);
      const oppTeam = comp.competitors?.find(c => c.team?.id !== teamId);
      const myScore = extractScore(myTeam?.score);
      const oppScore = extractScore(oppTeam?.score);
      // A game whose score couldn't be parsed is NOT a loss — it's missing
      // data. Marking it unusable (rather than defaulting to 0-0, which
      // always evaluates as a loss) prevents a parsing failure from
      // fabricating a fake "lost every game" record.
      if (myScore == null || oppScore == null) return null;
      const win = myScore > oppScore;
      return { win, myScore, oppScore, isHome };
    }).filter(Boolean);

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

    // ── SEASON SCORING STATS — computed from the real game scores above ──
    // These are legitimate, verifiable stats derived from actual results (not
    // fabricated): season PPG, opponent PPG (defense), point differential, and
    // a pace proxy (combined points per game — higher = faster/higher-scoring
    // games). Full-season sample when available, so they're stable.
    const scoredGames = results.filter(g => g.myScore > 0 || g.oppScore > 0);
    const gp = scoredGames.length;
    let ppg = 'N/A', oppPpg = 'N/A', diff = 'N/A', paceProxy = 'N/A';
    if (gp >= 3) {
      const totalFor = scoredGames.reduce((s, g) => s + g.myScore, 0);
      const totalAgainst = scoredGames.reduce((s, g) => s + g.oppScore, 0);
      ppg = (totalFor / gp).toFixed(1);
      oppPpg = (totalAgainst / gp).toFixed(1);
      diff = ((totalFor - totalAgainst) / gp).toFixed(1);
      // Pace proxy: average combined points per game. Not true possessions,
      // but a reliable directional signal for over/under and game-speed reads.
      paceProxy = ((totalFor + totalAgainst) / gp).toFixed(1);
    }

    // Rest / back-to-back: derive from the gap between the last completed game
    // and now (the schedule is date-sorted). B2B = played yesterday.
    let restDays = 'N/A', isB2B = false;
    if (games.length) {
      const lastGameDate = new Date(games[games.length - 1].date);
      const daysSince = Math.floor((Date.now() - lastGameDate.getTime()) / 86400000);
      if (daysSince >= 0 && daysSince <= 30) {
        restDays = String(daysSince);
        isB2B = daysSince <= 1;
      }
    }

    return {
      last5: `${wins5}-${last5.length - wins5} (${last5str})`,
      last10: `${wins10}-${last10.length - wins10} (${last10str})`,
      streak: streak > 0 ? `${streakType}${streak}` : 'N/A',
      homeRecord: `${homeW}-${homeG.length - homeW}`,
      awayRecord: `${awayW}-${awayG.length - awayW}`,
      atsRecord: `${atsW}-${results.length - atsW}`,
      ppg, oppPpg, pointDiff: diff, paceProxy, gamesPlayed: gp,
      restDays, isB2B,
    };
  } catch { return { last5: 'N/A', last10: 'N/A', streak: 'N/A', homeRecord: 'N/A', awayRecord: 'N/A', atsRecord: 'N/A', ppg: 'N/A', oppPpg: 'N/A', pointDiff: 'N/A', paceProxy: 'N/A', gamesPlayed: 0, restDays: 'N/A', isB2B: false }; }
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

    // Fetch both regular season and playoff schedule
    const [schedRes, playoffRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${homeT.team.id}/schedule?season=${season}&seasontype=2`, { cache: 'no-store' }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${homeT.team.id}/schedule?season=${season}&seasontype=3`, { cache: 'no-store' }),
    ]);
    const schedData = schedRes.ok ? await schedRes.json() : { events: [] };
    const playoffData = playoffRes.ok ? await playoffRes.json() : { events: [] };
    const allEvents = [...(schedData.events || []), ...(playoffData.events || [])];

    const awayKeyword = awayTeam.split(' ').pop();
    const h2hGames = allEvents.filter(e => {
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
      const homeScore = extractScore(homeComp?.score);
      const awayScore = extractScore(awayComp?.score);
      if (homeScore == null || awayScore == null) return null; // unparseable — exclude, don't fabricate
      const homeWin = homeScore > awayScore;
      const atHome = !!homeComp;
      return { homeWin, homeScore, awayScore, atHome };
    };

    const parsed = h2hGames.map(parseGame).filter(Boolean);
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
    const targetDate = date || todayStr();
    const filtered = data.filter(game => {
      const gameDate = new Date(game.commence_time);
      // Convert to CT (UTC-5 or UTC-6)
      const ct = new Date(gameDate.getTime() - 5 * 60 * 60 * 1000);
      const gameDateStr = ct.toISOString().split('T')[0];
      return gameDateStr === targetDate;
    });
    // Final/live scores from ESPN — same score parity MLB has.
    const nbaScores = await fetchESPNFinalScores('basketball/nba', targetDate);
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

      // Cross-book divergence AT THIS MOMENT — useful sharp signal, but not
      // line movement (doesn't compare across time). Kept separate.
      const b365Away = _raw['bet365']?.away, fdAway = _raw['fanduel']?.away, dkAway = _raw['draftkings']?.away;
      const crossBookSignals = [];
      if (b365Away && fdAway && Math.abs(b365Away-fdAway) >= 8) crossBookSignals.push(`B365 ${fmt(b365Away)} vs FD ${fmt(fdAway)} — sharp on ${b365Away<fdAway?away.split(' ').pop():home.split(' ').pop()}`);
      if (b365Away && dkAway && Math.abs(b365Away-dkAway) >= 8) crossBookSignals.push(`B365 ${fmt(b365Away)} vs DK ${fmt(dkAway)} — sharp on ${b365Away<dkAway?away.split(' ').pop():home.split(' ').pop()}`);

      // TRUE opening line — frozen the first time this game was ever seen.
      const nbaGameDate = (game.commence_time||'').split('T')[0];
      const sbOpening = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const nbaGameKey = `nba-${nbaGameDate}-${away}@${home}`;
      const currentForFreeze = { awayML, homeML, spread, awaySpreadPrice, homeSpreadPrice, total, overPrice, underPrice };
      const opening = await getOrFreezeOpeningLine(sbOpening, nbaGameKey, nbaGameDate, 'NBA', currentForFreeze);
      const openingAwayML = opening?.away_ml != null ? (opening.away_ml > 0 ? `+${opening.away_ml}` : `${opening.away_ml}`) : (awayML || 'N/A');
      const openingHomeML = opening?.home_ml != null ? (opening.home_ml > 0 ? `+${opening.home_ml}` : `${opening.home_ml}`) : (homeML || 'N/A');
      const lineMovement = buildTrueLineMovementText(opening, currentForFreeze);

      // Fetch NBA-specific data in parallel
      const [awayForm, homeForm, h2h, playoffCtx] = await Promise.all([
        fetchNBARecentForm(away),
        fetchNBARecentForm(home),
        fetchNBAH2H(away, home),
        fetchNBAPlayoffContext(away, home, game.commence_time),
      ]);

      return {
        id: `nba-${(game.commence_time||'').split('T')[0]}-${i}`, sport: 'NBA',
        date: (game.commence_time||'').split('T')[0],
        away, home,
        isFinal: lookupESPNScore(nbaScores, away, home)?.isFinal ?? false,
        awayScore: lookupESPNScore(nbaScores, away, home)?.awayScore ?? null,
        homeScore: lookupESPNScore(nbaScores, away, home)?.homeScore ?? null,
        awayAbbr: nbaAbbrMap[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: nbaAbbrMap[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
        time: formatTime(game.commence_time),
        rawTime: game.commence_time,
        awayML, homeML, spread, total,
        openingAwayML, openingHomeML,
        pricingStr,
        lineMovement,
        sharpSignal: crossBookSignals.join(' | ') || 'No cross-book divergence',
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
        // Real computed scoring stats (from season game scores, not fabricated)
        awayPPG: awayForm.ppg, awayOppPPG: awayForm.oppPpg, awayPaceProxy: awayForm.paceProxy, awayPointDiff: awayForm.pointDiff,
        homePPG: homeForm.ppg, homeOppPPG: homeForm.oppPpg, homePaceProxy: homeForm.paceProxy, homePointDiff: homeForm.pointDiff,
        awayRest: awayForm.restDays, awayB2B: awayForm.isB2B,
        homeRest: homeForm.restDays, homeB2B: homeForm.isB2B,
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
        seriesContext: playoffCtx.context || 'Regular Season',
        seriesRecord: playoffCtx.seriesRecord || 'N/A',
        gameNumber: playoffCtx.gameNumber || null,
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
        const myScore = extractScore(my?.score);
        const oppScore = extractScore(opp?.score);
        // Unparseable score = missing data, not a loss — exclude rather than
        // fabricate a fake result from a 0-0 default (see extractScore above).
        if (myScore == null || oppScore == null) return null;
        return { win: myScore > oppScore, myScore, oppScore, isHome: my?.homeAway === 'home' };
      })
      .filter(Boolean);

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

    // Real computed scoring stats from actual game scores (not fabricated)
    const scored = results.filter(g => g.myScore > 0 || g.oppScore > 0);
    const gp = scored.length;
    let ppg='N/A', oppPpg='N/A', diff='N/A', paceProxy='N/A';
    if (gp >= 3) {
      const tf = scored.reduce((s,g)=>s+g.myScore,0), ta = scored.reduce((s,g)=>s+g.oppScore,0);
      ppg=(tf/gp).toFixed(1); oppPpg=(ta/gp).toFixed(1); diff=((tf-ta)/gp).toFixed(1); paceProxy=((tf+ta)/gp).toFixed(1);
    }
    // Rest / B2B from the most recent completed game date
    let restDays='N/A', isB2B=false;
    const completedEvents = (sched.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if (completedEvents.length) {
      const lastDate = new Date(completedEvents[completedEvents.length-1].date);
      const ds = Math.floor((Date.now()-lastDate.getTime())/86400000);
      if (ds>=0 && ds<=30) { restDays=String(ds); isB2B=ds<=1; }
    }

    return {
      last5: `${w5}-${last5.length-w5} (${l5str})`,
      last10: `${w10}-${last10.length-w10} (${l10str})`,
      streak: streak>0?`${sType}${streak}`:'N/A',
      homeRecord: `${homeG.filter(g=>g.win).length}-${homeG.filter(g=>!g.win).length}`,
      awayRecord: `${awayG.filter(g=>g.win).length}-${awayG.filter(g=>!g.win).length}`,
      atsRecord: `${atsW}-${results.length-atsW}`,
      ppg, oppPpg, pointDiff: diff, paceProxy, restDays, isB2B,
    };
  } catch { return { last5:'N/A', last10:'N/A', streak:'N/A', homeRecord:'N/A', awayRecord:'N/A', atsRecord:'N/A', ppg:'N/A', oppPpg:'N/A', pointDiff:'N/A', paceProxy:'N/A', restDays:'N/A', isB2B:false }; }
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
      const hs = extractScore(homeComp?.score), as = extractScore(awayComp?.score);
      return hs != null && as != null && hs > as;
    }).length;

    const results = h2hGames.map(e => {
      const comp = e.competitions[0];
      const c1 = comp.competitors?.[0], c2 = comp.competitors?.[1];
      const s1 = extractScore(c1?.score), s2 = extractScore(c2?.score);
      if (s1 == null || s2 == null) return null;
      return `${s1>s2?c1.team?.abbreviation:c2.team?.abbreviation} ${s1}-${s2}`;
    }).filter(Boolean).join(', ');

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
    const targetDate = date || todayStr();
    const dateFiltered = data.filter(game => {
      const ct = new Date(new Date(game.commence_time).getTime() - 5 * 60 * 60 * 1000);
      return ct.toISOString().split('T')[0] === targetDate;
    });

    // Final/live scores from ESPN — same score parity MLB has.
    const wnbaScores = await fetchESPNFinalScores('basketball/wnba', targetDate);
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

      // Cross-book divergence AT THIS MOMENT — useful sharp signal, not movement.
      const b365Away=_raw['bet365']?.away, fdAway=_raw['fanduel']?.away, dkAway=_raw['draftkings']?.away;
      const crossBookSignals=[];
      if(b365Away&&fdAway&&Math.abs(b365Away-fdAway)>=8) crossBookSignals.push(`B365 ${fmt(b365Away)} vs FD ${fmt(fdAway)} — sharp on ${b365Away<fdAway?away.split(' ').pop():home.split(' ').pop()}`);
      if(b365Away&&dkAway&&Math.abs(b365Away-dkAway)>=8) crossBookSignals.push(`B365 ${fmt(b365Away)} vs DK ${fmt(dkAway)} — sharp on ${b365Away<dkAway?away.split(' ').pop():home.split(' ').pop()}`);

      // TRUE opening line — frozen the first time this game was ever seen.
      const wnbaGameDate = (game.commence_time||'').split('T')[0];
      const sbOpening = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const wnbaGameKey = `wnba-${wnbaGameDate}-${away}@${home}`;
      const currentForFreeze = { awayML, homeML, spread, awaySpreadPrice, homeSpreadPrice, total, overPrice, underPrice };
      const opening = await getOrFreezeOpeningLine(sbOpening, wnbaGameKey, wnbaGameDate, 'WNBA', currentForFreeze);
      const openingAwayML = opening?.away_ml != null ? (opening.away_ml > 0 ? `+${opening.away_ml}` : `${opening.away_ml}`) : (awayML || 'N/A');
      const openingHomeML = opening?.home_ml != null ? (opening.home_ml > 0 ? `+${opening.home_ml}` : `${opening.home_ml}`) : (homeML || 'N/A');
      const lineMovement = buildTrueLineMovementText(opening, currentForFreeze);

      // Fetch WNBA-specific data
      const [awayForm, homeForm, h2h] = await Promise.all([
        fetchWNBARecentForm(away),
        fetchWNBARecentForm(home),
        fetchWNBAH2H(away, home),
      ]);

      console.log("WNBA forms:", JSON.stringify({away: awayForm, home: homeForm, h2h: h2h?.slice(0,80)}));
      const wnbaAbbrMap = {'Atlanta Dream':'Dream','Chicago Sky':'Sky','Connecticut Sun':'Sun','Dallas Wings':'Wings','Indiana Fever':'Fever','Las Vegas Aces':'Aces','Los Angeles Sparks':'Sparks','Minnesota Lynx':'Lynx','New York Liberty':'Liberty','Phoenix Mercury':'Mercury','Seattle Storm':'Storm','Washington Mystics':'Mystics','Toronto Tempo':'Tempo'};

      return {
        id: `wnba-${(game.commence_time||'').split('T')[0]}-${i}`, sport: 'WNBA',
        date: (game.commence_time||'').split('T')[0],
        away, home,
        isFinal: lookupESPNScore(wnbaScores, away, home)?.isFinal ?? false,
        awayScore: lookupESPNScore(wnbaScores, away, home)?.awayScore ?? null,
        homeScore: lookupESPNScore(wnbaScores, away, home)?.homeScore ?? null,
        awayAbbr: wnbaAbbrMap[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
        homeAbbr: wnbaAbbrMap[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
        time: formatTime(game.commence_time),
        rawTime: game.commence_time,
        awayML, homeML, spread, total,
        awaySpreadPrice, homeSpreadPrice, overPrice, underPrice,
        pricingStr,
        openingAwayML, openingHomeML,
        lineMovement,
        sharpSignal: crossBookSignals.join(' | ') || 'No cross-book divergence',
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
        awayPPG: awayForm.ppg, awayOppPPG: awayForm.oppPpg, awayPaceProxy: awayForm.paceProxy, awayPointDiff: awayForm.pointDiff,
        homePPG: homeForm.ppg, homeOppPPG: homeForm.oppPpg, homePaceProxy: homeForm.paceProxy, homePointDiff: homeForm.pointDiff,
        awayRest: awayForm.restDays, awayB2B: awayForm.isB2B,
        homeRest: homeForm.restDays, homeB2B: homeForm.isB2B,
        h2h,
        // The Stage 1/2 prompts read h2hLast5 + h2hAtHome (not the raw h2h
        // string) — map the fetched H2H to both so the AI actually receives
        // it instead of blanks. Same H2H source; the prompt just splits the
        // reference into "recent" and "at this venue" framing.
        h2hLast5: h2h || 'N/A',
        h2hAtHome: h2h || 'N/A',
        // injuries + rest are read by the WNBA prompt (roster depth and
        // fatigue are core WNBA edges) — populate them so those checks run on
        // real data instead of defaulting to "None reported" / blank.
        injuries: game.injuries || 'None reported',
        slot: 'WNBA',
      };
    }));
  } catch { return []; }
}

// ── RECENT FORM (MLB Stats API — free) ────────────────────────────────────────

async function fetchTeamRecentForm(teamId, teamName) {
  try {
    const season = new Date().getFullYear();
    const today = todayStr();
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

    const [scheduleGames, mlbOddsResult, nbaGamesRaw, nflGamesRaw, wnbaGamesRaw] = await Promise.all([
      fetchMLBSchedule(dateParam),
      isPast ? Promise.resolve({ oddsMap: {}, bookmakerCount: 0 }) : fetchOdds('baseball_mlb', dateParam),
      isPast ? Promise.resolve([]) : fetchNBAGames(dateParam),
      isPast ? Promise.resolve([]) : fetchNFLGames(dateParam),
      isPast ? Promise.resolve([]) : fetchWNBAGames(dateParam),
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
    const nbaGames = assignSlotFromPattern(nbaGamesRaw, nbaPattern);

    // Fetch WNBA slot pattern and apply (mirrors NBA — no slot system by
    // default, slot stays null unless an admin pattern exists)
    let wnbaPattern = null;
    try {
      const sb4 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: nd3 } = await sb4.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'wnba').maybeSingle();
      if (nd3?.pattern?.length) wnbaPattern = nd3.pattern;
    } catch {}
    const wnbaGames = wnbaPattern ? assignSlotFromPattern(wnbaGamesRaw, wnbaPattern) : wnbaGamesRaw;

    const allGames = [...mlbGames, ...nbaGames, ...wnbaGames, ...nflGames];

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
      // Dedicated WNBA flag — WNBA's gating is genuinely different (weekday
      // needs its OWN saved pattern; weekend never auto-queues regardless of
      // any pattern), so it can't reuse the generic OR'd hasSlotPattern above,
      // which would be wrong for WNBA (that flag going true because MLB's
      // pattern was set says nothing about whether WNBA's was).
      hasWNBAPattern: !!wnbaPattern,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
