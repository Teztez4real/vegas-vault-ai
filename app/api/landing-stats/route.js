import { NextResponse } from 'next/server';
import { formatPickDisplay } from '@/lib/pickFormat';

export const runtime = 'nodejs';
export const maxDuration = 20;

function ctDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Public, lightweight endpoint for the landing page's three live cards:
//   1. AI Play of the Day  — best Tier-1/2 play from today's analyses, falling
//      back to the most recent prior day that has one (yesterday, etc.) so the
//      card is never empty just because today's slate hasn't finished yet.
//   2. Season Win Rate     — computed from graded pick history (all-time)
//   3. Line Movement       — real line movement pulled from today's live slate
// Pure DB/data reads — NO AI calls — so it's cheap and fast for every visitor.
// Everything is defensive: if data isn't available, fields come back null and
// the landing page falls back to its static placeholders.
export async function GET(req) {
  const out = { play: null, winRate: null, lineMovement: null };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // US Central "today"
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = ctDateStr(ctNow);

    // ── 1. AI PLAY OF THE DAY — best non-PASS play from today, or the most
    // recent prior day that has one (yesterday, the day before, etc). We pull
    // a window of recent analyses (last 7 days) sorted by date, then pick the
    // best candidate from the MOST RECENT date that has at least one.
    let featuredMatchup = null;
    let featuredDate = null;
    try {
      const windowStart = new Date(ctNow);
      windowStart.setDate(windowStart.getDate() - 7);
      const windowStartStr = ctDateStr(windowStart);

      const { data: rows } = await sb
        .from('game_analyses')
        .select('away, home, result, date, updated_at')
        .gte('date', windowStartStr)
        .lte('date', todayStr)
        .order('date', { ascending: false });

      if (rows?.length) {
        // Group candidates by date so we can pick the most recent date with a hit.
        const byDate = {};
        for (const r of rows) {
          let parsed; try { parsed = JSON.parse(r.result); } catch { continue; }
          const s = parsed?.summary;
          if (!s || !s.pick || s.tier === 'PASS' || s.tier === '3') continue;
          const tierRank = s.tier === '1' ? 3 : s.tier === '2' ? 2 : 1;
          const cand = {
            away: r.away, home: r.home,
            pick: s.pick, betType: s.betType || '', odds: s.odds || s.price || '',
            tier: s.tier, confidence: s.confidencePercent || 0,
            time: parsed.gameTime || s.gameTime || '',
            date: r.date,
            score: tierRank * 1000 + (s.confidencePercent || 0),
          };
          (byDate[r.date] = byDate[r.date] || []).push(cand);
        }
        // Dates are already sorted descending from the query; walk them in
        // that order and use the first date that has a qualifying candidate.
        const orderedDates = [...new Set(rows.map(r => r.date))];
        for (const d of orderedDates) {
          const cands = byDate[d];
          if (cands?.length) {
            cands.sort((a, b) => b.score - a.score);
            const c = cands[0];
            out.play = {
              matchup: `${c.away} @ ${c.home}`,
              pick: formatPickDisplay(c.pick, c.betType || ''),
              tier: c.tier, odds: c.odds, time: c.time,
              date: c.date,
              isToday: c.date === todayStr,
            };
            featuredMatchup = { away: c.away, home: c.home };
            featuredDate = c.date;
            break;
          }
        }
      }
    } catch {}

    // ── 2. SEASON WIN RATE — from the shared AI track record (every graded
    // pick, server-side, independent of any user's watchlist). Falls back to
    // per-user pick_history if the shared table isn't populated yet (e.g.
    // right after this feature ships, before any games have been graded).
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

    // ── 3. LINE MOVEMENT — pulled from the LIVE slate (/api/today) for the
    // featured play's OWN date (today or the fallback day). If the featured
    // play is from a past day, its game has already started/finished, so we
    // read from /api/today for THAT date if still queryable, otherwise fall
    // back to today's live slate for any game showing real movement.
    try {
      const origin = new URL(req.url).origin;
      const hasMovement = (g) => g?.lineMovement && g.lineMovement !== 'No significant movement' && g.lineMovement !== 'N/A';

      // Try the featured play's own date first (covers "today" case directly).
      if (featuredMatchup && featuredDate) {
        const gamesRes = await fetch(`${origin}/api/today?date=${featuredDate}`, { cache: 'no-store' });
        if (gamesRes.ok) {
          const { games } = await gamesRes.json();
          const g = (games || []).find(x => x.away === featuredMatchup.away && x.home === featuredMatchup.home && hasMovement(x));
          if (g) out.lineMovement = { text: g.lineMovement, matchup: `${g.away} @ ${g.home}` };
        }
      }
      // Fallback: today's live slate, any game with real movement.
      if (!out.lineMovement) {
        const gamesRes = await fetch(`${origin}/api/today?date=${todayStr}`, { cache: 'no-store' });
        if (gamesRes.ok) {
          const { games } = await gamesRes.json();
          const g = (games || []).find(hasMovement);
          if (g) out.lineMovement = { text: g.lineMovement, matchup: `${g.away} @ ${g.home}` };
        }
      }
    } catch {}

    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (e) {
    return NextResponse.json(out); // always return the shape; landing uses fallbacks
  }
}
