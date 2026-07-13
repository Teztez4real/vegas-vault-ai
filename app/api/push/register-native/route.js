import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stores APNs device tokens from the native iOS app — a completely separate
// delivery mechanism from web push (public/sw.js + push_subscriptions), which
// only works inside a browser context and does NOT apply to the native app.
// SENDING to these tokens requires an Apple Push Notification Auth Key
// (Team ID + Key ID + .p8 file) created in the Apple Developer portal — a
// Mac/Apple-account-only step. This endpoint only handles STORAGE; see
// ios-app-store-checklist.md for what's needed to wire up actual delivery.
export async function POST(req) {
  try {
    const { token, userId, email, platform } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Invalid device token' }, { status: 400 });
    }

    const { error } = await sb.from('native_push_tokens').upsert({
      device_token: token,
      platform: platform || 'ios',
      user_id: userId || null,
      email: email || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'device_token' });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Native push register error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { token } = await req.json();
    await sb.from('native_push_tokens').delete().eq('device_token', token);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
