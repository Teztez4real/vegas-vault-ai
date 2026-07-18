/**
 * CollegeFootballData (CFBD) integration — advanced college-football data.
 *
 * WHY: CFB previously had only rank + record + form (ESPN). CFBD is the
 * purpose-built CFB API (the "MLB Stats API of college football"). We pull its
 * SP+ ratings — the strongest single predictive team-quality metric in the
 * sport — so the analysis reasons from real offense/defense quality, not just
 * poll rank and W-L.
 *
 * SETUP: set CFBD_API_KEY in the environment (free key at
 * collegefootballdata.com/key; the $10/mo tier lifts the call cap well beyond
 * anything this app needs). With no key set, every function here degrades to a
 * clean no-op and CFB simply keeps using its existing ESPN data — nothing breaks.
 *
 * CALL BUDGET: SP+ ratings change at most weekly, so we cache hard. A
 * module-level cache (warm-function reuse) plus the Next data cache
 * (`revalidate`) means roughly one upstream call per 12h per season, which sits
 * comfortably inside even the free tier's monthly allowance.
 */

const CFBD_BASE = 'https://api.collegefootballdata.com';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

// { [year]: { fetchedAt, map } }  — map keyed by lowercased CFBD school name.
const _cache = {};

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * SP+ season year for a given date. The season is labeled by its START year:
 * Aug–Dec belong to that calendar year; Jan–Jun (bowls / national title) belong
 * to the previous year's season.
 */
export function cfbSeasonYear(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 7 ? y : y - 1;
}

/**
 * Fetch + cache the season's SP+ ratings. Returns a map keyed by lowercased
 * school name → { team, overall, offense, defense }. Empty map on any problem
 * (no key, network error, unexpected shape) so callers can always proceed.
 *
 * Directionality (important for interpreting the numbers downstream):
 *   overall  — higher is better (net points vs an average team)
 *   offense  — higher is better
 *   defense  — LOWER is better (fewer points allowed vs average)
 */
export async function getCFBDTeamRatings(year) {
  const key = process.env.CFBD_API_KEY;
  if (!key || !year) return {};

  const cached = _cache[year];
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.map;

  try {
    const res = await fetch(`${CFBD_BASE}/ratings/sp?year=${year}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      // Cross-invocation cache so 30-min crons + client loads don't each spend a call.
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) {
      console.warn(`CFBD SP+ fetch failed: HTTP ${res.status}`);
      return cached?.map || {};
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return cached?.map || {};

    const map = {};
    for (const r of rows) {
      const team = r?.team;
      // Skip aggregate rows (e.g. a "nationalAverages" entry) — only real teams.
      if (!team || typeof team !== 'string' || /average/i.test(team)) continue;
      map[team.toLowerCase()] = {
        team,
        // Defensive on shape: v2 nests offense/defense objects with a `rating`;
        // fall back to flat fields if the shape ever differs.
        overall: toNum(r.rating ?? r.overall),
        offense: toNum(r.offense?.rating ?? r.offenseRating ?? r.offense),
        defense: toNum(r.defense?.rating ?? r.defenseRating ?? r.defense),
      };
    }
    // If nothing parsed, keep whatever we had rather than caching an empty map.
    if (!Object.keys(map).length) return cached?.map || {};

    _cache[year] = { fetchedAt: Date.now(), map };
    return map;
  } catch (e) {
    console.warn('CFBD SP+ error:', e.message);
    return cached?.map || {};
  }
}

/**
 * Match a betting/ESPN team name (e.g. "Alabama Crimson Tide") to a CFBD SP+
 * entry keyed by school name (e.g. "Alabama"). CFBD uses the bare school name,
 * which is normally the leading part of the full name — so we match by
 * containment and prefer the LONGEST matching school (so "Miami (OH)" beats a
 * loose "Miami" when the fuller token is present). Returns the rating or null.
 */
export function matchCFBDRating(teamName, ratingsMap) {
  if (!teamName || !ratingsMap) return null;
  const n = teamName.toLowerCase().trim();
  if (ratingsMap[n]) return ratingsMap[n];
  let bestKey = null;
  for (const key of Object.keys(ratingsMap)) {
    if (n.startsWith(key) || n.includes(key)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  return bestKey ? ratingsMap[bestKey] : null;
}
