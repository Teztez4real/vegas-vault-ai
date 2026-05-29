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
  return new Date().toISOString().split('T')[0];
}

function fmt(price) {
  if (price == null) return 'N/A';
  return price > 0 ? `+${price}` : `${price}`;
}

// ── FETCH ALL BOOKS (to compare sharp vs public) ──────────────────────────────

async function fetchAllBooks(sportKey) {
  const sharpKey = process.env.SHARPAPI_KEY;
  const games = {};

  if (sharpKey) {
    try {
      const leagueMap = { baseball_mlb:'MLB', basketball_nba:'NBA', americanfootball_nfl:'NFL' };
      const sportKeyMap = { baseball_mlb:'baseball', basketball_nba:'basketball', americanfootball_nfl:'americanfootball' };
      const league = leagueMap[sportKey] || 'MLB';
      const sportName = sportKeyMap[sportKey] || 'baseball';
      const SELECTED_BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];

      const res = await fetch(`https://api.sharpapi.io/api/v1/odds?sport=${sportName}&league=${league}&sportsbook=All`, {
        headers: { 'X-API-Key': sharpKey }, cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data.events || [];

      for (const event of events) {
        const away = event.away || '';
        const home = event.home || '';
        if (!away || !home) continue;
        const key = `${away}|${home}`;
        if (!games[key]) games[key] = { away, home, commenceTime: event.start_time, books: {} };

        const books = event.sportsbooks || event.books || {};
        const odds = event.odds || {};

        // Handle flat odds (aggregate)
        if (odds.moneyline && !Object.keys(books).length) {
          games[key].books['aggregate'] = {
            awayML: odds.moneyline.away,
            homeML: odds.moneyline.home,
          };
        }

        // Handle per-book odds
        Object.entries(books).forEach(([bookName, bookOdds]) => {
          const bookLower = bookName.toLowerCase();
          const isSelected = SELECTED_BOOKS.some(b => bookLower.includes(b));
          if (!isSelected) return;
          if (!games[key].books[bookLower]) games[key].books[bookLower] = {};
          if (bookOdds.moneyline) {
            games[key].books[bookLower].awayML = bookOdds.moneyline.away;
            games[key].books[bookLower].homeML = bookOdds.moneyline.home;
          }
        });
      }
      return games;
    } catch (err) {
      console.error('Lines SharpAPI error:', err.message);
    }
  }}

  // SharpAPI is the only odds source — no Odds API fallback
  console.warn('SharpAPI returned no data for lines, sportKey:', sportKey);
  return games;
}

// ── BUILD GAME LIST WITH BEST ODDS ────────────────────────────────────────────

function buildGames(gamesMap) {
  const preferredBooks = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
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
    const bolEntry = Object.entries(event.books).find(([b]) => b.includes('bet365') || b.includes('betus') || b.includes('bovada'));
    const bolBook  = bolEntry?.[1];

    // DraftKings = biggest public book
    const dkEntry  = Object.entries(event.books).find(([b]) => b.includes('draftkings'));
    const dkBook   = dkEntry?.[1];

    // FanDuel = secondary public book
    const fdEntry  = Object.entries(event.books).find(([b]) => b.includes('fanduel'));
    const fdBook   = fdEntry?.[1];

    // Sharp signal: BetOnline vs DraftKings
    // BetOnline accepts sharp action and adjusts fast — when it diverges from DK, that's real
    // Threshold: 5pts (lower than DK/FD because B365 is a true sharp book)
    let sharpSignal = null;

    const sharpBook  = bolBook?.homeML != null ? bolBook : fdBook;  // B365 preferred, FD fallback
    const publicBook = dkBook?.homeML != null ? dkBook : null;
    const sharpName  = bolBook?.homeML != null ? 'B365' : 'FD';
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

    return {
      key,
      normalizedKey: `${normTeam(event.away)}|${normTeam(event.home)}`,
      away: event.away,
      home: event.home,
      homeML: fmt(bestBook.homeML),
      awayML: fmt(bestBook.awayML),
      commenceTime: event.commenceTime,
      bolHomeML: bolBook?.homeML,
      dkHomeML:  dkBook?.homeML,
      fdHomeML:  fdBook?.homeML,
      sharpSignal,
      allBooks: event.books,
    };
  }).filter(Boolean);
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

// Normalize team name for fuzzy matching
function normTeam(name) {
  return (name || '').toLowerCase()
    .replace(/^(the |los |san |new |st\. |st |fort |las )/, '')
    .replace(/[^a-z]/g, '');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') || todayStr();
  const sport     = (searchParams.get('sport') || 'mlb').toLowerCase();
  const sportKeyMap = { mlb: 'baseball_mlb', nba: 'basketball_nba', nfl: 'americanfootball_nfl' };
  const sportKey  = sportKeyMap[sport] || 'baseball_mlb';

  try {
    await purgeOld(dateParam);

    // Fetch all books
    const gamesMap = await fetchAllBooks(sportKey);
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
        dkHomeML:  fmt(game.dkHomeML),
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
