/**
 * Barttorvik (T-Rank) integration — advanced college-basketball efficiency.
 *
 * WHY: CBB previously reasoned from rank + record + form only. Barttorvik's
 * tempo-free efficiency ratings are the free, KenPom-class advanced metrics for
 * college basketball — adjusted offensive/defensive efficiency (points per 100
 * possessions), the Barthag power rating, and tempo. This gives the CBB model
 * the same kind of real quality signal that SP+ gives CFB.
 *
 * NO KEY REQUIRED. Barttorvik publishes a plain public JSON file per season
 * (barttorvik.com/{year}_team_results.json) — free, no auth, no bot-check. On
 * any error the functions here return an empty map and CBB simply keeps using
 * its existing ESPN rank/record/form — nothing breaks.
 *
 * CALL BUDGET: the file changes at most daily, so a 12h module cache plus the
 * Next data cache keeps this to ~1 upstream fetch per 12h per season.
 *
 * Column layout of each row in team_results.json (verified against live data):
 *   [1] team   [4] AdjOE (higher=better)   [6] AdjDE (LOWER=better)
 *   [8] Barthag (0-1 power rating, higher=better)   [44] tempo (poss/40min)
 */

const TTL_MS = 12 * 60 * 60 * 1000; // 12h
const _cache = {}; // { [year]: { fetchedAt, map } }

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize a team name for matching: lowercase, drop punctuation, collapse
// spaces. Bridges Barttorvik's "N.C. State" / "St. John's" against the odds
// feed's "NC State Wolfpack" / "St. John's Red Storm".
function norm(s) {
  return String(s || '').toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
}

/** CBB season END year for a date. Season runs Nov–Apr, labeled by end year:
 *  Nov–Dec belong to next year's season; Jan–Apr to the current year. */
export function cbbSeasonYear(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 6 ? y + 1 : y; // Jun onward → the season that ends next year
}

/**
 * Fetch + cache the season's T-Rank efficiency. Returns a map keyed by the
 * normalized team name → { team, adjOE, adjDE, barthag, tempo }. Empty map on
 * any problem so callers can always proceed.
 */
export async function getBarttorvikRatings(year) {
  if (!year) return {};
  const cached = _cache[year];
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.map;

  try {
    const res = await fetch(`https://barttorvik.com/${year}_team_results.json`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) {
      console.warn(`Barttorvik fetch failed: HTTP ${res.status}`);
      return cached?.map || {};
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return cached?.map || {};

    const map = {};
    for (const r of rows) {
      const team = Array.isArray(r) ? r[1] : null;
      if (!team || typeof team !== 'string') continue;
      map[norm(team)] = {
        team,
        adjOE: toNum(r[4]),
        adjDE: toNum(r[6]),
        barthag: toNum(r[8]),
        tempo: toNum(r[44]),
      };
    }
    if (!Object.keys(map).length) return cached?.map || {};

    _cache[year] = { fetchedAt: Date.now(), map };
    return map;
  } catch (e) {
    console.warn('Barttorvik error:', e.message);
    return cached?.map || {};
  }
}

/**
 * Match an odds/ESPN team name ("Houston Cougars", "NC State Wolfpack") to a
 * Barttorvik entry keyed by normalized school name ("houston", "nc state").
 * Prefers the LONGEST matching school so multi-word schools win over short ones.
 */
export function matchBarttorvikRating(teamName, ratingsMap) {
  if (!teamName || !ratingsMap) return null;
  const n = norm(teamName);
  if (ratingsMap[n]) return ratingsMap[n];
  let bestKey = null;
  for (const key of Object.keys(ratingsMap)) {
    if (!key) continue;
    if (n.startsWith(key) || n.includes(key)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  return bestKey ? ratingsMap[bestKey] : null;
}
