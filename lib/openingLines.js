/**
 * Freezes the TRUE opening line for a game the first time it's ever seen,
 * and returns that frozen value on every subsequent call — regardless of
 * when the AI actually analyzes the game or when the admin sets the slot
 * pattern. This is what makes line movement a genuine "opening vs now"
 * comparison instead of comparing the current price to itself (which is
 * what happens if "opening" is re-read from the live odds feed on every
 * fetch — every fetch IS "now", so it can never show real movement).
 *
 * Call this once per game on every /api/today fetch. It's cheap: a single
 * indexed lookup, and only writes once ever per game (the first time).
 */
export async function getOrFreezeOpeningLine(sb, gameKey, date, sport, current) {
  try {
    const { data: existing } = await sb
      .from('opening_lines')
      .select('away_ml, home_ml, spread, away_spread_price, home_spread_price, total, over_price, under_price')
      .eq('game_key', gameKey)
      .maybeSingle();

    if (existing) return existing; // already frozen — this IS the true opening line

    // First time we've ever seen this game — freeze current odds as opening.
    const toInsert = {
      game_key: gameKey, date, sport,
      away_ml: numOrNull(current.awayML),
      home_ml: numOrNull(current.homeML),
      spread: current.spread ?? null,
      away_spread_price: numOrNull(current.awaySpreadPrice),
      home_spread_price: numOrNull(current.homeSpreadPrice),
      total: current.total ?? null,
      over_price: numOrNull(current.overPrice),
      under_price: numOrNull(current.underPrice),
    };
    const { error } = await sb.from('opening_lines').insert(toInsert);
    if (error) {
      const { data: raced } = await sb
        .from('opening_lines')
        .select('away_ml, home_ml, spread, away_spread_price, home_spread_price, total, over_price, under_price')
        .eq('game_key', gameKey)
        .maybeSingle();
      if (raced) return raced;
    }
    return {
      away_ml: toInsert.away_ml, home_ml: toInsert.home_ml, spread: toInsert.spread,
      away_spread_price: toInsert.away_spread_price, home_spread_price: toInsert.home_spread_price,
      total: toInsert.total, over_price: toInsert.over_price, under_price: toInsert.under_price,
    };
  } catch {
    return null;
  }
}

function numOrNull(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[+]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function fmtPrice(n) {
  if (n == null) return 'N/A';
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Builds the genuine, human-readable "opening vs now" line movement text
 * from a frozen opening row + the current live odds. This replaces the old
 * cross-book-at-one-moment check that was mislabeled as "line movement."
 */
export function buildTrueLineMovementText(opening, current) {
  if (!opening) return 'Opening line unavailable';
  const signals = [];

  const openAway = opening.away_ml, openHome = opening.home_ml;
  const curAway = numOrNull(current.awayML), curHome = numOrNull(current.homeML);
  if (openAway != null && curAway != null && openAway !== curAway) {
    const moved = Math.abs(curAway - openAway);
    if (moved >= 5) {
      const dir = curAway < openAway ? 'shortened (more bet on)' : 'drifted (less bet on)';
      signals.push(`Away ML opened ${fmtPrice(openAway)}, now ${fmtPrice(curAway)} — ${dir}`);
    }
  }
  if (openHome != null && curHome != null && openHome !== curHome) {
    const moved = Math.abs(curHome - openHome);
    if (moved >= 5) {
      const dir = curHome < openHome ? 'shortened (more bet on)' : 'drifted (less bet on)';
      signals.push(`Home ML opened ${fmtPrice(openHome)}, now ${fmtPrice(curHome)} — ${dir}`);
    }
  }
  if (opening.spread && current.spread && opening.spread !== current.spread) {
    signals.push(`Spread moved from ${opening.spread} to ${current.spread}`);
  }
  if (opening.total && current.total && String(opening.total) !== String(current.total)) {
    signals.push(`Total moved from ${opening.total} to ${current.total}`);
  }

  return signals.length ? signals.join(' | ') : 'No significant movement from open';
}
