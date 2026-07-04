import { NextResponse } from 'next/server';
import { formatPickDisplay } from '@/lib/pickFormat';
import { isCurrentSeason } from '@/lib/seasonUtils';

export const runtime = 'nodejs';
export const maxDuration = 20;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Public, lightweight endpoint for the landing page's live cards:
//   1. AI Play of the Day — STRICTLY today's slate. If today's slate hasn't
//      produced a qualifying Tier-1/2 play yet, this returns null and the
//      landing page shows its placeholder — it NEVER shows a prior day's
//      game. "AI Play of the Day" means today, always.
//   2. Season Win Rate — from the shared AI track record, scoped to each
//      sport's current season.
//   3. Line Movement — ALWAYS pulled from today's live slate data.
// Pure DB/data reads — NO AI calls — cheap and fast for every visitor.
export async function GET(req) {
  const out = { play: null, winRate: null, lineMovement: null };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = toDateStr(ctNow);

    const origin = new URL(req.url).origin;
    let todaySlate = [];
    try {
      const slateRes = await fetch(`${origin}/api/today?date=${todayStr}`, { cache: 'no-store' });
      if (slateRes.ok) { const j = await slateRes.json(); todaySlate = j.games || []; }
    } catch {}
    const onTodaySlate = (away, home) =>
      todaySlate.length === 0 || todaySlate.some(g => g.away === away && g.home === home);

    // ── AI PLAY OF THE DAY — TODAY ONLY, no fallback to prior days ──
    let featuredMatchup = null;
    try {
      const { data: rows } = await sb
        .from('game_analyses')
        .select('away, home, result, date')
        .eq('date', todayStr);
      if (rows?.length) {
        const candidates = [];
        for (const r of rows) {
          let parsed; try { parsed = JSON.parse(r.result); } catch { continue; }
          const s = parsed?.summary;
          if (!s || !s.pick || s.tier === 'PASS' || s.tier === '3') continue;
          if (!onTodaySlate(r.away, r.home)) continue;
          const tierRank = s.tier === '1' ? 3 : s.tier === '2' ? 2 : 1;
          candidates.push({
            away: r.away, home: r.home, pick: s.pick, betType: s.betType || '',
            odds: s.odds || s.price || '', tier: s.tier, confidence: s.confidencePercent || 0,
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
            date: todayStr, isToday: true,
            resultStamp: null, // today's play is fresh/pending, no result yet
          };
          featuredMatchup = { away: c.away, home: c.home };
        }
      }
    } catch {}

    // ── SEASON WIN RATE — shared AI track record, scoped to current season ──
    try {
      const { data: trRows } = await sb.from('ai_track_record').select('result, sport, date');
      if (trRows?.length) {
        const current = trRows.filter(r => isCurrentSeason(r.sport, r.date, todayStr));
        const wins = current.filter(r => r.result === 'win').length;
        const losses = current.filter(r => r.result === 'loss').length;
        const total = wins + losses;
        if (total >= 5) out.winRate = { pct: Math.round((wins / total) * 1000) / 10, wins, losses };
      }
    } catch {}
    if (!out.winRate) {
      try {
        const { data: histRows } = await sb.from('user_data').select('value').eq('key', 'pick_history').limit(50);
        let wins = 0, losses = 0;
        for (const row of histRows || []) {
          let hist; try { hist = JSON.parse(row.value); } catch { continue; }
          if (!Array.isArray(hist)) continue;
          for (const p of hist) {
            if (p.isUserAlt) continue;
            const res = (p.result || '').toString().toLowerCase();
            if (res === 'win') wins++; else if (res === 'loss') losses++;
          }
        }
        const total = wins + losses;
        if (total >= 5) out.winRate = { pct: Math.round((wins / total) * 1000) / 10, wins, losses };
      } catch {}
    }

    // ── LINE MOVEMENT — ALWAYS from today's live slate ──
    try {
      const hasMovement = (g) => g?.lineMovement && g.lineMovement !== 'No significant movement' && g.lineMovement !== 'N/A';
      let g = null;
      if (featuredMatchup) {
        g = todaySlate.find(x => x.away === featuredMatchup.away && x.home === featuredMatchup.home && hasMovement(x));
      }
      if (!g) g = todaySlate.find(hasMovement);
      if (g) {
        out.lineMovement = { text: g.lineMovement, matchup: `${g.away} @ ${g.home}`, live: true };
      } else if (todaySlate.length > 0) {
        out.lineMovement = { text: 'Monitoring live odds — no significant movement yet today', matchup: null, live: true };
      }
    } catch {}

    // Short cache — this endpoint needs to feel genuinely live, not just
    // accurate on first load. The landing page also polls this on an
    // interval (see LandingPage.jsx), so keep this window short.
    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e) {
    return NextResponse.json(out);
  }
}
