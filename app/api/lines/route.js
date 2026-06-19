export const revalidate = 0;

/**
 * /api/lines — Real line movement tracking
 * 
 * Strategy:
 * 1. Fetch current odds from SharpAPI (all books)
 * 2. Store first-seen odds as opening lines in Supabase (via lineTracker)
 * 3. Detect true movement: current vs stored opening
 * 4. Also compare DraftKings vs Pinnacle as a real-time sharp indicator
 * 
 * Called by frontend every 5 minutes.
 * GET /api/lines?date=YYYY-MM-DD&sport=mlb
 */

import { NextResponse } from 'next/server';
import { trackLines, purgeOld } from '@/lib/lineTracker';

function todayStr() {
  // Use US Central time, not UTC — matches /api/today's convention and
  // avoids the date rolling over to "tomorrow" during US evening hours.
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ctNow.getFullYear();
  const m = String(ctNow.getMonth() + 1).padStart(2, '0');
  const d = String(ctNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmt(price) {
  if (price == null) return 'N/A';
  return price > 0 ? `+${price}` : `${price}`;
}

// ── FETCH ALL BOOKS (to compare sharp vs public) ──────────────────────────────

async function fetchAllBooks(sportKey, dateParam) {
  const sharpKey = process.env.SHARPAPI_KEY;
  const games = {};

  // Use Odds API for real-time lines across all books
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      const leagueMap = { baseball_mlb: 'baseball_mlb', basketball_nba: 'basketball_nba', americanfootball_nfl: 'americanfootball_nfl' };
      const apiSport = leagueMap[sportKey] || 'baseball_mlb';
      const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/?apiKey=${oddsKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKS.join(',')}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();

      // Filter to only games on the requested date — without this, a
      // multi-game series (same two teams, different days) collides on the
      // `${away}|${home}` key below and the LAST entry in the API response
      // (which may be tomorrow's or another day's game) silently overwrites
      // today's odds, causing the 90-second poller to push wrong-day lines
      // into the UI.
      if (dateParam) {
        data = data.filter(game => {
          if (!game.commence_time) return true;
          const ct = new Date(new Date(game.commence_time).getTime() - 5 * 60 * 60 * 1000);
          return ct.toISOString().split('T')[0] === dateParam;
        });
      }

      for (const game of data) {
        const away = game.away_team;
        const home = game.home_team;
        const key = `${away}|${home}`;
        if (!games[key]) games[key] = { away, home, commenceTime: game.commence_time, books: {} };

        (game.bookmakers || []).forEach(bm => {
          const book = bm.key;
          if (!games[key].books[book]) games[key].books[book] = {};
          bm.markets?.forEach(mkt => {
            if (mkt.key === 'h2h') mkt.outcomes?.forEach(o => {
              if (o.name === away) games[key].books[book].awayML = o.price;
              if (o.name === home) games[key].books[book].homeML = o.price;
            });
            if (mkt.key === 'spreads') mkt.outcomes?.forEach(o => {
              if (o.name === away) { games[key].books[book].awaySpread = o.point; games[key].books[book].awaySpreadPrice = o.price; }
              if (o.name === home) { games[key].books[book].homeSpread = o.point; games[key].books[book].homeSpreadPrice = o.price; }
            });
            if (mkt.key === 'totals') mkt.outcomes?.forEach(o => {
              if (o.name === 'Over')  { games[key].books[book].total = o.point; games[key].books[book].overPrice = o.price; }
              if (o.name === 'Under') { games[key].books[book].underPrice = o.price; }
            });
          });
        });
      }
      return games;
    } catch(err) {
      console.error('Lines Odds API error:', err.message);
    }
  }

  return games;
}

// ── BUILD GAME LIST WITH BEST ODDS ────────────────────────────────────────────

