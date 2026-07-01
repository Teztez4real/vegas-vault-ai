import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 20;

// Public, lightweight endpoint for the landing page's three live cards:
//   1. AI Play of the Day  — best Tier-1/2 play from today's stored analyses
//   2. Season Win Rate     — computed from graded pick history
//   3. Line Movement       — a real DraftKings movement example from the slate
// Pure DB/data reads — NO AI calls — so it's cheap and fast for every visitor.
// Everything is defensive: if data isn't available, fields come back null and
// the landing page falls back to its static placeholders.
export async function GET(req) {
  const out = { play: null, winRate: null, lineMovement: null };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // US Central date
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const date = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

    // ── 1. AI PLAY OF THE DAY — best non-PASS play from today's analyses ──
    try {
      const { data: rows } = await sb
        .from('game_analyses')
        .select('away, home, result, updated_at')
        .eq('date', date);
      if (rows?.length) {
        const candidates = [];
        for (const r of rows) {
          let parsed; try { parsed = JSON.parse(r.result); } catch { continue; }
          const s = parsed?.summary;
          if (!s || !s.pick || s.tier === 'PASS' || s.tier === '3') continue;
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
            pick: `${c.pick}${c.betType && !String(c.pick).includes(c.betType) ? ' ' + c.betType : ''}`.trim(),
            tier: c.tier, odds: c.odds, time: c.time,
          };
          // Use the same game for line movement if it has one
          const lmRow = rows.find(r => r.away === c.away && r.home === c.home);
          if (lmRow) {
            try {
              const p = JSON.parse(lmRow.result);
              if (p.lineMovement && p.lineMovement !== 'No significant movement') out.lineMovement = { text: p.lineMovement, matchup: `${c.away} @ ${c.home}` };
            } catch {}
          }
        }
      }
    } catch {}

    // ── 2. SEASON WIN RATE — from graded pick history across all users ──
    // We store finalized graded picks; compute W/(W+L). Falls back to null.
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
          const res = (p.result || p.outcome || '').toString().toUpperCase();
          if (res === 'WIN' || res === 'W') wins++;
          else if (res === 'LOSS' || res === 'L') losses++;
        }
      }
      const total = wins + losses;
      if (total >= 5) out.winRate = { pct: Math.round((wins / total) * 1000) / 10, wins, losses };
    } catch {}

    // ── 3. LINE MOVEMENT — if the featured play didn't supply one, find any ──
    if (!out.lineMovement) {
      try {
        const { data: rows } = await sb
          .from('game_analyses')
          .select('away, home, result')
          .eq('date', date)
          .limit(30);
        for (const r of rows || []) {
          let p; try { p = JSON.parse(r.result); } catch { continue; }
          if (p.lineMovement && p.lineMovement !== 'No significant movement' && /→|opened|moved|sharp/i.test(p.lineMovement)) {
            out.lineMovement = { text: p.lineMovement, matchup: `${r.away} @ ${r.home}` };
            break;
          }
        }
      } catch {}
    }

    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (e) {
    return NextResponse.json(out); // always return the shape; landing uses fallbacks
  }
}
