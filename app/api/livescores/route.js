import { NextResponse } from 'next/server';

// ── UNIFIED LIVE SCORES ACROSS ALL SPORTS ────────────────────────────────────
// Previously this only fetched MLB, so NBA/WNBA/NFL cards never got live
// scores, LIVE/FINAL badges, or postponed/delayed detection. Now it fetches
// every sport in parallel and returns a unified shape so the same GameCard
// rendering works identically for all sports:
//   - MLB keeps inning / inningHalf / outs
//   - NBA/WNBA/NFL use period + clock (quarter/period and game clock)
//   - all sports share: away/home scores, status, isFinal, isDelayed,
//     isPostponed, so the card badges light up the same way everywhere.

function fmtCT(t) {
  if (!t) return null;
  try {
    return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) + ' CT';
  } catch { return null; }
}

// Robustly extracts a numeric score from an ESPN competitor's `score` field
// — not consistently shaped across ESPN endpoints (plain string, number, or
// nested {value, displayValue} object). See app/api/today/route.js for the
// full rationale; kept in sync here since this is a separate route module.
function extractScore(scoreField) {
  if (scoreField == null) return null;
  if (typeof scoreField === 'number') return isNaN(scoreField) ? null : scoreField;
  if (typeof scoreField === 'string') {
    const n = parseInt(scoreField, 10);
    return isNaN(n) ? null : n;
  }
  if (typeof scoreField === 'object') {
    const raw = scoreField.value ?? scoreField.displayValue;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

// ── MLB (statsapi.mlb.com — richest baseball data) ──
async function fetchMLBScores(date) {
  const out = [];
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`,
      { cache: 'no-store' }
    );
    if (!res.ok) return out;
    const data = await res.json();
    for (const d of data.dates || []) {
      for (const game of d.games || []) {
        const linescore = game.linescore || {};
        const abstractState = game.status?.abstractGameState;
        const detailedState = game.status?.detailedState;
        const codedState = game.status?.statusCode;
        let displayStatus = detailedState || abstractState || 'Scheduled';
        let isDelayed = false, isPostponed = false;
        if (detailedState?.toLowerCase().includes('delay') || codedState === 'DI' || codedState === 'DC') {
          isDelayed = true; displayStatus = 'Delayed';
        }
        if (['PW', 'PO', 'PPD'].includes(codedState) || detailedState?.toLowerCase() === 'postponed') {
          isPostponed = true; isDelayed = false; displayStatus = 'Postponed';
        }
        const hasScoreData = linescore?.teams?.away?.runs != null || linescore?.teams?.home?.runs != null;
        if (hasScoreData && isPostponed) {
          isPostponed = false; displayStatus = abstractState === 'Final' ? 'Final' : 'In Progress';
        }
        out.push({
          sport: 'MLB',
          gamePk: game.gamePk,
          away: game.teams?.away?.team?.name, home: game.teams?.home?.team?.name,
          awayAbbr: game.teams?.away?.team?.abbreviation, homeAbbr: game.teams?.home?.team?.abbreviation,
          awayScore: linescore.teams?.away?.runs ?? null, homeScore: linescore.teams?.home?.runs ?? null,
          awayHits: linescore.teams?.away?.hits ?? null, homeHits: linescore.teams?.home?.hits ?? null,
          inning: linescore.currentInning ?? null, inningHalf: linescore.inningHalf ?? null, outs: linescore.outs ?? null,
          period: null, clock: null,
          status: abstractState, detailedState: displayStatus,
          isDelayed, isPostponed,
          startTime: game.gameDate, updatedTime: fmtCT(game.rescheduleDate || game.gameDate),
          isFinal: abstractState === 'Final' && !isDelayed && !isPostponed,
          date: d.date,
        });
      }
    }
  } catch (e) { console.error('MLB scores error:', e.message); }
  return out;
}

// ── ESPN scoreboard for NBA / WNBA / NFL (basketball & football) ──
async function fetchESPNScores(sportPath, leagueLabel, date, extraParams = '') {
  const out = [];
  try {
    const espnDate = date.replace(/-/g, ''); // ESPN wants YYYYMMDD
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${espnDate}${extraParams}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return out;
    const data = await res.json();
    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const status = comp.status || event.status || {};
      const stateName = status.type?.state; // 'pre' | 'in' | 'post'
      const completed = status.type?.completed === true;
      const detail = status.type?.shortDetail || status.type?.description || 'Scheduled';
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const typeName = status.type?.name || '';
      const isPostponed = typeName === 'STATUS_POSTPONED' || typeName === 'STATUS_CANCELED';
      const isDelayed = typeName === 'STATUS_DELAYED';
      const isLive = stateName === 'in' && !isPostponed && !isDelayed;
      const isFinal = (stateName === 'post' && completed) && !isPostponed;

      out.push({
        sport: leagueLabel,
        gamePk: event.id,
        away: away.team?.displayName, home: home.team?.displayName,
        awayAbbr: away.team?.abbreviation, homeAbbr: home.team?.abbreviation,
        awayScore: extractScore(away.score),
        homeScore: extractScore(home.score),
        inning: null, inningHalf: null, outs: null,
        period: status.period ?? null,
        clock: status.displayClock ?? null,
        status: stateName === 'in' ? 'Live' : stateName === 'post' ? 'Final' : 'Preview',
        detailedState: isPostponed ? 'Postponed' : isDelayed ? 'Delayed' : isLive ? (detail || 'In Progress') : isFinal ? 'Final' : 'Scheduled',
        isDelayed, isPostponed,
        startTime: event.date, updatedTime: fmtCT(event.date),
        isFinal,
        date,
      });
    }
  } catch (e) { console.error(`${leagueLabel} scores error:`, e.message); }
  return out;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const [mlb, nba, wnba, nfl, cfb, cbb] = await Promise.all([
      fetchMLBScores(date),
      fetchESPNScores('basketball/nba', 'NBA', date),
      fetchESPNScores('basketball/wnba', 'WNBA', date),
      fetchESPNScores('football/nfl', 'NFL', date),
      // College needs the group + limit params to return the full slate
      // (matches the CFB/CBB scoreboard fetches in the today route).
      fetchESPNScores('football/college-football', 'CFB', date, '&groups=80&limit=200'),
      fetchESPNScores('basketball/mens-college-basketball', 'CBB', date, '&groups=50&limit=300'),
    ]);

    const scores = [...mlb, ...nba, ...wnba, ...nfl, ...cfb, ...cbb];
    return NextResponse.json({ scores, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Live scores error:', err.message);
    return NextResponse.json({ scores: [], fetchedAt: new Date().toISOString() });
  }
}
