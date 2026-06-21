/**
 * lineTracker.js
 * Tracks real line movement by storing opening lines in Supabase.
 * Uses the user_data table (user_id='SYSTEM_LINES') — no new table needed.
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

async function dbGet(gameKey) {
  if (CACHE[gameKey]) return CACHE[gameKey];
  const sb = getAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('user_data')
      .select('value')
      .eq('user_id', 'SYSTEM_LINES')
      .eq('key', gameKey)
      .maybeSingle();
    if (error) { console.error('lineTracker dbGet:', error.message); return null; }
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      CACHE[gameKey] = parsed;
      return parsed;
    }
  } catch (e) { console.error('lineTracker dbGet exception:', e.message); }
  return null;
}

async function dbSet(gameKey, record) {
  CACHE[gameKey] = record;
  const sb = getAdmin();
  if (!sb) return;
  try {
    const { error } = await sb.from('user_data').upsert({
      user_id: 'SYSTEM_LINES',
      key: gameKey,
      value: JSON.stringify(record),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
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
    const { data } = await sb
      .from('user_data')
      .select('key')
      .eq('user_id', 'SYSTEM_LINES');
    if (!data?.length) return;
    const oldKeys = data.filter(r => !r.key.endsWith(`|${todayDate}`)).map(r => r.key);
    if (oldKeys.length) {
      await sb.from('user_data').delete()
        .eq('user_id', 'SYSTEM_LINES')
        .in('key', oldKeys);
    }
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

  if (!openHome || !openAway || !currentHomeML || !currentAwayML) {
    return {
      lineMovement: `Opened: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)} — tracking started`,
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
      lineMovement: `Line stable — Opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)} | Now: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`,
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

  let desc = `${intensity} — moved toward ${movedToward} (${Math.abs(homeDiff)}pts home / ${Math.abs(awayDiff)}pts away)`;
  desc += ` | Opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)}`;
  desc += ` | Now: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`;
  desc += trendStr;
  if (rlm) desc += ` | ⚡ SHARP SIGNAL: ${rlm}`;

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
  const out = {};

  if (openSpread != null && currentSpread != null && !isNaN(openSpread) && !isNaN(currentSpread)) {
    const spreadDiff = currentSpread - openSpread;
    if (Math.abs(spreadDiff) >= 0.5) {
      const movedToward = spreadDiff < 0 ? homeName : awayName;
      out.spreadMovement = `Spread moved from ${openSpread > 0 ? '+' : ''}${openSpread} to ${currentSpread > 0 ? '+' : ''}${currentSpread} — moved toward ${movedToward} (${Math.abs(spreadDiff)} pts)`;
      out.spreadMoveSignificant = Math.abs(spreadDiff) >= 1;
    } else {
      out.spreadMovement = `Spread stable at ${currentSpread > 0 ? '+' : ''}${currentSpread} (opened ${openSpread > 0 ? '+' : ''}${openSpread})`;
      out.spreadMoveSignificant = false;
    }
  }

  if (openTotal != null && currentTotal != null && !isNaN(openTotal) && !isNaN(currentTotal)) {
    const totalDiff = currentTotal - openTotal;
    if (Math.abs(totalDiff) >= 0.5) {
      out.totalMovement = `Total moved from ${openTotal} to ${currentTotal} — ${totalDiff > 0 ? 'up' : 'down'} ${Math.abs(totalDiff)}`;
      out.totalMoveSignificant = Math.abs(totalDiff) >= 1;
    } else {
      out.totalMovement = `Total stable at ${currentTotal} (opened ${openTotal})`;
      out.totalMoveSignificant = false;
    }
  }

  return out;
}

// ── MAIN: TRACK A BATCH OF GAMES ─────────────────────────────────────────────

export async function trackLines(games, sport, gameDate) {
  const results = {};

  await Promise.all(games.map(async (game) => {
    const { away, home, homeML, awayML, spread, total } = game;
    if (!away || !home) return;

    const parseML = (s) => {
      if (!s || s === 'N/A') return null;
      const n = parseInt(String(s).replace('+', ''));
      return isNaN(n) ? null : n;
    };
    const parseNum = (s) => {
      if (s == null || s === 'N/A') return null;
      const n = parseFloat(String(s).replace('+', ''));
      return isNaN(n) ? null : n;
    };

    const curHome = parseML(homeML);
    const curAway = parseML(awayML);
    if (curHome == null || curAway == null) return;

    const curSpread = parseNum(spread);
    const curTotal  = parseNum(total);
    const gameKey   = `${away}|${home}|${gameDate}`;
    const now       = new Date().toISOString();
    const snap      = { ts: now, homeML: curHome, awayML: curAway, spread: curSpread, total: curTotal };

    let record = await dbGet(gameKey);

    if (!record) {
      // First time today — current line IS the opening line
      record = {
        game_key:     gameKey,
        sport,
        game_date:    gameDate,
        open_home_ml: curHome,
        open_away_ml: curAway,
        open_spread:  curSpread,
        open_total:   curTotal,
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
