import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { plan } = await request.json();
    const prices = {
      weekly: process.env.STRIPE_WEEKLY_PRICE_ID,
      monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: process.env.NEXT_PUBLIC_SITE_URL + '/dashboard?success=true',
      cancel_url: process.env.NEXT_PUBLIC_SITE_URL + '/subscribe?canceled=true',
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}