/**
 * lineTracker.js
 * Tracks real line movement by storing opening lines in Supabase.
 * Uses the line_snapshots table (supabase/migrations/line_snapshots.sql),
 * keyed by game_key text. It previously squatted on user_data with
 * user_id='SYSTEM_LINES' — but user_data.user_id is a uuid, so EVERY read
 * and write failed ("invalid input syntax for type uuid", 6.5k errors in
 * prod) and line history only ever lived in per-invocation memory.
 * Tracks ML price movement AND spread/total NUMBER movement.
 */

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Module-level cache — fastest path within same serverless invocation
const CACHE = {};

// ── SUPABASE OPS ──────────────────────────────────────────────────────────────

// Column mapping note: line_snapshots has no open_spread column; the home
// spread lives in open_home_rl ("run line" — same number for MLB, and it
// holds any sport's home spread fine). The in-memory record keeps the
// open_spread name the analyzers already use.
function rowToRecord(row) {
  if (!row) return null;
  const snapshots = Array.isArray(row.snapshots) ? row.snapshots : [];
  return {
    game_key:     row.game_key,
    sport:        row.sport,
    game_date:    row.game_date,
    open_home_ml: row.open_home_ml,
    open_away_ml: row.open_away_ml,
    open_spread:  row.open_home_rl,
    open_total:   row.open_total,
    book:         snapshots[snapshots.length - 1]?.book || 'DraftKings',
    snapshots,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
  };
}

async function dbGet(gameKey) {
  if (CACHE[gameKey]) return CACHE[gameKey];
  const sb = getAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('line_snapshots')
      .select('*')
      .eq('game_key', gameKey)
      .maybeSingle();
    if (error) { console.error('lineTracker dbGet:', error.message); return null; }
    const record = rowToRecord(data);
    if (record) {
      CACHE[gameKey] = record;
      return record;
    }
  } catch (e) { console.error('lineTracker dbGet exception:', e.message); }
  return null;
}

async function dbSet(gameKey, record) {
  CACHE[gameKey] = record;
  const sb = getAdmin();
  if (!sb) return;
  try {
    const { error } = await sb.from('line_snapshots').upsert({
      game_key:     gameKey,
      sport:        record.sport,
      game_date:    record.game_date,
      open_home_ml: record.open_home_ml,
      open_away_ml: record.open_away_ml,
      open_home_rl: record.open_spread,
      open_total:   record.open_total,
      snapshots:    record.snapshots || [],
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'game_key' });
    if (error) console.error('lineTracker dbSet:', error.message);
  } catch (e) { console.error('lineTracker dbSet exception:', e.message); }
}

// ── PURGE OLD DATA ────────────────────────────────────────────────────────────

export async function purgeOld(todayDate) {
  for (const k of Object.keys(CACHE)) {
    if (!k.endsWith(`|${todayDate}`)) delete CACHE[k];
  }
  const sb = getAdmin();
  if (!sb) return;
  try {
    // Same intent as the old key-suffix scan, but expressed on the real
    // game_date column: drop rows from before today.
    await sb.from('line_snapshots').delete().lt('game_date', todayDate);
  } catch {}
}

// ── FORMAT ────────────────────────────────────────────────────────────────────

function fmtML(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return val > 0 ? `+${val}` : `${val}`;
}

// ── ANALYZE ML MOVEMENT ───────────────────────────────────────────────────────

function analyzeMovement(record, currentHomeML, currentAwayML, homeName, awayName) {
  const openHome = record.open_home_ml;
  const openAway = record.open_away_ml;
  const book     = record.book || 'DraftKings';

  if (!openHome || !openAway || !currentHomeML || !currentAwayML) {
    return {
      lineMovement: `${book} opening: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)} — tracking started`,
      rlm: null, moveType: 'OPENING',
      openHome: currentHomeML, openAway: currentAwayML,
      homeDiff: 0, awayDiff: 0,
    };
  }

  const homeDiff = currentHomeML - openHome;
  const awayDiff = currentAwayML - openAway;
  const maxMove  = Math.max(Math.abs(homeDiff), Math.abs(awayDiff));

  if (maxMove < 3) {
    return {
      lineMovement: `${book} line stable — Opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)} | Now: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`,
      rlm: null, moveType: 'STABLE',
      openHome, openAway, homeDiff, awayDiff,
    };
  }

  const movedToward = homeDiff < 0 ? homeName : awayName;
  const intensity   = maxMove >= 15 ? '🔴 STEAM' : maxMove >= 8 ? '🟠 SHARP' : '🟡 NOTABLE';
  const isSharp     = maxMove >= 8;
  const rlm         = isSharp ? movedToward : null;

  const snapshots = record.snapshots || [];
  let trendStr = '';
  if (snapshots.length >= 3) {
    const recent = snapshots.slice(-3);
    const moves  = recent.slice(1).map((s, i) => {
      const d = (s.homeML || 0) - (recent[i].homeML || 0);
      return d < -1 ? '▼' : d > 1 ? '▲' : '→';
    });
    trendStr = ` | Trend: ${moves.join('')}`;
  }

  let desc = `${intensity} — ${book} moved toward ${movedToward} (${Math.abs(homeDiff)}pts home / ${Math.abs(awayDiff)}pts away)`;
  desc += ` | ${book} opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)}`;
  desc += ` | Now: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`;
  desc += trendStr;
  if (rlm) desc += ` | ⚡ SHARP SIGNAL on ${rlm}`;

  return {
    lineMovement: desc,
    rlm,
    moveType: maxMove >= 15 ? 'STEAM' : isSharp ? 'SHARP' : 'MOVING',
    homeDiff, awayDiff, openHome, openAway, intensity,
  };
}
// ── ANALYZE SPREAD/TOTAL NUMBER MOVEMENT ─────────────────────────────────────

