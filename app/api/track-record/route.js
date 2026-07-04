import { NextResponse } from 'next/server';

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
export async function GET() {
  const empty = { overall: null, bySport: {}, recent20: null };
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows } = await sb
      .from('ai_track_record')
      .select('sport, result, graded_at')
      .order('graded_at', { ascending: false });

    if (!rows?.length) return NextResponse.json(empty);

    const wins = rows.filter(r => r.result === 'win').length;
    const losses = rows.filter(r => r.result === 'loss').length;
    const total = wins + losses;
    const overall = total > 0 ? { wins, losses, total, pct: Math.round((wins / total) * 1000) / 10 } : null;

    const bySport = {};
    for (const sport of ['MLB', 'NBA', 'NFL', 'Tennis', 'WNBA']) {
      const sportRows = rows.filter(r => r.sport === sport);
      const w = sportRows.filter(r => r.result === 'win').length;
      const l = sportRows.filter(r => r.result === 'loss').length;
      const t = w + l;
      bySport[sport] = t > 0 ? { wins: w, losses: l, total: t, pct: Math.round((w / t) * 1000) / 10, record: `${w}-${l}` } : { wins: 0, losses: 0, total: 0, pct: null, record: '—' };
    }

    const recent = rows.slice(0, 20);
    const rw = recent.filter(r => r.result === 'win').length;
    const recent20 = recent.length > 0 ? { wins: rw, losses: recent.length - rw, n: recent.length, pct: Math.round((rw / recent.length) * 1000) / 10 } : null;

    return NextResponse.json({ overall, bySport, recent20 }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return NextResponse.json(empty);
  }
}
