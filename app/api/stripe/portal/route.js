import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST() {
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: 'placeholder',
    return_url: process.env.NEXT_PUBLIC_SITE_URL + '/dashboard',
  });
  return NextResponse.json({ url: portalSession.url });
}