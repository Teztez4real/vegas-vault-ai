import { getSupabaseAdmin } from '@/lib/supabaseClient';

// Server-side save — uses service role key, bypasses RLS.
// This is the guaranteed write path: it works even if the client
// Supabase session has expired or been invalidated, which is when
// the client-side syncSave silently fails and data gets lost.
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, saves } = body; // saves: [{ key, value }]

    if (!userId || !Array.isArray(saves) || saves.length === 0) {
      return Response.json({ error: 'Missing userId or saves' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return Response.json({ error: 'Admin client unavailable' }, { status: 500 });

    const rows = saves.map(({ key, value }) => ({
      user_id: userId,
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await admin
      .from('user_data')
      .upsert(rows, { onConflict: 'user_id,key' });

    if (error) {
      console.error('[/api/user/save] upsert error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, saved: rows.length });
  } catch (e) {
    console.error('[/api/user/save] threw:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
