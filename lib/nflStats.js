/**
 * NFL advanced team data — real scoring + efficiency to replace placeholders.
 *
 * WHY: the NFL game object literally set awayOffense/homeDefense to the string
 * "Check NFL stats" and fed that to the model — the analysis had no real
 * offense/defense data at all. This wires two free, Vercel-friendly sources:
 *
 *   1) ESPN standings  → points scored & points allowed per game (offense &
 *      defense scoring) + differential + record, for all 32 teams in one call.
 *   2) nflverse (nflfastR) → team offensive EPA (passing/rushing) — the
 *      strongest predictive efficiency metric in football. A plain CSV in the
 *      nflverse-data GitHub releases; updated weekly through the season.
 *
 * Both are free, keyless, and cached 12h. Every function degrades to an empty
 * map on any error, so NFL keeps working (just without the enrichment).
 */

const TTL_MS = 12 * 60 * 60 * 1000;
const _scoreCache = { fetchedAt: 0, map: null };
const _epaCache = {}; // { [season]: { fetchedAt, map } }

function toNum(v) { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; }
function norm(s) { return String(s || '').toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim(); }

/** NFL season START year: Sep–Dec = this year; Jan–Feb (playoffs) = last year. */
export function nflSeasonYear(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 6 ? y : y - 1; // Jun onward → the season that starts this year
}

// ── ESPN standings → team scoring (offense PPG, defense PPG-allowed, diff) ─────
export async function getNFLTeamScoring() {
  if (_scoreCache.map && Date.now() - _scoreCache.fetchedAt < TTL_MS) return _scoreCache.map;
  try {
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings', {
      headers: { Accept: 'application/json' },
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) return _scoreCache.map || {};
    const data = await res.json();

    const map = {};
    // The standings tree nests team entries; walk it and pick out {team, stats}.
    const walk = (o, depth = 0) => {
      if (!o || depth > 8) return;
      if (Array.isArray(o)) { o.forEach(v => walk(v, depth + 1)); return; }
      if (typeof o === 'object') {
        if (o.team && Array.isArray(o.stats)) {
          const name = o.team.displayName || o.team.name;
          if (name) {
            const g = {};
            for (const s of o.stats) g[s.name] = s.value;
            const games = (toNum(g.wins) || 0) + (toNum(g.losses) || 0) + (toNum(g.ties) || 0);
            const pf = toNum(g.pointsFor), pa = toNum(g.pointsAgainst);
            map[norm(name)] = {
              team: name,
              wins: toNum(g.wins), losses: toNum(g.losses), ties: toNum(g.ties),
              ppg: pf != null && games > 0 ? pf / games : null,          // offense
              oppPpg: pa != null && games > 0 ? pa / games : null,        // defense (lower better)
              pointDiff: toNum(g.pointDifferential ?? g.differential),
              streak: toNum(g.streak),
            };
          }
        }
        for (const v of Object.values(o)) walk(v, depth + 1);
      }
    };
    walk(data);
    if (!Object.keys(map).length) return _scoreCache.map || {};
    _scoreCache.fetchedAt = Date.now();
    _scoreCache.map = map;
    return map;
  } catch (e) {
    console.warn('NFL scoring (ESPN standings) error:', e.message);
    return _scoreCache.map || {};
  }
}

export function matchNFLScoring(teamName, scoringMap) {
  if (!teamName || !scoringMap) return null;
  const n = norm(teamName);
  if (scoringMap[n]) return scoringMap[n];
  let best = null;
  for (const k of Object.keys(scoringMap)) {
    if (n.includes(k) || k.includes(n)) { if (!best || k.length > best.length) best = k; }
  }
  return best ? scoringMap[best] : null;
}

// ── nflverse (nflfastR) → team offensive EPA ──────────────────────────────────
// nflverse team abbreviations differ from ESPN's for a few teams; canonicalize
// so an ESPN game abbr (LAR/WSH) resolves to the nflverse row (LA/WAS).
const ABBR_ALIAS = { LAR: 'LA', STL: 'LA', WSH: 'WAS', OAK: 'LV', SD: 'LAC', JAC: 'JAX' };
function canonAbbr(a) { const u = String(a || '').toUpperCase(); return ABBR_ALIAS[u] || u; }

// Minimal, header-indexed CSV parse. The nflverse team-stats file has no quoted
// fields (team = abbreviation, everything else numeric), so a plain comma split
// is safe; we key columns by header name so column order can't break us.
function parseTeamEPA(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return {};
  const header = lines[0].split(',').map(h => h.trim());
  const iTeam = header.indexOf('team');
  const iPass = header.indexOf('passing_epa');
  const iRush = header.indexOf('rushing_epa');
  if (iTeam === -1) return {};
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const team = (cells[iTeam] || '').trim();
    if (!team) continue;
    const passEPA = iPass !== -1 ? toNum(cells[iPass]) : null;
    const rushEPA = iRush !== -1 ? toNum(cells[iRush]) : null;
    map[canonAbbr(team)] = {
      passEPA, rushEPA,
      totalEPA: (passEPA != null || rushEPA != null) ? (passEPA || 0) + (rushEPA || 0) : null,
    };
  }
  return map;
}

export async function getNFLTeamEPA(season) {
  if (!season) return {};
  const cached = _epaCache[season];
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.map;
  try {
    const url = `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_reg_${season}.csv`;
    const res = await fetch(url, { headers: { Accept: 'text/csv' }, next: { revalidate: TTL_MS / 1000 } });
    if (!res.ok) { // e.g. very early season before the file exists yet
      console.warn(`nflverse EPA fetch: HTTP ${res.status} for ${season}`);
      return cached?.map || {};
    }
    const csv = await res.text();
    const map = parseTeamEPA(csv);
    if (!Object.keys(map).length) return cached?.map || {};
    _epaCache[season] = { fetchedAt: Date.now(), map };
    return map;
  } catch (e) {
    console.warn('nflverse EPA error:', e.message);
    return cached?.map || {};
  }
}

/** Look up a team's EPA by its ESPN abbreviation (canonicalized to nflverse). */
export function matchNFLEPA(abbr, epaMap) {
  if (!abbr || !epaMap) return null;
  return epaMap[canonAbbr(abbr)] || null;
}
