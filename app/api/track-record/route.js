import { NextResponse } from 'next/server';
import { isCurrentSeason } from '@/lib/seasonUtils';
import { ALL_SPORT_KEYS } from '@/lib/sports';

export const runtime = 'nodejs';
export const maxDuration = 20;

// Exposes the AI's OWN track record — every graded pick across every user,
// computed server-side (see gradeCompletedGames in /api/auto-analyze).
// This is intentionally SEPARATE from the in-app Analytics tab, which stays
// scoped to a single user's own watchlisted picks. This endpoint answers
// "how well is the model actually doing across every game it didn't pass on,"
// which feeds: the Dashboard AI Performance widget, the Models section
// per-sport stats, the landing page Season Win Rate, and the track-record
// context fed back into the AI's own Stage 2/4 prompts.
//
// SEASON RESET: records and results reset every new season, per sport. A
// game's row always stays in the database (nothing is deleted — it's still
// useful history), but stats here only COUNT rows from each sport's CURRENT
// season. MLB/Tennis/WNBA reset at the new calendar year (their season
// starts and ends within one year); NBA/NFL reset when their new season
// starts in the fall, since their season spans two calendar years.
export async function GET() {
  const empty = { overall: null, bySport: {}, recent20: null, byTier: [], byBetCategory: [] };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: allRows, error: queryError } = await sb
      .from('ai_track_record')
      .select('sport, result, date, graded_at, tier, bet_type')
      .order('graded_at', { ascending: false });

    // Surface exactly what happened — visit this endpoint's URL directly to
    // check: if queryError is set, the ai_track_record table almost
    // certainly doesn't exist yet (run supabase/migrations/ai_track_record.sql
    // in Supabase → SQL Editor). If no error but totalRowsEver is 0, the
    // table exists but nothing has been graded into it yet.
    const _debug = {
      tableReachable: !queryError,
      queryError: queryError?.message || null,
      totalRowsEver: allRows?.length || 0,
    };

    if (!allRows?.length) return NextResponse.json({ ...empty, _debug });

    // US Central "today" — used as the reference point for season boundaries.
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;

    // Only count rows from each sport's CURRENT season — this is the reset.
    const rows = allRows.filter(r => isCurrentSeason(r.sport, r.date, todayStr));

    if (!rows.length) return NextResponse.json({ ...empty, _debug });

    const wins = rows.filter(r => r.result === 'win').length;
    const losses = rows.filter(r => r.result === 'loss').length;
    const total = wins + losses;
    const overall = total > 0 ? { wins, losses, total, pct: Math.round((wins / total) * 1000) / 10 } : null;

    const bySport = {};
    // Registry-driven (ALL sports, including disabled ones) so a sport's
    // historical record survives being toggled off, and any future sport is
    // tracked automatically without editing this list.
    for (const sport of ALL_SPORT_KEYS) {
      const sportRows = rows.filter(r => r.sport === sport);
      const w = sportRows.filter(r => r.result === 'win').length;
      const l = sportRows.filter(r => r.result === 'loss').length;
      const t = w + l;
      bySport[sport] = t > 0 ? { wins: w, losses: l, total: t, pct: Math.round((w / t) * 1000) / 10, record: `${w}-${l}` } : { wins: 0, losses: 0, total: 0, pct: null, record: '—' };
    }

    // BY TIER — this is what makes the record actually actionable: if Tier 1
    // (supposed "locks") is winning at a materially lower rate than Tier 2,
    // that's a real calibration signal, not just trivia.
    const byTier = [];
    for (const t of ['1', '2', '3']) {
      const tierRows = rows.filter(r => r.tier === t);
      const w = tierRows.filter(r => r.result === 'win').length;
      const n = tierRows.length;
      if (n > 0) byTier.push({ label: `Tier ${t}`, wins: w, losses: n - w, n, pct: Math.round((w / n) * 1000) / 10 });
    }

    // BY BET CATEGORY — bucket the free-text bet_type into ML / Spread / Total
    // so the AI can see if it's systematically weaker on one market type.
    const catOf = (bt) => {
      const s = (bt || '').toUpperCase();
      if (s.includes('OVER') || s.includes('UNDER')) return 'Total';
      if (s.includes('ML')) return 'ML';
      return 'Spread';
    };
    const byBetCategory = [];
    for (const cat of ['ML', 'Spread', 'Total']) {
      const catRows = rows.filter(r => catOf(r.bet_type) === cat);
      const w = catRows.filter(r => r.result === 'win').length;
      const n = catRows.length;
      if (n > 0) byBetCategory.push({ label: cat, wins: w, losses: n - w, n, pct: Math.round((w / n) * 1000) / 10 });
    }

    const recent = rows.slice(0, 20);
    const rw = recent.filter(r => r.result === 'win').length;
    const recent20 = recent.length > 0 ? { wins: rw, losses: recent.length - rw, n: recent.length, pct: Math.round((rw / recent.length) * 1000) / 10 } : null;

    return NextResponse.json({ overall, bySport, recent20, byTier, byBetCategory, _debug }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return NextResponse.json({ ...empty, _debug: { tableReachable: false, queryError: e.message, totalRowsEver: 0 } });
  }
}