function buildGames(gamesMap) {
  const preferredBooks = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pinnacle', 'pointsbet', 'bet365'];
  return Object.entries(gamesMap).map(([key, event]) => {
    // Best public book for current ML
    let bestBook = null;
    for (const name of preferredBooks) {
      const found = Object.entries(event.books).find(([b]) => b.includes(name));
      if (found?.[1]?.homeML != null) { bestBook = found[1]; break; }
    }
    if (!bestBook) {
      const first = Object.values(event.books).find(b => b.homeML != null);
      if (first) bestBook = first;
    }
    if (!bestBook) return null;

    // BetOnline = sharp book (moves first with sharp money)
    const bolEntry = Object.entries(event.books).find(([b]) => b.includes('betonline') || b.includes('betus') || b.includes('bovada'));
    const bolBook  = bolEntry?.[1];

    // DraftKings = biggest public book
    const dkEntry  = Object.entries(event.books).find(([b]) => b.includes('draftkings'));
    const dkBook   = dkEntry?.[1];

    // FanDuel = secondary public book
    const fdEntry  = Object.entries(event.books).find(([b]) => b.includes('fanduel'));
    const fdBook   = fdEntry?.[1];

    // Sharp signal: BetOnline vs DraftKings
    // BetOnline accepts sharp action and adjusts fast — when it diverges from DK, that's real
    // Threshold: 5pts (lower than DK/FD because BOL is a true sharp book)
    let sharpSignal = null;

    const sharpBook  = bolBook?.homeML != null ? bolBook : fdBook;  // BOL preferred, FD fallback
    const publicBook = dkBook?.homeML != null ? dkBook : null;
    const sharpName  = bolBook?.homeML != null ? 'BOL' : 'FD';
    const publicName = 'DK';

    if (sharpBook && publicBook) {
      const diff = Math.abs(sharpBook.homeML - publicBook.homeML);
      const threshold = bolBook?.homeML != null ? 5 : 7; // tighter threshold for true sharp book
      if (diff >= threshold) {
        // Sharp book more negative on home = sharp money on home
        const sharpOnHome = sharpBook.homeML < publicBook.homeML;
        const sharpSide   = sharpOnHome ? event.home : event.away;
        sharpSignal = {
          side: sharpSide,
          diff,
          sharpML: sharpBook.homeML,
          publicML: publicBook.homeML,
          note: `${sharpName} ${fmt(sharpBook.homeML)} vs ${publicName} ${fmt(publicBook.homeML)}`,
        };
      }
    }

    // Get spread and total from best available book
    const spreadVal = Object.values(event.books).find(b => b.spread != null)?.spread;
    const totalVal = Object.values(event.books).find(b => b.total != null)?.total;

    return {
      key,
      away: event.away,
      home: event.home,
      homeML: fmt(bestBook.homeML),
      awayML: fmt(bestBook.awayML),
      currentHomeML: bestBook.homeML,
      currentAwayML: bestBook.awayML,
      spread: spreadVal != null ? (spreadVal > 0 ? `+${spreadVal}` : `${spreadVal}`) : null,
      total: totalVal || null,
      awaySpreadPrice: (() => { const b = Object.values(event.books).find(b => b.awaySpreadPrice != null); return b ? fmt(b.awaySpreadPrice) : null; })(),
      homeSpreadPrice: (() => { const b = Object.values(event.books).find(b => b.homeSpreadPrice != null); return b ? fmt(b.homeSpreadPrice) : null; })(),
      overPrice:  (() => { const b = Object.values(event.books).find(b => b.overPrice != null); return b ? fmt(b.overPrice) : null; })(),
      underPrice: (() => { const b = Object.values(event.books).find(b => b.underPrice != null); return b ? fmt(b.underPrice) : null; })(),
      commenceTime: event.commenceTime,
      bolHomeML: bolBook?.homeML,
      dkAwayML:  dkBook?.awayML,
      dkHomeML:  dkBook?.homeML,
      dkSpread:  dkBook?.spread != null ? (dkBook.spread > 0 ? `+${dkBook.spread}` : `${dkBook.spread}`) : (spreadVal != null ? (spreadVal > 0 ? `+${spreadVal}` : `${spreadVal}`) : null),
      dkTotal:   dkBook?.total || totalVal || null,
      fdHomeML:  fdBook?.homeML,
      sharpSignal,
      allBooks: event.books,
    };
  }).filter(Boolean);
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') || todayStr();
  const sport     = (searchParams.get('sport') || 'mlb').toLowerCase();
  const sportKeyMap = { mlb: 'baseball_mlb', nba: 'basketball_nba', nfl: 'americanfootball_nfl' };
  const sportKey  = sportKeyMap[sport] || 'baseball_mlb';

  try {
    await purgeOld(dateParam);

    // Fetch all books
    const gamesMap = await fetchAllBooks(sportKey, dateParam);
    if (!Object.keys(gamesMap).length) {
      return NextResponse.json({ movements: {}, summary: { sharp: 0, moving: 0, stable: 0, total: 0 }, fetchedAt: new Date().toISOString() });
    }

    const gamesList = buildGames(gamesMap);
    if (!gamesList.length) {
      return NextResponse.json({ movements: {}, summary: { sharp: 0, moving: 0, stable: 0, total: 0 }, fetchedAt: new Date().toISOString() });
    }

    // Debug: log which books are present per game
    const debug = searchParams.get('debug') === '1';
    if (debug) {
      const bookSample = Object.entries(gamesMap).slice(0, 3).map(([key, g]) => ({
        game: key,
        books: Object.keys(g.books),
        pinnaclePresent: Object.keys(g.books).some(b => b.includes('pinnacle')),
        dkPresent: Object.keys(g.books).some(b => b.includes('draftkings')),
      }));
      console.log('DEBUG books:', JSON.stringify(bookSample));
      if (debug) return NextResponse.json({ debug: bookSample, gameCount: Object.keys(gamesMap).length });
    }

    // Track opening lines + compute movement (stored opening vs current)
    const tracked = await trackLines(gamesList, sport.toUpperCase(), dateParam);

    // Merge tracked movement with real-time sharp signal
    const movements = {};
    for (const game of gamesList) {
      const mv = tracked[game.key] || {};

      // If sharp signal exists between Pinnacle and DK, upgrade the movement description
      if (game.sharpSignal && (mv.moveType === 'STABLE' || mv.moveType === 'OPENING' || !mv.moveType)) {
        const sig = game.sharpSignal;
        mv.lineMovement = `🟠 SHARP — ${sig.note} (${sig.diff}pt gap on ${sig.side.split(' ').pop()})${mv.lineMovement && !mv.lineMovement.includes('stable') ? ' | ' + mv.lineMovement : ''}`;
        mv.rlm = sig.side;
        mv.moveType = 'SHARP';
      }

      movements[game.key] = {
        away: game.away,
        home: game.home,
        homeML: game.homeML,
        awayML: game.awayML,
        commenceTime: game.commenceTime,
        bolHomeML: fmt(game.bolHomeML),
        dkAwayML:  fmt(game.dkAwayML),
        dkHomeML:  fmt(game.dkHomeML),
        dkSpread:  game.dkSpread || null,
        dkTotal:   game.dkTotal  || null,
        fdHomeML:  fmt(game.fdHomeML),
        ...mv,
      };
    }

    // Summary
    const vals = Object.values(movements);
    return NextResponse.json({
      movements,
      summary: {
        sharp:   vals.filter(m => m.moveType === 'SHARP' || m.moveType === 'STEAM').length,
        moving:  vals.filter(m => m.moveType === 'MOVING').length,
        stable:  vals.filter(m => m.moveType === 'STABLE' || m.moveType === 'OPENING').length,
        total:   vals.length,
      },
      sport: sport.toUpperCase(),
      date: dateParam,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('/api/lines error:', err.message);
    return NextResponse.json({ error: err.message, movements: {} }, { status: 500 });
  }
}

// DEBUG endpoint — add ?debug=1 to see raw book data
