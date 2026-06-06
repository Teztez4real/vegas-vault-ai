/**
 * lineTracker.js
 * Tracks real line movement by storing opening lines in Supabase.
 * Uses the same admin client pattern as the rest of the app.
 */

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Module-level memory cache — fastest path, no network needed
// Key: "Away|Home|YYYY-MM-DD"
// Value: { openHomeML, openAwayML, snapshots: [{ts, homeML, awayML}] }
const CACHE = {};

// ── SUPABASE OPS ──────────────────────────────────────────────────────────────

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
    if (data) { CACHE[gameKey] = data; return data; }
  } catch (e) { console.error('lineTracker dbGet exception:', e.message); }
  return null;
}

async function dbSet(gameKey, row) {
  CACHE[gameKey] = row;
  const sb = getAdmin();
  if (!sb) return;
  try {
    const { error } = await sb.from('line_snapshots').upsert(row, { onConflict: 'game_key' });
    if (error) console.error('lineTracker dbSet:', error.message);
  } catch (e) { console.error('lineTracker dbSet exception:', e.message); }
}

// ── PURGE OLD DATA ────────────────────────────────────────────────────────────

export async function purgeOld(todayDate) {
  // Clear stale memory
  for (const k of Object.keys(CACHE)) {
    if (!k.endsWith(`|${todayDate}`)) delete CACHE[k];
  }
  const sb = getAdmin();
  if (!sb) return;
  try {
    await sb.from('line_snapshots').delete().lt('game_date', todayDate);
  } catch {}
}

// ── ANALYZE MOVEMENT ──────────────────────────────────────────────────────────

function fmtML(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return val > 0 ? `+${val}` : `${val}`;
}

function analyzeMovement(record, currentHomeML, currentAwayML, homeName, awayName) {
  const openHome = record.open_home_ml;
  const openAway = record.open_away_ml;

  if (!openHome || !openAway || !currentHomeML || !currentAwayML) {
    return { lineMovement: `Line stable — Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`, rlm: null, moveType: 'STABLE', homeDiff: 0, awayDiff: 0 };
  }

  const homeDiff = currentHomeML - openHome;
  const awayDiff = currentAwayML - openAway;
  const maxMove  = Math.max(Math.abs(homeDiff), Math.abs(awayDiff));

  if (maxMove < 3) {
    return {
      lineMovement: `Line stable — Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)} (opened Home ${fmtML(openHome)} / Away ${fmtML(openAway)})`,
      rlm: null, moveType: 'STABLE', homeDiff, awayDiff, openHome, openAway,
    };
  }

  // Which side got sharper?
  const movedToward = homeDiff < 0 ? homeName : awayName; // more negative = more favored
  const intensity   = maxMove >= 15 ? '🔴 STEAM' : maxMove >= 8 ? '🟠 SHARP' : '🟡 NOTABLE';
  const isSharp     = maxMove >= 8;
  const rlm         = isSharp ? movedToward : null;

  const snapshots   = record.snapshots || [];
  let trendStr = '';
  if (snapshots.length >= 3) {
    const recent = snapshots.slice(-3);
    const moves  = recent.slice(1).map((s, i) => {
      const d = (s.homeML || 0) - (recent[i].homeML || 0);
      return d < -1 ? '▼' : d > 1 ? '▲' : '→';
    });
    trendStr = ` | Trend: ${moves.join('')}`;
  }

  let desc = `${intensity} — moved toward ${movedToward} (${Math.abs(homeDiff)}pts home / ${Math.abs(awayDiff)}pts away)`;
  desc += ` | Opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)}`;
  desc += ` | Now: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`;
  desc += trendStr;
  if (rlm) desc += ` | ⚡ SHARP SIGNAL: ${rlm}`;

  return {
    lineMovement: desc,
    rlm,
    moveType: maxMove >= 15 ? 'STEAM' : isSharp ? 'SHARP' : 'MOVING',
    homeDiff,
    awayDiff,
    openHome,
    openAway,
    intensity,
  };
}

// ── MAIN: TRACK A BATCH OF GAMES ─────────────────────────────────────────────

export async function trackLines(games, sport, gameDate) {
  const results = {};

  await Promise.all(games.map(async (game) => {
    const { away, home } = game;
    if (!away || !home) return;

    const parseML = (s) => {
      if (!s || s === 'N/A') return null;
      const n = parseInt(String(s).replace('+', ''));
      return isNaN(n) ? null : n;
    };

    // Always use DK-specific ML for tracking — currentHomeML/currentAwayML are DK prices
    const curHome = parseML(game.currentHomeML ?? game.homeML);
    const curAway = parseML(game.currentAwayML ?? game.awayML);
    if (curHome == null || curAway == null) return;

    const gameKey = `${away}|${home}|${gameDate}`;
    const now     = new Date().toISOString();
    const snap    = { ts: now, homeML: curHome, awayML: curAway };

    // Try to get existing record
    let record = await dbGet(gameKey);

    if (!record) {
      // First time today — this IS the opening line
      record = {
        game_key:     gameKey,
        sport,
        game_date:    gameDate,
        open_home_ml: curHome,
        open_away_ml: curAway,
        snapshots:    [snap],
        created_at:   now,
        updated_at:   now,
      };
      await dbSet(gameKey, record);
    } else {
      // Append snapshot
      const history = [...(record.snapshots || []), snap];
      if (history.length > 50) history.splice(0, history.length - 50);
      record = { ...record, snapshots: history, updated_at: now };
      await dbSet(gameKey, record);
    }

    results[`${away}|${home}`] = analyzeMovement(record, curHome, curAway, home, away);
  }));

  return results;
}

export async function getGameHistory(away, home, gameDate) {
  return await dbGet(`${away}|${home}|${gameDate}`);
}
