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

// ── PLAYER PROPS SUPPORT — real season averages to ground prop analysis ───────
// The props engine used to tell the model "fetch season stats from your
// knowledge" (i.e. guess). These pull the player's REAL BALLDONTLIE season
// averages so the projection is anchored in actual production. Also GOAT tier.

const _playerIdCache = {}; // `${league}:${normName}` -> id | null

async function resolvePlayerId(league, name, key) {
  const ck = `${league}:${norm(name)}`;
  if (ck in _playerIdCache) return _playerIdCache[ck];
  try {
    const res = await fetch(`${BDL_BASE}/${league}/v1/players?search=${encodeURIComponent(name)}&per_page=100`, {
      headers: { Authorization: key, Accept: 'application/json' },
    });
    if (!res.ok) { _playerIdCache[ck] = null; return null; }
    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    const target = norm(name);
    // Prefer an exact "first last" match; otherwise take the first result.
    let hit = rows.find(p => norm(`${p.first_name} ${p.last_name}`) === target) || rows[0] || null;
    const id = hit?.id ?? null;
    _playerIdCache[ck] = id;
    return id;
  } catch {
    _playerIdCache[ck] = null;
    return null;
  }
}

function toF(v) { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; }

/**
 * Fetch a player's real season averages. Returns a normalized object of the
 * prop-relevant stats, or null on any problem (no key, unmatched, error, or
 * non-GOAT tier). Tolerant of both the nested `{stats:{...}}` and flat shapes.
 * @param league 'nba' | 'wnba'
 */
export async function getBDLPlayerAverages(league, season, playerName) {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key || !league || !season || !playerName) return null;
  try {
    const id = await resolvePlayerId(league, playerName, key);
    if (!id) return null;
    const res = await fetch(`${BDL_BASE}/${league}/v1/season_averages/general?season=${season}&season_type=regular&player_ids[]=${id}`, {
      headers: { Authorization: key, Accept: 'application/json' },
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const row = Array.isArray(body?.data) ? body.data[0] : null;
    if (!row) return null;
    const s = row.stats || row; // nested (v2/GOAT) or flat
    return {
      season,
      games: toF(s.games_played ?? s.gp),
      min: toF(s.min),
      pts: toF(s.pts ?? s.points),
      reb: toF(s.reb ?? s.rebounds),
      ast: toF(s.ast ?? s.assists),
      stl: toF(s.stl ?? s.steals),
      blk: toF(s.blk ?? s.blocks),
      threes: toF(s.fg3m ?? s.three_pointers_made),
      fgPct: toF(s.fg_pct),
      fg3Pct: toF(s.fg3_pct),
    };
  } catch {
    return null;
  }
}

/** Render BDL season averages into a compact, prompt-ready baseline string. */
export function formatBDLAverages(a) {
  if (!a) return null;
  const parts = [];
  if (a.pts != null) parts.push(`${a.pts.toFixed(1)} pts`);
  if (a.reb != null) parts.push(`${a.reb.toFixed(1)} reb`);
  if (a.ast != null) parts.push(`${a.ast.toFixed(1)} ast`);
  if (a.threes != null) parts.push(`${a.threes.toFixed(1)} 3PM`);
  if (a.stl != null) parts.push(`${a.stl.toFixed(1)} stl`);
  if (a.blk != null) parts.push(`${a.blk.toFixed(1)} blk`);
  if (a.min != null) parts.push(`${a.min.toFixed(1)} min`);
  const rate = [];
  if (a.fgPct != null) rate.push(`${(a.fgPct * 100).toFixed(1)}% FG`);
  if (a.fg3Pct != null) rate.push(`${(a.fg3Pct * 100).toFixed(1)}% 3P`);
  const gp = a.games != null ? ` over ${a.games} GP` : '';
  if (!parts.length) return null;
  return `${parts.join(', ')}${gp}${rate.length ? ' — ' + rate.join(', ') : ''} (BALLDONTLIE season averages — REAL data)`;
}
