import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { subscription, userId, email } = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Upsert subscription — one per endpoint
    const { error } = await sb.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      subscription: JSON.stringify(subscription),
      user_id: userId || null,
      email: email || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { endpoint } = await req.json();
    await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
