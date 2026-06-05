import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Get customer ID from subscriptions table
    const { data: sub } = await sb
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('email', user.email)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: process.env.NEXT_PUBLIC_SITE_URL + '/settings',
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
