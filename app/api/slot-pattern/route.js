/**
 * /api/slot-pattern
 * GET  ?date=YYYY-MM-DD  — returns stored pattern for that date
 * POST { date, pattern }  — saves pattern (admin only)
 * 
 * Stores in Supabase table: slot_patterns
 *   date    DATE PRIMARY KEY
 *   pattern TEXT[]   — e.g. ['VEGAS','PUBLIC','PUBLIC',...]
 *   note    TEXT
 *   created_at TIMESTAMPTZ
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
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const sb = getAdmin();
    const { data, error } = await sb
      .from('slot_patterns')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ pattern: data?.pattern || null, date, note: data?.note || '' });
  } catch (err) {
    return NextResponse.json({ pattern: null, date, error: err.message });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, pattern, note, token } = body;

    // Verify admin via Supabase JWT
    const sb = getAdmin();
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate pattern
    if (!Array.isArray(pattern) || !pattern.every(s => s === 'VEGAS' || s === 'PUBLIC')) {
      return NextResponse.json({ error: 'Invalid pattern — must be array of VEGAS/PUBLIC' }, { status: 400 });
    }

    const { error } = await sb
      .from('slot_patterns')
      .upsert({ date, pattern, note: note || '', created_at: new Date().toISOString() }, { onConflict: 'date' });

    if (error) throw error;
    return NextResponse.json({ success: true, date, pattern });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
