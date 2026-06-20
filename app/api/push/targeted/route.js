import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { title, body, url = '/', tag = 'vv', userIds = [], trigger } = await req.json();
    if (!userIds.length) return NextResponse.json({ success: true, sent: 0 });
    if (!process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ success: true, sent: 0, note: 'Push not configured' });

    const webpush = (await import('web-push')).default;
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    webpush.setVapidDetails('mailto:admin@vegasvault.ai', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const { data: subs } = await sb.from('push_subscriptions').select('*').in('user_id', userIds);
    let sent = 0, failed = 0;
    await Promise.allSettled((subs || []).map(async row => {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ title, body, url, tag }));
        sent++;
      } catch (e) {
        failed++;
        if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      }
    }));
    return NextResponse.json({ success: true, sent, failed });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
