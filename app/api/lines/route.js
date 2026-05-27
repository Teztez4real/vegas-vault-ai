/**
 * /api/lines
 * 
 * Called by the frontend every 5 minutes to get fresh line movement data.
 * Returns enriched movement per game — opening vs current with full history.
 * 
 * GET /api/lines?date=YYYY-MM-DD&sport=mlb
 */

import { NextResponse } from 'next/server';
import { trackLines } from '@/lib/lineTracker';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmt(price) {
  return price != null ? (price > 0 ? `+${price}` : `${price}`) : 'N/A';
}

// ── FETCH CURRENT ODDS (same SharpAPI logic as today/route.js) ─────────────

async function fetchCurrentOdds(sportKey) {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (sharpKey) {
    try {
      const leagueMap = {
        'baseball_mlb': 'mlb',
        'basketball_nba': 'nba',
        'americanfootball_nfl': 'nfl',
      };
      const league = leagueMap[sportKey];
      if (!league) return [];

      const [mlRes, rlRes] = await Promise.all([
        fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&market=moneyline`, {
          headers: { 'X-API-Key': sharpKey }, cache: 'no-store',
        }),
        league === 'mlb'
          ? fetch(`https://api.sharpapi.io/api/v1/odds?league=${league}&market=run_line`, {
              headers: { 'X-API-Key': sharpKey }, cache: 'no-store',
            })
          : Promise.resolve({ json: async () => ({ data: [] }) }),
      ]);

      const mlRows = (await mlRes.json()).data || [];
      const rlRows = (await rlRes.json()).data || [];
      const allRows = [...mlRows, ...rlRows];
      if (!allRows.length) throw new Error('No rows');

      // Group by event
      const eventMap = {};
      const preferredBooks = ['draftkings', 'fanduel', 'betmgm', 'pinnacle', 'caesars'];

      for (const row of allRows) {
        const home = row.home_team;
        const away = row.away_team;
        if (!home || !away) continue;
        const key = `${away}|${home}`;
        if (!eventMap[key]) eventMap[key] = { home, away, commenceTime: row.event_start_time, books: {} };
        const book = (row.sportsbook || '').toLowerCase();
        if (!eventMap[key].books[book]) eventMap[key].books[book] = {};
        const mt = (row.market_type || '').toLowerCase();
        const sel = row.selection || '';
        const odds = row.odds_american;
        const line = row.line;
        const homeWord = home.split(' ').pop().toLowerCase();
        const isHome = sel.toLowerCase().includes(homeWord) || sel === home;

        if (mt === 'moneyline') {
          if (!eventMap[key].books[book].h2h) eventMap[key].books[book].h2h = {};
          if (isHome) eventMap[key].books[book].h2h.homeML = odds;
          else eventMap[key].books[book].h2h.awayML = odds;
        } else if (mt === 'run_line' || mt.includes('spread')) {
          if (!eventMap[key].books[book].spread) eventMap[key].books[book].spread = {};
          if (isHome) { eventMap[key].books[book].spread.homePoint = line; eventMap[key].books[book].spread.homeOdds = odds; }
          else { eventMap[key].books[book].spread.awayPoint = line; eventMap[key].books[book].spread.awayOdds = odds; }
        }
      }

      return Object.entries(eventMap).map(([key, event]) => {
        // Pick best book
        let bookData = null;
        for (const preferred of preferredBooks) {
          const found = Object.entries(event.books).find(([b]) => b.includes(preferred));
          if (found?.[1]?.h2h) { bookData = found[1]; break; }
        }
        if (!bookData) bookData = Object.values(event.books).find(b => b.h2h);
        if (!bookData?.h2h) return null;

        return {
          key,
          away: event.away,
          home: event.home,
          homeML: fmt(bookData.h2h.homeML),
          awayML: fmt(bookData.h2h.awayML),
          homeRL: bookData.spread?.homePoint,
          awayRL: bookData.spread?.awayPoint,
          commenceTime: event.commenceTime,
        };
      }).filter(Boolean);

    } catch (err) {
      console.error('Lines API SharpAPI error:', err.message);
    }
  }

  // Fallback: The Odds API
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(game => {
      const bk = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bk?.markets?.find(m => m.key === 'h2h');
      const spreads = bk?.markets?.find(m => m.key === 'spreads');
      return {
        key: `${game.away_team}|${game.home_team}`,
        away: game.away_team,
        home: game.home_team,
        homeML: fmt(h2h?.outcomes?.find(o => o.name === game.home_team)?.price),
        awayML: fmt(h2h?.outcomes?.find(o => o.name === game.away_team)?.price),
        homeRL: spreads?.outcomes?.find(o => o.name === game.home_team)?.point,
        commenceTime: game.commence_time,
      };
    }).filter(g => g.homeML !== 'N/A');
  } catch { return []; }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') || todayStr();
  const sport = (searchParams.get('sport') || 'mlb').toLowerCase();

  const sportKeyMap = {
    mlb: 'baseball_mlb',
    nba: 'basketball_nba',
    nfl: 'americanfootball_nfl',
  };
  const sportKey = sportKeyMap[sport] || 'baseball_mlb';

  try {
    // Fetch current odds
    const currentOdds = await fetchCurrentOdds(sportKey);
    if (!currentOdds.length) {
      return NextResponse.json({ movements: {}, count: 0, fetchedAt: new Date().toISOString() });
    }

    // Track lines (stores openings, computes movement)
    const movements = await trackLines(currentOdds, sport.toUpperCase(), dateParam);

    // Build response: per-game movement enriched with current odds
    const enriched = {};
    for (const game of currentOdds) {
      const gameKey = `${game.away}|${game.home}|${dateParam}`;
      const movement = movements[gameKey] || {};
      enriched[game.key] = {
        away: game.away,
        home: game.home,
        homeML: game.homeML,
        awayML: game.awayML,
        homeRL: game.homeRL,
        commenceTime: game.commenceTime,
        ...movement,
      };
    }

    // Summary stats
    const allMovements = Object.values(enriched);
    const sharpCount  = allMovements.filter(m => m.moveType === 'SHARP').length;
    const movingCount = allMovements.filter(m => m.moveType === 'MOVING').length;
    const stableCount = allMovements.filter(m => m.moveType === 'STABLE' || m.moveType === 'OPENING').length;

    return NextResponse.json({
      movements: enriched,
      summary: { sharp: sharpCount, moving: movingCount, stable: stableCount, total: allMovements.length },
      sport: sport.toUpperCase(),
      date: dateParam,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('/api/lines error:', err.message);
    return NextResponse.json({ error: err.message, movements: {} }, { status: 500 });
  }
}
