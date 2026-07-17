import { NextResponse } from 'next/server';
import { gradeCompletedGames, gradeUserAltPicks, regradeHistoricalPicks, regradeHistoricalAltPicks, invalidateWrongSportAnalyses } from '@/lib/grading';
import { recordHeartbeat } from '@/lib/agentHeartbeat';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── LIVE SCORE TICKER (closest possible approximation of a native "Live
// Activity" on the lock screen) ─────────────────────────────────────────────
// IMPORTANT HONEST NOTE: what ESPN/theScore/CBS Sports use for persistent,
// auto-updating lock-screen score widgets is Apple's ActivityKit ("Live
// Activities") — a NATIVE iOS capability that requires a real Swift/Xcode
// app submitted to the App Store. It cannot be built from a website or PWA;
// there is no web API that grants that lock-screen surface. This endpoint
// is the closest approximation achievable from a web app: a push
// notification, scoped to ONLY the games on a user's watchlist, that
// silently UPDATES IN PLACE (same tag, no re-vibrate/re-alert) whenever the
// score or inning changes — so the lock screen shows a live-refreshing
// score without buzzing the phone every couple of minutes. It will not have
// the rich native Live Activity UI (Dynamic Island, progress ring, etc).
//
// ALSO runs grading on this same frequent cron (not just the 30-min
// analysis cron) — a finished game's final score is visible instantly via
// live scoreboard data, but the WIN/LOSS grade used to only get computed up
// to 30 minutes later. Running it here too means a game is graded within
// ~2 minutes of going final, so the CASHED/LOSS stamp (game cards, share
// images, track record) shows up almost immediately instead of lagging.
export async function GET(req) {
  const hasCronHeader = req.headers.get('x-vercel-cron') != null;
  const authHeader = req.headers.get('authorization') || '';
  const secretMatches = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!hasCronHeader && !secretMatches) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const origin = new URL(req.url).origin;

    // CT date, matching the rest of the app
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

    // Grade any newly-finished games FIRST — runs regardless of watchlist
    // state, since it's the AI's own track record, not a per-user feature.
    let gradedCount = 0;
    try { gradedCount = await gradeCompletedGames(sb, todayStr, origin); } catch {}
    try { await gradeUserAltPicks(sb, todayStr, origin); } catch {}
    try { await regradeHistoricalPicks(sb); } catch {}
    try { await regradeHistoricalAltPicks(sb); } catch {}
    try { await invalidateWrongSportAnalyses(sb, todayStr); } catch {}
    // Outcome Tracker heartbeat — this frequent cron is the fastest grader,
    // so it keeps the agent's heartbeat fresh (~2 min) even between the
    // 30-min analysis runs. 'ok' when it graded finals, 'idle' otherwise.
    await recordHeartbeat(sb, 'outcome-tracker', {
      status: gradedCount > 0 ? 'ok' : 'idle',
      detail: gradedCount > 0 ? `Graded ${gradedCount} finished game(s)` : 'No new finals to grade',
      count: gradedCount,
    });

    // 1. Build a map of gameId -> [userIds who have it watchlisted]
    const { data: watchRows } = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
    const watchers = {}; // gameId -> [userId]
    for (const row of watchRows || []) {
      let ids; try { ids = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(ids)) continue;
      for (const gameId of ids) {
        (watchers[gameId] = watchers[gameId] || []).push(row.user_id);
      }
    }
    const watchedGameIds = new Set(Object.keys(watchers).map(String));
    if (!watchedGameIds.size) return NextResponse.json({ checked: 0, sent: 0, graded: gradedCount, note: 'No watchlisted games' });

    // 2. Fetch today's live scores (CT date, matching the rest of the app)
    const scoresRes = await fetch(`${origin}/api/livescores?date=${todayStr}`, { cache: 'no-store' });
    if (!scoresRes.ok) return NextResponse.json({ checked: 0, sent: 0, graded: gradedCount, error: 'livescores fetch failed' });
    const { scores } = await scoresRes.json();

    // 3. For every LIVE (in-progress) watchlisted game, check if the score
    // state changed since our last push; if so, send a silent update.
    let checked = 0, sent = 0;
    for (const g of scores || []) {
      const gameId = String(g.gamePk);
      if (!watchedGameIds.has(gameId)) continue;
      const isLive = g.status === 'Live' && !g.isFinal;
      if (!isLive) continue;
      checked++;

      const half = g.inningHalf ? (g.inningHalf === 'Top' ? 'Top' : 'Bot') : '';
      const stateStr = `${g.awayScore ?? '-'}-${g.homeScore ?? '-'}|${half}${g.inning ?? ''}|${g.outs ?? ''}`;

      // Skip if nothing has changed since the last push for this game
      const { data: prevRow } = await sb.from('live_push_state').select('last_state').eq('game_id', gameId).maybeSingle();
      if (prevRow?.last_state === stateStr) continue;

      const userIds = watchers[gameId] || [];
      if (!userIds.length) continue;

      const title = `${g.awayAbbr || g.away} ${g.awayScore ?? 0} - ${g.homeScore ?? 0} ${g.homeAbbr || g.home}`;
      const body = `${half ? half + ' ' : ''}${g.inning ? g.inning + (g.inning===1?'st':g.inning===2?'nd':g.inning===3?'rd':'th') : ''}${g.outs != null ? ` · ${g.outs} out` : ''}`.trim() || 'Live update';

      try {
        await fetch(`${origin}/api/push/targeted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, body, url: '/', tag: `vv-live-${gameId}`,
            userIds, trigger: 'live-score', silent: true,
          }),
        });
        sent++;
        await sb.from('live_push_state').upsert({ game_id: gameId, last_state: stateStr, updated_at: new Date().toISOString() }, { onConflict: 'game_id' });
      } catch {}
    }

    return NextResponse.json({ checked, sent, graded: gradedCount, watchedGames: watchedGameIds.size });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
