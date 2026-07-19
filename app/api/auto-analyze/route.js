import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gradeCompletedGames, gradeUserAltPicks, regradeHistoricalPicks, regradeHistoricalAltPicks, invalidateWrongSportAnalyses } from '@/lib/grading';
import { isWeekdayOnlySlotSport, hasSlotSystem } from '@/lib/sports';
import { recordHeartbeat } from '@/lib/agentHeartbeat';
import { canonicalBase } from '@/lib/baseUrl';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Lazy init — prevents build-time throws
async function getSB() {
  const { createClient: cc } = await import('@supabase/supabase-js');
  return cc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// WNBA auto-analyzes on the server Monday–Friday only. On Saturday/Sunday,
// clients trigger analysis manually (the card shows an "Analyze Game" button),
// so the cron must NOT auto-analyze weekend WNBA games. Uses the game's own
// date. Other sports are unaffected. Returns true if this game should be
// EXCLUDED from server auto-analysis for the weekend-WNBA rule.
function isWeekendWNBA(g) {
  // Registry-driven: any sport flagged slotWeekdaysOnly gets this rule, so a
  // future sport with the same weekday-only behavior inherits it by config
  // rather than needing this function edited.
  if (!isWeekdayOnlySlotSport(g.sport)) return false;
  const d = g.rawTime ? new Date(g.rawTime) : (g.date ? new Date(g.date + 'T12:00:00') : new Date());
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

// Checks whether EVERY game that needs analysis today has a result yet,
// and if so — and we haven't already notified for this date — sends a
// ONE-TIME broadcast push to every subscribed client: "today's slate is
// ready." This is what lets clients know they can open the app and find
// every pick already sitting there, without them needing to trigger or
// wait on anything themselves.
async function checkAndNotifySlateComplete(sb, date, base) {
  try {
    const gamesRes = await fetch(`${base}/api/today?date=${date}`, { cache: 'no-store' });
    if (!gamesRes.ok) return;
    const { games } = await gamesRes.json();
    if (!games?.length) return;

    const now = new Date();
    // A game "needs analysis" if it's a slotted MLB/NBA/WNBA/NFL game (has a
    // REAL PUBLIC/VEGAS slot from an admin-saved pattern) or a genuine
    // no-slot sport (Tennis/CBB), and hasn't already started. WNBA is NOT a
    // no-slot sport — it needs its own admin pattern just like MLB/NBA/NFL;
    // the difference is only that weekend WNBA never auto-analyzes at all
    // (handled by isWeekendWNBA below), regardless of whether a pattern
    // exists. A WNBA game with slot:'WNBA' (the fallback when no pattern has
    // been saved yet) does NOT count as slotted — only real 'PUBLIC'/'VEGAS'
    // values (assigned once an admin saves a pattern) do.
    const hasRealSlot = g => g.slot === 'PUBLIC' || g.slot === 'VEGAS';
    const needsAnalysis = games.filter(g => {
      if (g.rawTime && new Date(g.rawTime) <= now) return false; // started/locked, doesn't block completion
      if (isWeekendWNBA(g)) return false; // weekend WNBA is client-triggered, not auto
      if (!hasSlotSystem(g.sport)) return true; // genuine no-slot sport (registry-driven)
      return hasRealSlot(g);
    });
    if (!needsAnalysis.length) return; // nothing to analyze today at all yet (e.g. no slot pattern saved)

    const { data: rows } = await sb.from('game_analyses').select('away, home, sport, slot').eq('date', date);
    const analyzedKeys = new Set((rows || []).map(r => `${r.away}|${r.home}|${r.sport}`));

    // Group the day's needs-analysis games by sport, so each sport's slate can
    // complete — and notify — independently ("All NBA plays are ready" fires
    // when NBA is done, separately from MLB/CFB/etc.).
    const bySport = {};
    for (const g of needsAnalysis) (bySport[g.sport] = bySport[g.sport] || []).push(g);

    // Which (date, sport) completions have we already broadcast? Keyed per
    // sport so each fires exactly once per day, not every cron cycle.
    const { data: sentRows } = await sb.from('slate_complete_notifications').select('sport').eq('date', date);
    const alreadySent = new Set((sentRows || []).map(r => r.sport));

    let notifiedGames = 0;
    for (const [sport, sportGames] of Object.entries(bySport)) {
      if (alreadySent.has(sport)) continue; // already announced this sport today
      const allDone = sportGames.every(g => analyzedKeys.has(`${g.away}|${g.home}|${g.sport}`));
      if (!allDone) continue; // this sport still has games pending — wait

      const n = sportGames.length;
      try {
        await fetch(`${base}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `✅ ${sport} Plays Are Ready`,
            body: `All ${n} ${sport} game${n === 1 ? '' : 's'} analyzed — open the app to see today's ${sport} plays.`,
            url: '/dashboard',
            // Distinct tag per sport per day so MLB's and NBA's alerts don't
            // replace each other on the device.
            tag: `vv-slate-complete-${date}-${sport}`,
            adminKey: process.env.ADMIN_SECRET_KEY,
          }),
        });
        // Mark THIS sport done for THIS date — the composite (date, sport) key
        // makes it idempotent so it never re-fires on later cron cycles.
        await sb.from('slate_complete_notifications').upsert(
          { date, sport, notified_at: new Date().toISOString() },
          { onConflict: 'date,sport' }
        );
        notifiedGames += n;
      } catch {}
    }

    // Notification Agent heartbeat — record when we actually broadcast something.
    if (notifiedGames > 0) {
      await recordHeartbeat(sb, 'notification', { status: 'ok', detail: `Sent per-sport "plays ready" broadcast for ${date}`, count: notifiedGames });
    }
  } catch {}
}


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

  const snap = (() => { try { return JSON.parse(existing.game_snapshot || '{}'); } catch { return {}; } })();
  const result = (() => { try { return JSON.parse(existing.result || '{}'); } catch { return {}; } })();
  const summary = result.summary || {};

  // ── MATERIAL CHANGE DETECTION — runs FIRST, ALWAYS, regardless of how far
  // out the game is or how recently it was checked. This is what "tracking
  // all day up until game time" actually means: a pitcher swap, injury news,
  // lineup posting, or real line movement must trigger a re-analysis the
  // moment it's detected — never sit unnoticed for hours just because the
  // game itself is still far away. Only a brief thrash-guard (60 sec) applies,
  // purely to avoid double-firing if the cron overlaps itself.
  const justChecked = minSince < 1; // under a minute — avoid double-fire only

  if (!justChecked) {
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
  }

  // ── Everything below only applies to PURE periodic refreshes (nothing
  // material changed) — these ARE throttled by distance to game time, since
  // there's no new information to react to and we want to control API cost.

  // Each game refreshes on its OWN schedule based on how close it is to start.
  let minsToStart = Infinity;
  if (game.rawTime) {
    minsToStart = (new Date(game.rawTime) - Date.now()) / 60000;
  }

  // FINAL LOCK-IN WINDOW: 25–75 min before start. Always refresh once in this
  // window if we haven't analyzed in the last 20 min.
  if (minsToStart <= 75 && minsToStart > 20 && minSince >= 20) {
    return { yes: true, reason: 'Final lock-in window (lineups confirmed, closing line)' };
  }

  // FAR-OUT GAMES: more than 10 hours away — no PERIODIC refresh needed this
  // early (material changes above already would have caught anything real).
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

  // ── STABILITY CHECKS ─────────────────────────────────────────────────────

  // Analyzed very recently (within 20 min) — stable, never thrash
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
async function analyzeGame(game, base) {
  // base comes from the caller; canonicalBase() is the safety net. NEVER fall
  // back to VERCEL_URL — that's the deployment-unique host behind Deployment
  // Protection, whose /api/* answers with the Vercel SSO HTML page (see
  // lib/baseUrl.js for the full story).
  const target = base || canonicalBase();
  const res = await fetch(`${target}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
  });
  if (!res.ok) throw new Error(`generate returned ${res.status}`);
  return res.json();
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
// Selective notifications — only ping watchlisted users on material events.
async function notifyWatchlisted(results, sb, base) {
  const isNotifyWorthy = (reason = '') => {
    const r = reason.toLowerCase();
    return r.includes('pitcher changed') || r.includes('starter confirmed') ||
      r.includes('lineup confirmed') || r.includes('injury') || r.includes('trell') ||
      r.includes('line moved') || r.includes('lock-in');
  };
  const notifyEvents = results.filter(r => r.status === 'ok' && isNotifyWorthy(r.reason));
  if (!notifyEvents.length) return;
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
      if (!watchers.length) continue;
      const matchup = `${ev.game.away} @ ${ev.game.home}`;
      const r = ev.reason.toLowerCase();
      let title, bodyMsg;
      if (r.includes('lock-in')) {
        const pick = ev.result?.summary ? `${ev.result.summary.pick} ${ev.result.summary.betType}` : 'Play locked';
        title = `🔒 BET NOW — ${matchup}`; bodyMsg = `${pick} — lineups confirmed, play is locked.`;
      } else if (r.includes('pitcher') || r.includes('starter')) {
        title = `🔄 Pitcher Update — ${matchup}`; bodyMsg = ev.reason;
      } else if (r.includes('lineup')) {
        title = `📋 Lineup Confirmed — ${matchup}`; bodyMsg = 'Final lineups posted. Play updated.';
      } else if (r.includes('injury')) {
        title = `🚨 Injury Update — ${matchup}`; bodyMsg = 'Injury report changed. Play updated.';
      } else if (r.includes('trell')) {
        title = `⚠️ Trell Rule — ${matchup}`; bodyMsg = 'Key player status changed. Play updated.';
      } else if (r.includes('line moved')) {
        title = `📊 Sharp Money — ${matchup}`; bodyMsg = ev.reason;
      } else {
        title = `🔄 Updated — ${matchup}`; bodyMsg = ev.reason;
      }
      await fetch(`${base}/api/push/targeted`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: bodyMsg, url: '/', tag: `vv-${gameId}`, userIds: watchers, trigger: 'cron' }),
      });
    } catch {}
  }
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const isCronCall = req.headers.get('x-vv-cron') === '1' || req.headers.get('x-vercel-cron') != null;
    const body = await req.json().catch(() => ({}));
    let isAuthorized =
      isCronCall ||
      (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
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
    // canonicalBase — never the request origin or VERCEL_URL: under a cron
    // those are the SSO-protected deployment-unique host (see lib/baseUrl.js).
    const base = body.base || canonicalBase(req);
    const gamesRes = await fetch(`${base}/api/today?date=${date}`, { cache: 'no-store' });
    if (!gamesRes.ok) {
      const body_txt = await gamesRes.text().catch(() => '');
      return NextResponse.json({ error: `Could not fetch slate from ${base}/api/today (HTTP ${gamesRes.status}). ${body_txt.slice(0,100)}` }, { status: 200 });
    }
    // Guard against a 200 that ISN'T JSON (e.g. a redirect chased to an auth
    // or error page) — name the real problem instead of dying on JSON.parse
    // with an opaque "Unexpected token '<'".
    if (!(gamesRes.headers.get('content-type') || '').includes('application/json')) {
      return NextResponse.json({ error: `Slate fetch from ${base}/api/today returned non-JSON (content-type: ${gamesRes.headers.get('content-type')}). base URL is likely wrong or behind auth.` }, { status: 200 });
    }
    const { games } = await gamesRes.json();
    // Slate Sync heartbeat — the data pipeline reached the providers and got a
    // real slate back (or a real empty one). Either way, it's alive.
    await recordHeartbeat(sb, 'slate-sync', { status: 'ok', detail: `Fetched slate for ${date}`, count: games?.length || 0 });
    if (!games?.length) return NextResponse.json({ message: 'No games on the slate today', analyzed: 0 }, { status: 200 });

    // Grade any completed games server-side — independent of watchlist status
    // or whether any client is open. Fire-and-forget so it never blocks or
    // slows down the analysis response.
    gradeCompletedGames(sb, date, base).catch(() => {});
    gradeUserAltPicks(sb, date, base).catch(() => {});
    regradeHistoricalPicks(sb).catch(() => {});
    regradeHistoricalAltPicks(sb).catch(() => {});
    // Outcome Tracker heartbeat — grading ran this cycle (it self-decides
    // whether there are finals to grade; the heartbeat marks the agent alive).
    await recordHeartbeat(sb, 'outcome-tracker', { status: 'ok', detail: 'Checked finals & applied grades', count: 0 });
    // Awaited (not fire-and-forget) so any invalidated games are already gone
    // from game_analyses before the "already analyzed" check below runs —
    // they get picked up and re-analyzed with corrected code in THIS same
    // cron cycle, not delayed to the next one.
    await invalidateWrongSportAnalyses(sb, date);

    // 2. Build the slate. Normal mode: slotted MLB/NBA/WNBA/NFL games (real
    //    PUBLIC/VEGAS assignment from an admin-saved pattern) not yet started.
    //    forceAll mode ALSO includes genuine no-slot sports (Tennis) AND lets
    //    an admin override WNBA's slot requirement on demand.
    const now = new Date();
    const forceAllMode = body.forceAll === true;
    const hasRealSlot = g => g.slot === 'PUBLIC' || g.slot === 'VEGAS';
    const slateGames = games.filter(g => {
      if (g.rawTime && new Date(g.rawTime) <= now) return false; // already started
      // Weekend WNBA is client-triggered, not server-auto — exclude from the
      // normal cron. forceAll (explicit admin "analyze everything now") still
      // includes it, so an admin can override on demand.
      if (isWeekendWNBA(g) && !forceAllMode) return false;
      if (!hasSlotSystem(g.sport)) return true; // genuine no-slot sport, always eligible (registry-driven)
      if (g.sport === 'WNBA') {
        // WNBA needs a real admin-saved pattern, same as MLB/NBA/NFL — UNLESS
        // this is an explicit forceAll admin override, which bypasses the
        // slot requirement entirely (same behavior as Tennis in that mode).
        return hasRealSlot(g) || forceAllMode;
      }
      if (!g.slot || g.slot === 'NONE') return false; // slotted sports need a slot
      return true;
    }).map(g => {
      // Any genuine no-slot sport (Tennis, CBB, and future ones — registry-
      // driven, not a hardcoded list) uses its sport name as the slot key when
      // it doesn't already carry one. WNBA under forceAll without a saved
      // pattern also needs a slot key to key off of.
      if ((!hasSlotSystem(g.sport) || g.sport === 'WNBA') && !g.slot) return { ...g, slot: g.sport };
      return g;
    });
    if (!slateGames.length) {
      // Precise diagnostic so we know WHY nothing is eligible
      const total = games.length;
      const started = games.filter(g => g.rawTime && new Date(g.rawTime) <= now).length;
      const withSlot = games.filter(g => g.slot === 'PUBLIC' || g.slot === 'VEGAS').length;
      const noSlotSports = games.filter(g => !hasSlotSystem(g.sport)).length;
      const bySport = {};
      games.forEach(g => { bySport[g.sport] = (bySport[g.sport]||0)+1; });
      return NextResponse.json({
        message: `0 eligible. Slate has ${total} games (${JSON.stringify(bySport)}). ${withSlot} have a slot assigned, ${started} already started, ${noSlotSports} no-slot sports. ${withSlot===0 ? '→ No slot pattern set for today — set the Public/Vegas pattern in Settings first.' : ''}`,
        analyzed: 0,
        diagnostic: { total, withSlot, started, noSlotSports, bySport, date },
      }, { status: 200 });
    }

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
      checkAndNotifySlateComplete(sb, date, base).catch(() => {});
      return NextResponse.json({
        message: 'All plays confirmed — no re-analysis needed',
        analyzed: 0, skipped: skipped.length, date,
      });
    }

    // Build the analysis worker (runs the batches + publishes each result).
    const runAnalysis = async (items = toAnalyze) => {
      const results = [];
      for (let i = 0; i < items.length; i += 3) {
        const batch = items.slice(i, i + 3);
        await Promise.allSettled(batch.map(async ({ game, key, reason }) => {
          try {
            const result = await analyzeGame(game, base);
            await sb.from('game_analyses').upsert({
              game_key: key, game_id: game.id, date, slot: game.slot,
              sport: game.sport, away: game.away, home: game.home,
              result: JSON.stringify({ ...result, updatedAt: new Date().toISOString() }),
              game_snapshot: buildSnapshot(game),
              auto_update_reason: reason,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'game_key' });
            results.push({ key, status: 'ok', reason, game, result });
          } catch (e) {
            results.push({ key, status: 'error', error: e.message, reason });
          }
        }));
      }
      return results;
    };

    // FORCE-ALL: respond immediately, process in the background. A full slate
    // (13+ games with AI stages) exceeds the 300s request limit if awaited —
    // which is why the button appeared to "not work" (function died before
    // responding). Now the button gets an instant answer and the analysis
    // continues server-side, each game publishing as it finishes.
    if (forceAll) {
      runAnalysis()
        .then(rs => notifyWatchlisted(rs, sb, base))
        .then(() => checkAndNotifySlateComplete(sb, date, base))
        .catch(() => {});
      return NextResponse.json({
        analyzed: toAnalyze.length,
        message: `Re-analyzing ${toAnalyze.length} games in the background — refresh the slate in 2-3 min as each completes.`,
        date,
      });
    }

    // 5. Non-force path (the every-30-min cron): cap how many games we analyze
    // per invocation so we NEVER approach the 300s function timeout. A full
    // slate of 13+ games at ~15-20s each would exceed 300s and the function
    // would die mid-run, leaving games unanalyzed. We prioritize the games
    // CLOSEST to start (most time-sensitive: lineups, scratches, closing line)
    // and let the rest roll to the next cron cycle 30 min later.
    const MAX_PER_CRON = 8;
    let cronBatch = toAnalyze;
    if (toAnalyze.length > MAX_PER_CRON) {
      cronBatch = [...toAnalyze].sort((a, b) => {
        const at = a.game.rawTime ? new Date(a.game.rawTime).getTime() : Infinity;
        const bt = b.game.rawTime ? new Date(b.game.rawTime).getTime() : Infinity;
        return at - bt; // soonest first
      }).slice(0, MAX_PER_CRON);
    }

    const results = await runAnalysis(cronBatch);

    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed    = results.filter(r => r.status === 'error').length;
    const deferred  = toAnalyze.length - cronBatch.length;

    // Analysis + Scam Hunter heartbeats. Analysis is 'idle' (healthy, nothing
    // to do) when there was nothing eligible this cycle, 'ok' when it worked,
    // 'error' only if every attempt failed. Scam Hunter's count is the subset
    // of analyzed games that were on a Vegas slot (its actual workload).
    const vegasDone = results.filter(r => r.status === 'ok' && r.game?.slot === 'VEGAS').length;
    await recordHeartbeat(sb, 'analysis', {
      status: cronBatch.length === 0 ? 'idle' : (succeeded === 0 && failed > 0 ? 'error' : 'ok'),
      detail: cronBatch.length === 0 ? 'No games eligible this cycle' : `${succeeded} analyzed, ${failed} failed, ${deferred} deferred`,
      count: succeeded,
    });
    await recordHeartbeat(sb, 'scam-hunter', {
      status: vegasDone > 0 ? 'ok' : 'idle',
      detail: vegasDone > 0 ? `Hunted ${vegasDone} Vegas-slot game(s)` : 'No Vegas-slot games this cycle',
      count: vegasDone,
    });

    await notifyWatchlisted(results, sb, base);
    await checkAndNotifySlateComplete(sb, date, base);

    // Keep the Top Play of the Day generated server-side so it's ready before
    // anyone opens the app. GET self-generates and caches on a miss (and is a
    // cheap no-op on a hit), so this fire-and-forget call is all it takes to
    // remove Top Play's old dependency on a client visiting the endpoint.
    fetch(`${base}/api/topplay?date=${date}`, { cache: 'no-store', headers: { 'x-internal': '1' } }).catch(() => {});

    return NextResponse.json({
      success: true,
      date,
      analyzed: succeeded,
      failed,
      deferred, // games rolled to the next cron cycle to stay under the timeout
      skipped: skipped.length,
    });

  } catch (err) {
    console.error('[auto-analyze]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: cron calls GET — proxy to POST; or return stored analyses
export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  // Vercel cron requests carry the `x-vercel-cron` header. We treat the call
  // as a cron trigger if EITHER that header is present OR the CRON_SECRET matches.
  // This is critical: Vercel only sends the Authorization: Bearer <CRON_SECRET>
  // header when CRON_SECRET is set in env. If it isn't set, the old check failed
  // and the cron silently fell through to "just return stored analyses" —
  // meaning the model never ran server-side. Detecting the header fixes that.
  const hasCronHeader = req.headers.get('x-vercel-cron') != null;
  const secretMatches = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isCron = hasCronHeader || secretMatches;

  // US Central date — slot patterns and the game slate are keyed by CT, NOT
  // UTC. Using UTC here meant that during US evening hours (when UTC has
  // already rolled to tomorrow) the cron looked up TOMORROW's slot pattern,
  // found no slotted games, and analyzed nothing. This is why analysis only
  // appeared to happen when a client was on the app (the client used CT).
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const ctDate = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

  if (isCron) {
    // canonicalBase, NOT new URL(req.url).origin: Vercel invokes crons on the
    // deployment-unique URL, which sits behind Deployment Protection. Using it
    // as the self-fetch base made every scheduled run die on the SSO HTML page
    // ("Unexpected token '<'") — analysis/grading only ran when a human was on
    // the site. canonicalBase always resolves to a stable public host.
    const origin = canonicalBase(req);
    return POST(new Request(`${origin}/api/auto-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': authHeader, 'x-vv-cron': '1' },
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
