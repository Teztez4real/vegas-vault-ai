import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const { plan } = await request.json();
  const prices = {
    monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_YEARLY_PRICE_ID,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: prices[plan], quantity: 1 }],
    success_url: process.env.NEXT_PUBLIC_SITE_URL + '/dashboard?success=true',
    cancel_url: process.env.NEXT_PUBLIC_SITE_URL + '/subscribe?canceled=true',
  });

  return NextResponse.json({ url: session.url });
}