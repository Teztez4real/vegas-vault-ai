import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:admin@vegasvault.ai',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Client-safe push trigger — does NOT require the admin secret. The app calls
// this whenever a real-time alert fires (bet-ready, win/loss result, etc.) so
// the notification is delivered via Web Push to all subscribed devices,
// including when the app is fully closed — not just while a tab is open.
export async function POST(req) {
  try {
    const { title, body, url = '/', tag = 'vv-notification' } = await req.json();
    if (!title || !body) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
    }
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return NextResponse.json({ error: 'Push not configured' }, { status: 200 });
    }

    const { data: subs, error } = await sb.from('push_subscriptions').select('*');
    if (error) throw error;

    const payload = JSON.stringify({ title, body, url, tag });
    let sent = 0, failed = 0;

    await Promise.allSettled(
      (subs || []).map(async (row) => {
        try {
          const sub = JSON.parse(row.subscription);
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err) {
          failed++;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await sb.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          }
        }
      })
    );

    return NextResponse.json({ success: true, sent, failed });
  } catch (err) {
    console.error('Push notify error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
