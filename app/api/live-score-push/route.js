import { NextResponse } from 'next/server';

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
// Runs on its own frequent cron (every 2 min — see vercel.json) since score
// changes need much tighter polling than the 30-min analysis cron.
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
    if (!watchedGameIds.size) return NextResponse.json({ checked: 0, sent: 0, note: 'No watchlisted games' });

    // 2. Fetch today's live scores (CT date, matching the rest of the app)
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;
    const scoresRes = await fetch(`${origin}/api/livescores?date=${todayStr}`, { cache: 'no-store' });
    if (!scoresRes.ok) return NextResponse.json({ checked: 0, sent: 0, error: 'livescores fetch failed' });
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

    return NextResponse.json({ checked, sent, watchedGames: watchedGameIds.size });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