function analyzeSpreadTotalMovement(record, currentSpread, currentTotal, homeName, awayName) {
  const openSpread = record.open_spread;
  const openTotal  = record.open_total;
  const book       = record.book || 'DraftKings';
  const out = {};

  if (openSpread != null && currentSpread != null && !isNaN(openSpread) && !isNaN(currentSpread)) {
    const spreadDiff = currentSpread - openSpread;
    if (Math.abs(spreadDiff) >= 0.5) {
      const movedToward = spreadDiff < 0 ? homeName : awayName;
      out.spreadMovement = `${book} spread moved from ${openSpread > 0 ? '+' : ''}${openSpread} to ${currentSpread > 0 ? '+' : ''}${currentSpread} — toward ${movedToward} (${Math.abs(spreadDiff)} pts)`;
      out.spreadMoveSignificant = Math.abs(spreadDiff) >= 1;
    } else {
      out.spreadMovement = `${book} spread stable at ${currentSpread > 0 ? '+' : ''}${currentSpread} (opened ${openSpread > 0 ? '+' : ''}${openSpread})`;
      out.spreadMoveSignificant = false;
    }
  }

  if (openTotal != null && currentTotal != null && !isNaN(openTotal) && !isNaN(currentTotal)) {
    const totalDiff = currentTotal - openTotal;
    if (Math.abs(totalDiff) >= 0.5) {
      out.totalMovement = `${book} total moved from ${openTotal} to ${currentTotal} — ${totalDiff > 0 ? 'up' : 'down'} ${Math.abs(totalDiff)}`;
      out.totalMoveSignificant = Math.abs(totalDiff) >= 1;
    } else {
      out.totalMovement = `${book} total stable at ${currentTotal} (opened ${openTotal})`;
      out.totalMoveSignificant = false;
    }
  }

  return out;
}

// ── MAIN: TRACK A BATCH OF GAMES ─────────────────────────────────────────────

export async function trackLines(games, sport, gameDate) {
  const results = {};

  await Promise.all(games.map(async (game) => {
    const { away, home, homeML, awayML, spread, total, dkHomeML, dkAwayML, dkSpread, dkTotal } = game;
    if (!away || !home) return;

    const parseML = (s) => {
      if (s == null || s === 'N/A') return null;
      const n = parseInt(String(s).replace('+', ''));
      return isNaN(n) ? null : n;
    };
    const parseNum = (s) => {
      if (s == null || s === 'N/A') return null;
      const n = parseFloat(String(s).replace('+', ''));
      return isNaN(n) ? null : n;
    };

    // ── USE DRAFTKINGS SPECIFICALLY ───────────────────────────────────────────
    // DraftKings is the benchmark public book. Tracking their line gives a
    // consistent, meaningful reference for movement — not a mixed aggregate.
    // Fall back to best-book only if DK isn't available for this game.
    const curHome = parseML(dkHomeML) ?? parseML(homeML);
    const curAway = parseML(dkAwayML) ?? parseML(awayML);
    if (curHome == null || curAway == null) return;

    // For spread/total, prefer DK's numbers too
    const curSpread = parseNum(dkSpread) ?? parseNum(spread);
    const curTotal  = parseNum(dkTotal)  ?? parseNum(total);

    const gameKey = `${away}|${home}|${gameDate}`;
    const now     = new Date().toISOString();
    const snap    = { ts: now, homeML: curHome, awayML: curAway, spread: curSpread, total: curTotal, book: 'DraftKings' };

    let record = await dbGet(gameKey);

    if (!record) {
      // First time today — DraftKings' current line is the opening line
      record = {
        game_key:     gameKey,
        sport,
        game_date:    gameDate,
        open_home_ml: curHome,
        open_away_ml: curAway,
        open_spread:  curSpread,
        open_total:   curTotal,
        book:         'DraftKings',
        snapshots:    [snap],
        created_at:   now,
        updated_at:   now,
      };
      await dbSet(gameKey, record);
    } else {
      const history = [...(record.snapshots || []), snap].slice(-50);
      record = {
        ...record,
        open_spread: record.open_spread ?? curSpread,
        open_total:  record.open_total  ?? curTotal,
        snapshots:   history,
        updated_at:  now,
      };
      await dbSet(gameKey, record);
    }

    const mlMovement          = analyzeMovement(record, curHome, curAway, home, away);
    const spreadTotalMovement = analyzeSpreadTotalMovement(record, curSpread, curTotal, home, away);
    results[`${away}|${home}`] = { ...mlMovement, ...spreadTotalMovement };
  }));

  return results;
}

export async function getGameHistory(away, home, gameDate) {
  return await dbGet(`${away}|${home}|${gameDate}`);
}

// ── FALLBACK: last-known lines when the odds API is unavailable ───────────────
// When Odds API credits are exhausted, we can't fetch a fresh price — but we've
// been storing DraftKings snapshots all day. This returns the most recent
// stored snapshot for a game so the AI still sees opening line + last-known
// line + all movement up to the point the API stopped responding.
export async function getLastKnownLines(away, home, gameDate) {
  const record = await dbGet(`${away}|${home}|${gameDate}`);
  if (!record || !record.snapshots?.length) return null;
  const latest = record.snapshots[record.snapshots.length - 1];
  return {
    away, home,
    homeML: latest.homeML,
    awayML: latest.awayML,
    spread: latest.spread,
    total:  latest.total,
    openHomeML: record.open_home_ml,
    openAwayML: record.open_away_ml,
    openSpread: record.open_spread,
    openTotal:  record.open_total,
    lastUpdated: latest.ts,
    snapshotCount: record.snapshots.length,
    book: record.book || 'DraftKings',
    isStale: true, // flag so the UI/AI knows this is last-known, not live
  };
}

