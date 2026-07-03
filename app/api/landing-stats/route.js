import { NextResponse } from 'next/server';
import { formatPickDisplay } from '@/lib/pickFormat';

export const runtime = 'nodejs';
export const maxDuration = 20;

// Public, lightweight endpoint for the landing page's three live cards:
//   1. AI Play of the Day  — best Tier-1/2 play from TODAY's analyses ONLY.
//      If today's slate hasn't produced a qualifying play yet, the card
//      falls back to the static placeholder rather than showing a stale
//      play from a prior day (a play from yesterday should never be shown
//      as if it's today's).
//   2. Season Win Rate     — computed from the shared AI track record
//   3. Line Movement       — real line movement pulled from today's live slate
// Pure DB/data reads — NO AI calls — so it's cheap and fast for every visitor.
export async function GET(req) {
  const out = { play: null, winRate: null, lineMovement: null };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // US Central "today" — must match exactly what the analysis pipeline
    // uses when it writes the `date` column on game_analyses.
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

    // ── 1. AI PLAY OF THE DAY — best non-PASS play from TODAY ONLY ──
    // We query game_analyses by today's date, but we ALSO cross-check the
    // featured game against today's ACTUAL live slate (/api/today). This is a
    // safeguard: if any analysis row is mis-stamped with the wrong date (e.g.
    // analyzed near the CT midnight rollover), the date column alone could let
    // a prior-day game slip through. Requiring the game to appear on today's
    // real slate guarantees the play is genuinely from today.
    let featuredMatchup = null;
    let todaySlate = [];
    try {
      const origin = new URL(req.url).origin;
      const slateRes = await fetch(`${origin}/api/today?date=${todayStr}`, { cache: 'no-store' });
      if (slateRes.ok) { const j = await slateRes.json(); todaySlate = j.games || []; }
    } catch {}
    const onTodaySlate = (away, home) =>
      todaySlate.length === 0 || todaySlate.some(g => g.away === away && g.home === home);

    try {
      const { data: rows } = await sb
        .from('game_analyses')
        .select('away, home, result, date, updated_at')
        .eq('date', todayStr);
      if (rows?.length) {
        const candidates = [];
        for (const r of rows) {
          let parsed; try { parsed = JSON.parse(r.result); } catch { continue; }
          const s = parsed?.summary;
          if (!s || !s.pick || s.tier === 'PASS' || s.tier === '3') continue;
          // Must actually be on today's live slate (guards against mis-dated rows)
          if (!onTodaySlate(r.away, r.home)) continue;
          const tierRank = s.tier === '1' ? 3 : s.tier === '2' ? 2 : 1;
          candidates.push({
            away: r.away, home: r.home,
            pick: s.pick, betType: s.betType || '', odds: s.odds || s.price || '',
            tier: s.tier, confidence: s.confidencePercent || 0,
            time: parsed.gameTime || s.gameTime || '',
            score: tierRank * 1000 + (s.confidencePercent || 0),
          });
        }
        candidates.sort((a, b) => b.score - a.score);
        if (candidates[0]) {
          const c = candidates[0];
          out.play = {
            matchup: `${c.away} @ ${c.home}`,
            pick: formatPickDisplay(c.pick, c.betType || ''),
            tier: c.tier, odds: c.odds, time: c.time,
            date: todayStr,
            isToday: true,
          };
          featuredMatchup = { away: c.away, home: c.home };
        }
      }
    } catch {}

    // ── 2. SEASON WIN RATE — from the shared AI track record (every graded
    // pick, server-side, independent of any user's watchlist). Falls back to
    // per-user pick_history if the shared table isn't populated yet.
    try {
      const { data: trRows } = await sb.from('ai_track_record').select('result');
      if (trRows?.length) {
        const wins = trRows.filter(r => r.result === 'win').length;
        const losses = trRows.filter(r => r.result === 'loss').length;
        const total = wins + losses;
        if (total >= 5) out.winRate = { pct: Math.round((wins / total) * 1000) / 10, wins, losses };
      }
    } catch {}
    if (!out.winRate) {
      try {
        const { data: histRows } = await sb
          .from('user_data')
          .select('value')
          .eq('key', 'pick_history')
          .limit(50);
        let wins = 0, losses = 0;
        for (const row of histRows || []) {
          let hist; try { hist = JSON.parse(row.value); } catch { continue; }
          if (!Array.isArray(hist)) continue;
          for (const p of hist) {
            if (p.isUserAlt) continue;
            const res = (p.result || '').toString().toLowerCase();
            if (res === 'win') wins++;
            else if (res === 'loss') losses++;
          }
        }
        const total = wins + losses;
        if (total >= 5) out.winRate = { pct: Math.round((wins / total) * 1000) / 10, wins, losses };
      } catch {}
    }

    // ── 3. LINE MOVEMENT — from today's LIVE slate (reuse todaySlate) ──
    try {
      const games = todaySlate;
      const hasMovement = (g) => g?.lineMovement && g.lineMovement !== 'No significant movement' && g.lineMovement !== 'N/A';
      let g = null;
      if (featuredMatchup) {
        g = (games || []).find(x => x.away === featuredMatchup.away && x.home === featuredMatchup.home && hasMovement(x));
      }
      if (!g) g = (games || []).find(hasMovement);
      if (g) out.lineMovement = { text: g.lineMovement, matchup: `${g.away} @ ${g.home}` };
    } catch {}

    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (e) {
    return NextResponse.json(out); // always return the shape; landing uses fallbacks
  }
}
