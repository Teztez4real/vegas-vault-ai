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

    const { plan } = await request.json();
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const email = user.email;
    const prices = {
      weekly:  process.env.STRIPE_WEEKLY_PRICE_ID,
      monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
    };

    if (!prices[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    // Check if customer already exists in Stripe
    const { data: existingSub } = await sb
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: process.env.NEXT_PUBLIC_SITE_URL + '/dashboard?subscribed=true',
      cancel_url:  process.env.NEXT_PUBLIC_SITE_URL + '/subscribe?canceled=true',
      metadata: { email, userId: user.id },
      subscription_data: { metadata: { email, userId: user.id } },
    };

    // Reuse existing Stripe customer if available
    if (existingSub?.stripe_customer_id) {
      sessionParams.customer = existingSub.stripe_customer_id;
      delete sessionParams.customer_email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url });

  } catch (err) {
    console.error('Checkout error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
