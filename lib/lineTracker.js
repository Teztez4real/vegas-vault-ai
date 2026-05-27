/**
 * lineTracker.js
 * 
 * Tracks real line movement by storing opening lines in Supabase
 * and comparing against current odds on every poll.
 * 
 * Table: line_snapshots
 *   game_key   TEXT PRIMARY KEY  — "AwayTeam|HomeTeam|YYYY-MM-DD"
 *   sport      TEXT
 *   game_date  DATE
 *   open_home_ml  INT
 *   open_away_ml  INT
 *   open_home_rl  NUMERIC
 *   open_away_rl  NUMERIC
 *   open_total    NUMERIC
 *   snapshots  JSONB   — array of { ts, homeML, awayML, homeRL, total }
 *   created_at TIMESTAMPTZ DEFAULT now()
 *   updated_at TIMESTAMPTZ DEFAULT now()
 */

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Module-level in-memory cache — survives within a serverless instance lifetime
// Used as fallback when Supabase is unavailable
const MEM_CACHE = {};

async function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Ensure the line_snapshots table exists (called once on first use).
 * Uses Supabase SQL via RPC if available.
 */
async function ensureTable(sb) {
  try {
    await sb.rpc('create_line_snapshots_if_not_exists').maybeSingle();
  } catch {}
  // Also try direct — if table doesn't exist, upsert will fail gracefully
}

/**
 * Get stored opening line for a game key.
 * Returns null if not found.
 */
async function getSnapshot(gameKey) {
  // Try memory first
  if (MEM_CACHE[gameKey]) return MEM_CACHE[gameKey];

  const sb = await getAdminClient();
  if (!sb) return null;

  try {
    const { data } = await sb
      .from('line_snapshots')
      .select('*')
      .eq('game_key', gameKey)
      .maybeSingle();
    if (data) {
      MEM_CACHE[gameKey] = data;
      return data;
    }
  } catch {}
  return null;
}

/**
 * Store a new snapshot for a game.
 * If opening line already exists, only append to snapshots history.
 */
async function upsertSnapshot(gameKey, sport, gameDate, currentOdds) {
  const now = new Date().toISOString();
  const snap = {
    ts: now,
    homeML: currentOdds.homeML,
    awayML: currentOdds.awayML,
    homeRL: currentOdds.homeRL,
    total: currentOdds.total,
  };

  // Try Supabase
  const sb = await getAdminClient();
  if (sb) {
    try {
      // Check if exists
      const { data: existing } = await sb
        .from('line_snapshots')
        .select('*')
        .eq('game_key', gameKey)
        .maybeSingle();

      if (!existing) {
        // First time — this IS the opening line
        const row = {
          game_key: gameKey,
          sport,
          game_date: gameDate,
          open_home_ml: currentOdds.homeML,
          open_away_ml: currentOdds.awayML,
          open_home_rl: currentOdds.homeRL,
          open_total: currentOdds.total,
          snapshots: [snap],
          updated_at: now,
        };
        await sb.from('line_snapshots').insert(row);
        MEM_CACHE[gameKey] = row;
        return row;
      } else {
        // Append snapshot to history
        const history = existing.snapshots || [];
        history.push(snap);
        // Keep last 50 snapshots
        if (history.length > 50) history.splice(0, history.length - 50);
        await sb
          .from('line_snapshots')
          .update({ snapshots: history, updated_at: now })
          .eq('game_key', gameKey);
        const updated = { ...existing, snapshots: history, updated_at: now };
        MEM_CACHE[gameKey] = updated;
        return updated;
      }
    } catch (err) {
      console.error('lineTracker upsert error:', err.message);
    }
  }

  // Memory fallback
  if (!MEM_CACHE[gameKey]) {
    MEM_CACHE[gameKey] = {
      game_key: gameKey,
      sport,
      game_date: gameDate,
      open_home_ml: currentOdds.homeML,
      open_away_ml: currentOdds.awayML,
      open_home_rl: currentOdds.homeRL,
      open_total: currentOdds.total,
      snapshots: [snap],
      updated_at: now,
    };
  } else {
    MEM_CACHE[gameKey].snapshots = [...(MEM_CACHE[gameKey].snapshots || []), snap];
    MEM_CACHE[gameKey].updated_at = now;
  }
  return MEM_CACHE[gameKey];
}

/**
 * Purge snapshots older than today (called on new day).
 */
async function purgeOldSnapshots(todayDate) {
  const sb = await getAdminClient();
  if (sb) {
    try {
      await sb.from('line_snapshots').delete().lt('game_date', todayDate);
    } catch {}
  }
  // Clear memory cache
  for (const key of Object.keys(MEM_CACHE)) {
    if (!key.endsWith(todayDate)) delete MEM_CACHE[key];
  }
}

/**
 * Analyze movement between opening line and current line.
 * Returns a structured movement object.
 */
