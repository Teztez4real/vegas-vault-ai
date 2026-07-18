/**
 * BALLDONTLIE integration — authoritative standings for NBA & WNBA.
 *
 * WHY: gives the basketball analysis official standings context — conference
 * rank plus authoritative win/loss and home/road splits — on top of ESPN's
 * records and the computed PPG/pace. One key covers both leagues' structure.
 *
 * TIER NOTE: the standings endpoint (and the bigger prizes — player props and
 * team advanced averages) are BALLDONTLIE's GOAT tier, which is paid and
 * PER-SPORT. Set BALLDONTLIE_API_KEY once you have a key; with it unset (or on
 * a tier without standings access → 401/403) every function here returns an
 * empty map and basketball analysis keeps using its existing ESPN data.
 * Nothing breaks either way.
 *
 * CALL BUDGET: standings change at most daily, so a 6h module cache plus the
 * Next data cache keeps this to a couple of upstream calls per day per league.
 */

const BDL_BASE = 'https://api.balldontlie.io';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h
const _cache = {}; // { [`${league}:${season}`]: { fetchedAt, map } }

function toNum(v) {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function norm(s) {
  return String(s || '').toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * BALLDONTLIE season label for a league + date.
 *   NBA  — labeled by START year (2025-26 season = 2025): Oct→Dec = this year,
 *          Jan→Jun = previous year.
 *   WNBA — a single calendar-year season (May–Oct) = that year.
 */
export function bdlSeason(league, dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (league === 'wnba') return y;
  return m >= 9 ? y : y - 1; // NBA start-year label (Sep preseason onward)
}

/**
 * Fetch + cache a league's standings. Returns a map keyed by normalized team
 * full name → { wins, losses, conferenceRecord, conferenceRank, divisionRank,
 * homeRecord, roadRecord }. Empty map on any problem so callers always proceed.
 * @param league 'nba' | 'wnba'
 */
export async function getBDLStandings(league, season) {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key || !league || !season) return {};

  const ck = `${league}:${season}`;
  const cached = _cache[ck];
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.map;

  try {
    const res = await fetch(`${BDL_BASE}/${league}/v1/standings?season=${season}`, {
      headers: { Authorization: key, Accept: 'application/json' },
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) {
      // 401/403 = key missing standings (non-GOAT) access — degrade quietly.
      console.warn(`BALLDONTLIE ${league} standings: HTTP ${res.status}`);
      return cached?.map || {};
    }
    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : null);
    if (!rows) return cached?.map || {};

    const map = {};
    for (const r of rows) {
      const t = r?.team || {};
      const name = t.full_name || (t.city && t.name ? `${t.city} ${t.name}` : t.name);
      if (!name) continue;
      map[norm(name)] = {
        team: name,
        abbreviation: t.abbreviation || null,
        conference: t.conference || null,
        wins: toNum(r.wins),
        losses: toNum(r.losses),
        conferenceRecord: r.conference_record || null,
        conferenceRank: toNum(r.conference_rank),
        divisionRank: toNum(r.division_rank),
        homeRecord: r.home_record || null,
        roadRecord: r.road_record || null,
      };
    }
    if (!Object.keys(map).length) return cached?.map || {};

    _cache[ck] = { fetchedAt: Date.now(), map };
    return map;
  } catch (e) {
    console.warn(`BALLDONTLIE ${league} standings error:`, e.message);
    return cached?.map || {};
  }
}

/**
 * Match an odds/ESPN team name to a BDL standings entry (keyed by normalized
 * full name). NBA/WNBA odds names are usually the full name already, so this is
 * mostly exact; containment + longest-match is the fallback for minor variants.
 */
export function matchBDLTeam(teamName, standingsMap) {
  if (!teamName || !standingsMap) return null;
  const n = norm(teamName);
  if (standingsMap[n]) return standingsMap[n];
  let bestKey = null;
  for (const key of Object.keys(standingsMap)) {
    if (!key) continue;
    if (n.startsWith(key) || n.includes(key) || key.includes(n)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  return bestKey ? standingsMap[bestKey] : null;
}
