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

  // Analyzed within 30 min with no material changes — stable
  if (minSince < 30) return { yes: false, reason: 'Recently analyzed — stable' };

  // High confidence Tier 1 with no material changes — keep it
  const confPct = summary.confidencePercent || 0;
  if (summary.tier === '1' && confPct >= 75 && minSince < 180)
    return { yes: false, reason: 'High-confidence Tier 1 — play confirmed' };

  // Low confidence or Pass — try to improve with fresh data
  if ((confPct < 60 || summary.tier === '3') && minSince >= 60)
    return { yes: true, reason: 'Low confidence — refining with updated data' };

  // Periodic refresh (every 3 hours) — keeps data fresh throughout the day
  if (minSince >= 180) return { yes: true, reason: 'Periodic refresh (3hr)' };

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
    const isAuthorized =
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      body.adminKey === process.env.ADMIN_SECRET_KEY;
    if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const date = body.date || new Date().toISOString().split('T')[0];
    const sb = await getSB();

    // 1. Fetch today's full game slate with all live data
    const reqUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const base = `${reqUrl.protocol}//${reqUrl.host}`;
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
    for (const game of slateGames) {
      const key = `${game.id}-${game.slot}`;
      const existing = existingMap[key] || null;
      const decision = shouldReanalyze(game, existing);
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
          results.push({ key, status: 'ok', reason });
        } catch (e) {
          results.push({ key, status: 'error', error: e.message, reason });
        }
      }));
    }

    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed    = results.filter(r => r.status === 'error').length;

    // 6. Push notification only when analyses are new/updated
    if (succeeded > 0) {
      try {
        await fetch(`${base}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '✅ Vegas Vault AI — Plays Updated',
            body: `${succeeded} game${succeeded !== 1 ? 's' : ''} auto-analyzed. All plays current.`,
            url: '/',
            tag: 'vv-auto-analysis',
            adminKey: process.env.ADMIN_SECRET_KEY,
          }),
        });
      } catch {}
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

  if (isCron) {
    const date = new Date().toISOString().split('T')[0];
    return POST(new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': authHeader },
      body: JSON.stringify({ date }),
    }));
  }

  // Client polling — return stored analyses for the date
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
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