function analyzeMovement(snapshot, currentHomeML, currentAwayML, homeName, awayName) {
  if (!snapshot) {
    return {
      lineMovement: 'Opening line — no prior snapshot',
      rlm: null,
      moveType: 'OPENING',
      homeDiff: 0,
      awayDiff: 0,
    };
  }

  const openHome = snapshot.open_home_ml;
  const openAway = snapshot.open_away_ml;
  const history  = snapshot.snapshots || [];

  if (!openHome || !openAway || !currentHomeML || !currentAwayML) {
    return { lineMovement: 'Line stable — no movement detected', rlm: null, moveType: 'STABLE', homeDiff: 0, awayDiff: 0 };
  }

  const homeDiff = currentHomeML - openHome;
  const awayDiff = currentAwayML - openAway;
  const absHome  = Math.abs(homeDiff);
  const absAway  = Math.abs(awayDiff);

  if (absHome < 3 && absAway < 3) {
    return {
      lineMovement: `Line stable — Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)} (opened Home ${fmtML(openHome)} / Away ${fmtML(openAway)})`,
      rlm: null,
      moveType: 'STABLE',
      homeDiff,
      awayDiff,
      openHome,
      openAway,
    };
  }

  // Determine which side the line moved toward
  // In American odds: home ML going more negative = home getting more action/sharper
  // home ML going more positive = away getting action
  const homeGotSharper = homeDiff < 0; // line moved toward home (home more favored)
  const awayGotSharper = homeDiff > 0; // line moved toward away (away more favored)

  const movedTowardSide = homeGotSharper ? homeName : awayName;
  const movedAwayFrom   = homeGotSharper ? awayName : homeName;
  const biggestMove     = Math.max(absHome, absAway);

  // Classify move size
  const intensity = biggestMove >= 15 ? '🔴 STEAM' : biggestMove >= 8 ? '🟠 SHARP' : '🟡 NOTABLE';

  // RLM detection: if public is on one side but line moves the other way
  // We approximate this: if a team is a home favorite (negative ML) and line moves MORE negative, that's sharp
  const isSharpSignal = biggestMove >= 8;
  const rlm = isSharpSignal ? movedTowardSide : null;

  // Build movement description
  let desc = `${intensity} — Line moved toward ${movedTowardSide} (${absHome} pts home, ${absAway} pts away)`;
  desc += ` | Opened: Home ${fmtML(openHome)} / Away ${fmtML(openAway)}`;
  desc += ` | Current: Home ${fmtML(currentHomeML)} / Away ${fmtML(currentAwayML)}`;

  if (history.length >= 3) {
    // Show direction of last 3 moves
    const recent = history.slice(-3);
    const trend = recent.map((s, i) => {
      if (i === 0) return null;
      const prev = recent[i-1];
      const d = (s.homeML || 0) - (prev.homeML || 0);
      return d < 0 ? '▼home' : d > 0 ? '▲away' : '→';
    }).filter(Boolean).join(' ');
    if (trend) desc += ` | Trend: ${trend}`;
  }

  if (rlm) desc += ` | ⚡ SHARP SIGNAL: ${rlm}`;

  return {
    lineMovement: desc,
    rlm,
    moveType: isSharpSignal ? 'SHARP' : 'MOVING',
    homeDiff,
    awayDiff,
    openHome,
    openAway,
    intensity,
  };
}

function fmtML(val) {
  if (val == null) return 'N/A';
  return val > 0 ? `+${val}` : `${val}`;
}

/**
 * Main export: process a batch of games from the odds API.
 * Stores opening lines, returns enriched movement data per game.
 */
export async function trackLines(games, sport, gameDate) {
  await purgeOldSnapshots(gameDate);

  const results = {};

  await Promise.all(games.map(async (game) => {
    const { away, home, homeML, awayML, homeRL, total } = game;
    if (!away || !home) return;

    // Parse ML values to integers for comparison
    const parseML = (s) => {
      if (!s || s === 'N/A') return null;
      const n = parseInt(s.replace('+', ''));
      return isNaN(n) ? null : n;
    };

    const currentHomeML = parseML(homeML);
    const currentAwayML = parseML(awayML);
    if (!currentHomeML || !currentAwayML) return;

    const gameKey = `${away}|${home}|${gameDate}`;

    // Upsert snapshot (stores opening line on first call)
    const snapshot = await upsertSnapshot(gameKey, sport, gameDate, {
      homeML: currentHomeML,
      awayML: currentAwayML,
      homeRL: parseFloat(homeRL) || null,
      total: parseFloat(total) || null,
    });

    // Analyze movement
    const movement = analyzeMovement(snapshot, currentHomeML, currentAwayML, home, away);
    results[gameKey] = movement;
  }));

  return results;
}

/**
 * Get full snapshot history for a specific game (for the Odds Movement panel).
 */
export async function getGameHistory(away, home, gameDate) {
  const gameKey = `${away}|${home}|${gameDate}`;
  return await getSnapshot(gameKey);
}
