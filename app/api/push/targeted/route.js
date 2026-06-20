import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { title, body, url = '/', tag = 'vv-targeted', userIds = [], adminKey } = await req.json();

    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!userIds.length) {
      return NextResponse.json({ success: true, sent: 0, message: 'No target users' });
    }
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return NextResponse.json({ success: true, sent: 0, message: 'Push not configured' });
    }

    // Lazy init — keeps module-level clean so Vercel build data collection doesn't throw
    const webpush = (await import('web-push')).default;
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    webpush.setVapidDetails(
      'mailto:admin@vegasvault.ai',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

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
    console.error('Targeted push error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
