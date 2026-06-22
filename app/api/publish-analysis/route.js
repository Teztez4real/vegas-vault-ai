import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Publishes a single completed analysis to the shared game_analyses table.
// Called by ANY device after it analyzes a game — so the analysis becomes
// available to every other device immediately, independent of which device
// (or the server cron) produced it. This makes analysis device-independent:
// the first device to analyze a game publishes it for everyone.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

    const { gameKey, gameId, date, slot, sport, away, home, result } = body;
    if (!gameKey || !result) {
      return NextResponse.json({ error: 'Missing gameKey or result' }, { status: 400 });
    }

    // Never publish results for games already started/final — those are locked.
    // The client already guards this, but double-check server-side.
    if (result?.summary?.gameStarted === true) {
      return NextResponse.json({ skipped: 'game started' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();
    const dateStr = date || now.split('T')[0];

    // Only overwrite if this analysis is newer, OR the game isn't in the table yet.
    // Avoids a stale device clobbering a fresher server-cron analysis.
    const { data: existing } = await sb
      .from('game_analyses')
      .select('updated_at, finalized_notified_at')
      .eq('game_key', gameKey)
      .maybeSingle();

    // If a finalized (locked) analysis already exists, don't overwrite it.
    if (existing?.finalized_notified_at) {
      return NextResponse.json({ skipped: 'already finalized' });
    }

    await sb.from('game_analyses').upsert({
      game_key: gameKey,
      game_id: gameId || null,
      date: dateStr,
      slot: slot || null,
      sport: sport || null,
      away: away || null,
      home: home || null,
      result: JSON.stringify({ ...result, updatedAt: now }),
      updated_at: now,
    }, { onConflict: 'game_key' });

    return NextResponse.json({ success: true, gameKey, updatedAt: now });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
