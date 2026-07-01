import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Lazy init — prevents build-time throws
async function getSB() {
  const { createClient: cc } = await import('@supabase/supabase-js');
  return cc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── PLAY STABILITY — should we re-analyze this game? ─────────────────────────
// Acts like a professional bettor: refine until confirmed, then lock it in.
//
// Re-analyze when:
//   - No existing analysis
//   - Starting pitcher changed or confirmed from TBD
//   - Lineups newly posted
//   - Injury report changed
//   - DraftKings line moved 10+ points since last analysis
//   - Play has low confidence and it's been 60+ min
//   - It's been 3+ hours since last analysis (periodic refresh)
//
// KEEP existing play when:
//   - Game has already started (locked forever)
//   - Analyzed within last 30 min with no material changes
//   - Play is HIGH confidence Tier 1 with no material changes
//
function shouldReanalyze(game, existing) {
  // No existing analysis — always analyze
  if (!existing) return { yes: true, reason: 'First analysis' };

  // Game started — locked, never re-analyze
  if (game.rawTime) {
    const gameStart = new Date(game.rawTime);
    if (gameStart <= new Date()) return { yes: false, reason: 'Game started — locked' };
  }

  const lastAnalyzed = new Date(existing.updated_at || existing.created_at || 0);
  const minSince = (Date.now() - lastAnalyzed) / 60000;

  // ── PER-GAME TIME WINDOWING ───────────────────────────────────────────────
  // Each game refreshes on its OWN schedule based on how close it is to start.
  // The closer to game time, the more often we refresh — because that's when
  // lineups, scratches, and sharp money actually move. Far-out games barely
  // change, so we leave them alone to save API cost.
  let minsToStart = Infinity;
  if (game.rawTime) {
    minsToStart = (new Date(game.rawTime) - Date.now()) / 60000;
  }

  // FINAL LOCK-IN WINDOW: 25–75 min before start. This is the single most
  // important update — lineups are confirmed, late scratches are known, and
  // the closing line is forming. Always refresh once in this window if we
  // haven't analyzed in the last 20 min.
  if (minsToStart <= 75 && minsToStart > 20 && minSince >= 20) {
    return { yes: true, reason: 'Final lock-in window (lineups confirmed, closing line)' };
  }

  // FAR-OUT GAMES: more than 10 hours away — data barely changes this early.
  // Skip unless we have no analysis yet (handled above) to save API cost.
  if (minsToStart > 600 && minSince < 360) {
    return { yes: false, reason: 'Game far out — minimal change expected' };
  }

  // Define the refresh cadence based on proximity to game time:
  //   • 0–2 hrs out:  refresh every 30 min  (high-change window)
  //   • 2–5 hrs out:  refresh every 60 min  (lineups starting to firm up)
  //   • 5–10 hrs out: refresh every 120 min (occasional refresh)
  let cadenceMin = 180; // default 3 hours (matches old behavior for safety)
  if (minsToStart <= 120) cadenceMin = 30;
  else if (minsToStart <= 300) cadenceMin = 60;
  else if (minsToStart <= 600) cadenceMin = 120;

  // Analyzed within 30 min — skip unless something changed materially
  const snap = (() => { try { return JSON.parse(existing.game_snapshot || '{}'); } catch { return {}; } })();
  const result = (() => { try { return JSON.parse(existing.result || '{}'); } catch { return {}; } })();
  const summary = result.summary || {};

  // ── MATERIAL CHANGE DETECTION ────────────────────────────────────────────

  // 1. Starting pitcher changed
  if (snap.awayPitcher && game.awayPitcher &&
      snap.awayPitcher !== 'TBD' && game.awayPitcher !== 'TBD' &&
      snap.awayPitcher !== game.awayPitcher)
    return { yes: true, reason: `Away pitcher changed: ${snap.awayPitcher} → ${game.awayPitcher}` };

  if (snap.homePitcher && game.homePitcher &&
      snap.homePitcher !== 'TBD' && game.homePitcher !== 'TBD' &&
      snap.homePitcher !== game.homePitcher)
    return { yes: true, reason: `Home pitcher changed: ${snap.homePitcher} → ${game.homePitcher}` };

  // 2. Pitcher confirmed from TBD
  if (snap.awayPitcher === 'TBD' && game.awayPitcher && game.awayPitcher !== 'TBD')
    return { yes: true, reason: `Away starter confirmed: ${game.awayPitcher}` };
  if (snap.homePitcher === 'TBD' && game.homePitcher && game.homePitcher !== 'TBD')
    return { yes: true, reason: `Home starter confirmed: ${game.homePitcher}` };

  // 3. Lineup confirmed (went from unposted to actual lineup)
  const awayLineupNow = (game.awayLineup?.length || 0) > 20 && game.awayLineup !== 'Not yet posted';
  const homeLineupNow = (game.homeLineup?.length || 0) > 20 && game.homeLineup !== 'Not yet posted';
  if (awayLineupNow && !snap.awayLineupConfirmed)
    return { yes: true, reason: `${game.away} lineup confirmed` };
  if (homeLineupNow && !snap.homeLineupConfirmed)
    return { yes: true, reason: `${game.home} lineup confirmed` };

  // 4. Injury report changed
  if (snap.injuries && game.injuries && snap.injuries !== game.injuries &&
      game.injuries !== 'None reported' && game.injuries !== 'Injury data unavailable')
    return { yes: true, reason: 'Injury report updated' };

  // 5. Significant DraftKings line movement since last analysis
  const prevML  = parseInt((snap.dkAwayML || snap.awayML || '0').toString().replace(/[^-\d]/g, ''));
  const currML  = parseInt((game.dkAwayML || game.awayML || '0').toString().replace(/[^-\d]/g, ''));
  if (!isNaN(prevML) && !isNaN(currML) && Math.abs(currML - prevML) >= 10)
    return { yes: true, reason: `DraftKings line moved ${Math.abs(currML - prevML)} points` };

  // ── STABILITY CHECKS ─────────────────────────────────────────────────────

  // Analyzed very recently (within 20 min) — always stable, never thrash
  if (minSince < 20) return { yes: false, reason: 'Just analyzed — stable' };

  // High confidence Tier 1 with no material changes — keep it, but still allow
  // the final lock-in window (handled above) to refresh it one last time.
  const confPct = summary.confidencePercent || 0;
  if (summary.tier === '1' && confPct >= 75 && minSince < Math.max(cadenceMin, 120))
    return { yes: false, reason: 'High-confidence Tier 1 — play confirmed' };

  // Low confidence or Pass — try to improve with fresh data sooner
  if ((confPct < 60 || summary.tier === '3') && minSince >= Math.min(cadenceMin, 60))
    return { yes: true, reason: 'Low confidence — refining with updated data' };

  // Periodic refresh on the per-game cadence (30/60/120/180 min by proximity)
  if (minSince >= cadenceMin) return { yes: true, reason: `Periodic refresh (${cadenceMin}min cadence, ${Math.round(minsToStart)}min to start)` };

  return { yes: false, reason: 'No material changes' };
}

// ── BUILD GAME SNAPSHOT for change detection ──────────────────────────────────
function buildSnapshot(game) {
  return JSON.stringify({
    awayPitcher:       game.awayPitcher,
    homePitcher:       game.homePitcher,
    awayLineupConfirmed: (game.awayLineup?.length || 0) > 20 && game.awayLineup !== 'Not yet posted',
    homeLineupConfirmed: (game.homeLineup?.length || 0) > 20 && game.homeLineup !== 'Not yet posted',
    injuries:          game.injuries,
    dkAwayML:          game.dkAwayML,
    dkHomeML:          game.dkHomeML,
    awayML:            game.awayML,
    homeML:            game.homeML,
    total:             game.total,
    capturedAt:        new Date().toISOString(),
  });
}

// ── ANALYZE ONE GAME via the 4-stage engine ───────────────────────────────────
async function analyzeGame(game) {
  const reqUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const base = `${reqUrl.protocol}//${reqUrl.host}`;
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
  });
  if (!res.ok) throw new Error(`generate returned ${res.status}`);
  return res.json();
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const body = await req.json().catch(() => ({}));
    let isAuthorized =
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      body.adminKey === process.env.ADMIN_SECRET_KEY;

    // Allow an admin-triggered run (e.g. right after saving a slot pattern)
    // authenticated by the admin's own Supabase session — no secret needed
    // client-side. We verify the token resolves to the admin email.
    if (!isAuthorized && body.trigger === 'admin-pattern-save') {
      try {
        const token = body.token || authHeader.replace('Bearer ', '');
        if (token) {
          const sbAuth = await getSB();
          const { data: { user } } = await sbAuth.auth.getUser(token);
          if (user?.email === 'battlecortez@gmail.com') isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Default date to US Central (matches slot patterns + slate), not UTC.
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const ctDate = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;
    const date = body.date || ctDate;
    const sb = await getSB();

    // 1. Fetch today's full game slate with all live data.
    // Prefer the base URL passed from the cron (derived from the request
    // origin) so this works on Vercel without NEXT_PUBLIC_APP_URL set.
    const base = body.base
      || process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const gamesRes = await fetch(`${base}/api/today?date=${date}`, { cache: 'no-store' });
    if (!gamesRes.ok) throw new Error('Failed to fetch games');
    const { games } = await gamesRes.json();
    if (!games?.length) return NextResponse.json({ message: 'No games today', analyzed: 0 });

    // 2. Only consider games with slot assigned and not yet started
    const now = new Date();
    const slateGames = games.filter(g => {
      if (!g.slot || g.slot === 'NONE') return false;
      if (g.rawTime && new Date(g.rawTime) <= now) return false; // already started
      return true;
    });
    if (!slateGames.length) return NextResponse.json({ message: 'No pre-game slate games', analyzed: 0 });

    // 3. Load all existing analyses for today in one query
    const { data: existingRows } = await sb
      .from('game_analyses')
      .select('game_key, result, game_snapshot, updated_at, created_at')
      .eq('date', date);
    const existingMap = Object.fromEntries((existingRows || []).map(r => [r.game_key, r]));

    // 4. Decide which games to analyze
    const toAnalyze = [];
    const skipped   = [];
    const forceAll = body.forceAll === true; // admin: re-analyze the whole slate
    for (const game of slateGames) {
      const key = `${game.id}-${game.slot}`;
      const existing = existingMap[key] || null;
      // forceAll still respects the game-started lock (never re-analyze a live/final game)
      const started = game.rawTime && new Date(game.rawTime) <= new Date();
      const decision = forceAll
        ? (started ? { yes: false, reason: 'Game started — locked' } : { yes: true, reason: 'Admin force re-analyze' })
        : shouldReanalyze(game, existing);
      if (decision.yes) {
        toAnalyze.push({ game, key, reason: decision.reason });
      } else {
        skipped.push({ key, reason: decision.reason });
      }
    }

    if (!toAnalyze.length) {
      return NextResponse.json({
        message: 'All plays confirmed — no re-analysis needed',
        analyzed: 0, skipped: skipped.length, date,
      });
    }

    // 5. Analyze in batches of 3 (prevents timeout on large slates)
    const results = [];
    for (let i = 0; i < toAnalyze.length; i += 3) {
      const batch = toAnalyze.slice(i, i + 3);
      await Promise.allSettled(batch.map(async ({ game, key, reason }) => {
        try {
          const result = await analyzeGame(game);
          await sb.from('game_analyses').upsert({
            game_key:      key,
            game_id:       game.id,
            date,
            slot:          game.slot,
            sport:         game.sport,
            away:          game.away,
            home:          game.home,
            result:        JSON.stringify({ ...result, updatedAt: new Date().toISOString() }),
            game_snapshot: buildSnapshot(game),
            auto_update_reason: reason,
            updated_at:    new Date().toISOString(),
          }, { onConflict: 'game_key' });
          results.push({ key, status: 'ok', reason, game, result });
        } catch (e) {
          results.push({ key, status: 'error', error: e.message, reason });
        }
      }));
    }

    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed    = results.filter(r => r.status === 'error').length;

    // 6. SELECTIVE NOTIFICATIONS — only notify for genuinely important events.
    // A 30-min cron must NOT spam clients on every routine refresh. We only
    // notify watchlisted users when something they'd actually want to know
    // about happens to a game they're tracking.
    //
    // NOTIFY-WORTHY reasons (material, actionable):
    //   • Starting pitcher changed or confirmed
    //   • Lineup confirmed
    //   • Injury report changed
    //   • Trell Rule trigger
    //   • Significant line movement
    //   • Final lock-in window (the "BET NOW" moment)
    // NOT notify-worthy (routine, silent):
    //   • Periodic refresh, low-confidence refinement, first analysis
    const isNotifyWorthy = (reason = '') => {
      const r = reason.toLowerCase();
      return (
        r.includes('pitcher changed') ||
        r.includes('starter confirmed') ||
        r.includes('lineup confirmed') ||
        r.includes('injury') ||
        r.includes('trell') ||
        r.includes('line moved') ||
        r.includes('lock-in')
      );
    };

    const notifyEvents = results.filter(r => r.status === 'ok' && isNotifyWorthy(r.reason));

    if (notifyEvents.length > 0) {
      // Load all watchlists once so we only notify users tracking these games
      let watchRows = [];
      try {
        const { data } = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
        watchRows = data || [];
      } catch {}

      for (const ev of notifyEvents) {
        try {
          const gameId = ev.game?.id;
          const watchers = watchRows
            .filter(row => { try { return JSON.parse(row.value).includes(gameId); } catch { return false; } })
            .map(row => row.user_id);
          if (!watchers.length) continue; // nobody tracking this game — stay silent

          const matchup = `${ev.game.away} @ ${ev.game.home}`;
          const r = ev.reason.toLowerCase();
          let title, bodyMsg;
          if (r.includes('lock-in')) {
            const pick = ev.result?.summary ? `${ev.result.summary.pick} ${ev.result.summary.betType}` : 'Play locked';
            title = `🔒 BET NOW — ${matchup}`;
            bodyMsg = `${pick} — lineups confirmed, play is locked.`;
          } else if (r.includes('pitcher') || r.includes('starter')) {
            title = `🔄 Pitcher Update — ${matchup}`;
            bodyMsg = ev.reason;
          } else if (r.includes('lineup')) {
            title = `📋 Lineup Confirmed — ${matchup}`;
            bodyMsg = `Final lineups posted. Play updated.`;
          } else if (r.includes('injury')) {
            title = `🚨 Injury Update — ${matchup}`;
            bodyMsg = `Injury report changed. Play updated.`;
          } else if (r.includes('trell')) {
            title = `⚠️ Trell Rule — ${matchup}`;
            bodyMsg = `Key player status changed. Play updated.`;
          } else if (r.includes('line moved')) {
            title = `📊 Sharp Money — ${matchup}`;
            bodyMsg = ev.reason;
          } else {
            title = `🔄 Updated — ${matchup}`;
            bodyMsg = ev.reason;
          }

          await fetch(`${base}/api/push/targeted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title, body: bodyMsg, url: '/', tag: `vv-${gameId}`,
              userIds: watchers, trigger: 'cron',
            }),
          });
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      date,
      analyzed: succeeded,
      failed,
      skipped: skipped.length,
      details: results,
    });

  } catch (err) {
    console.error('[auto-analyze]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: cron calls GET — proxy to POST; or return stored analyses
export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // US Central date — slot patterns and the game slate are keyed by CT, NOT
  // UTC. Using UTC here meant that during US evening hours (when UTC has
  // already rolled to tomorrow) the cron looked up TOMORROW's slot pattern,
  // found no slotted games, and analyzed nothing. This is why analysis only
  // appeared to happen when a client was on the app (the client used CT).
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const ctDate = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

  if (isCron) {
    // Derive the absolute base URL from the incoming request so the server can
    // reach its own /api/today even when NEXT_PUBLIC_APP_URL isn't set.
    const origin = new URL(req.url).origin;
    return POST(new Request(`${origin}/api/auto-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': authHeader },
      body: JSON.stringify({ date: ctDate, base: origin }),
    }));
  }

  // Client polling — return stored analyses for the date
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || ctDate;
  try {
    const sb = await getSB();
    const { data, error } = await sb
      .from('game_analyses')
      .select('game_key, result, updated_at')
      .eq('date', date);
    if (error) throw error;
    const analyses = {};
    for (const row of data || []) {
      try {
        const parsed = JSON.parse(row.result);
        analyses[row.game_key] = { ...parsed, updatedAt: row.updated_at };
      } catch {}
    }
    return NextResponse.json({ analyses, date });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
