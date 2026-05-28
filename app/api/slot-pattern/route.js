/**
 * /api/slot-pattern
 * GET  ?date=YYYY-MM-DD&sport=mlb   — returns stored pattern for that date+sport
 * POST { date, sport, pattern, note } — saves pattern (admin only)
 * 
 * Table: slot_patterns
 *   date    DATE
 *   sport   TEXT  (mlb, nba, nfl)
 *   pattern TEXT[]
 *   note    TEXT
 *   PRIMARY KEY (date, sport)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'battlecortez@gmail.com';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date  = searchParams.get('date')  || new Date().toISOString().split('T')[0];
  const sport = (searchParams.get('sport') || 'mlb').toLowerCase();

  try {
    const sb = getAdmin();
    const { data, error } = await sb
      .from('slot_patterns')
      .select('*')
      .eq('date', date)
      .eq('sport', sport)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ pattern: data?.pattern || null, date, sport, note: data?.note || '' });
  } catch (err) {
    return NextResponse.json({ pattern: null, date, sport, error: err.message });
  }
}

export async function POST(request) {
  try {
    const body  = await request.json();
    const { date, sport = 'mlb', pattern, note, token } = body;

    const sb = getAdmin();
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!Array.isArray(pattern) || !pattern.every(s => s === 'VEGAS' || s === 'PUBLIC')) {
      return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 });
    }

    const { error } = await sb
      .from('slot_patterns')
      .upsert(
        { date, sport: sport.toLowerCase(), pattern, note: note || '', created_at: new Date().toISOString() },
        { onConflict: 'date,sport' }
      );

    if (error) throw error;
    return NextResponse.json({ success: true, date, sport, pattern });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
