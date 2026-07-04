import { NextResponse } from 'next/server';
import { formatPickDisplay } from '@/lib/pickFormat';

export const runtime = 'nodejs';
export const maxDuration = 20;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Public, lightweight endpoint for the landing page's live cards:
//   1. AI Play of the Day — today's play if the slate has produced a real
//      Tier-1/2 pick. Otherwise, CARRIES OVER the most recent real play from
//      a prior day (with its graded WIN/LOSS result stamped on it) rather
//      than falling back to a fake static example. The carried-over play
//      only rolls off once today's slate produces its own real play.
//   2. Season Win Rate — from the shared AI track record (all graded picks).
//   3. Line Movement — ALWAYS pulled from today's live slate data (real odds
//      tracking is independent of whether the admin has set today's slot
//      pattern), never a static/fabricated example.
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

    // ── 1a. TRY TODAY FIRST ──
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

    // ── 1b. CARRY OVER the most recent prior real play (with its graded
    // result) if today hasn't produced one yet. Looks back up to 14 days.
    if (!out.play) {
      try {
        const windowStart = new Date(ctNow);
        windowStart.setDate(windowStart.getDate() - 14);
        const windowStartStr = toDateStr(windowStart);

        const { data: rows } = await sb
          .from('game_analyses')
          .select('away, home, result, date')
          .gte('date', windowStartStr)
          .lt('date', todayStr)
          .order('date', { ascending: false });

        if (rows?.length) {
          const byDate = {};
          for (const r of rows) {
            let parsed; try { parsed = JSON.parse(r.result); } catch { continue; }
            const s = parsed?.summary;
            if (!s || !s.pick || s.tier === 'PASS' || s.tier === '3') continue;
            const tierRank = s.tier === '1' ? 3 : s.tier === '2' ? 2 : 1;
            (byDate[r.date] = byDate[r.date] || []).push({
              away: r.away, home: r.home, pick: s.pick, betType: s.betType || '',
              odds: s.odds || s.price || '', tier: s.tier, confidence: s.confidencePercent || 0,
              time: parsed.gameTime || s.gameTime || '',
              graded: parsed.graded === true,
              gradedResult: parsed.gradedResult || null, // 'win' | 'loss'
              score: tierRank * 1000 + (s.confidencePercent || 0),
              date: r.date,
            });
          }
          const orderedDates = [...new Set(rows.map(r => r.date))];
          for (const d of orderedDates) {
            const cands = byDate[d];
            if (!cands?.length) continue;
            cands.sort((a, b) => b.score - a.score);
            const c = cands[0];
            out.play = {
              matchup: `${c.away} @ ${c.home}`,
              pick: formatPickDisplay(c.pick, c.betType || ''),
              tier: c.tier, odds: c.odds, time: c.time,
              date: d, isToday: false,
              resultStamp: c.gradedResult === 'win' ? 'CASHED ✅' : c.gradedResult === 'loss' ? 'LOSS ❌' : null,
            };
            featuredMatchup = { away: c.away, home: c.home };
            break;
          }
        }
      } catch {}
    }

    // ── 2. SEASON WIN RATE — from the shared AI track record ──
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

    // ── 3. LINE MOVEMENT — ALWAYS from today's live slate. Real odds
    // tracking happens for every fetched game regardless of whether the
    // admin has saved a slot pattern, so this is always live data, never a
    // static/fabricated example. Prefers the featured game; falls back to
    // any game showing real movement; if truly nothing has moved yet today,
    // says so honestly instead of showing a fake number.
    try {
      const hasMovement = (g) => g?.lineMovement && g.lineMovement !== 'No significant movement' && g.lineMovement !== 'N/A';
      let g = null;
      if (featuredMatchup && out.play?.isToday) {
        g = todaySlate.find(x => x.away === featuredMatchup.away && x.home === featuredMatchup.home && hasMovement(x));
      }
      if (!g) g = todaySlate.find(hasMovement);
      if (g) {
        out.lineMovement = { text: g.lineMovement, matchup: `${g.away} @ ${g.home}`, live: true };
      } else if (todaySlate.length > 0) {
        // Real data, just genuinely no significant movement yet today — honest, not fake.
        out.lineMovement = { text: 'Monitoring live odds — no significant movement yet today', matchup: null, live: true };
      }
    } catch {}

    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (e) {
    return NextResponse.json(out);
  }
}
