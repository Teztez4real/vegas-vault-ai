import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Clears the SHARED game_analyses table for a given date (or all dates).
// This is the table every device reloads from — clearing only the user's own
// data leaves stale analyses here that reload on the next fetch. Admin only.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { date, token, all } = body;

    // Verify admin via Supabase session token
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    let authorized = false;
    try {
      if (token) {
        const { data: { user } } = await sb.auth.getUser(token);
        if (user?.email === 'battlecortez@gmail.com') authorized = true;
      }
    } catch {}
    if (!authorized && body.adminKey === process.env.ADMIN_SECRET_KEY) authorized = true;
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let query = sb.from('game_analyses').delete();
    if (all === true) {
      query = query.neq('game_key', '__never__'); // delete all rows
    } else if (date) {
      query = query.eq('date', date);
    } else {
      return NextResponse.json({ error: 'Provide a date or all:true' }, { status: 400 });
    }
    const { error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 200 });

    return NextResponse.json({ success: true, cleared: all ? 'all dates' : date, count: count ?? 'unknown' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
