export const STRIPE_HELPERS = `
import Stripe from 'stripe';
import { supabaseAdmin } from './supabaseClient';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const PLANS = {
  monthly: {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID,
    label: 'Monthly',
    price: '$29',
    interval: 'month',
    description: 'Full access to Vegas Vault AI'
  },
  yearly: {
    priceId: process.env.STRIPE_YEARLY_PRICE_ID,
    label: 'Yearly',
    price: '$199',
    interval: 'year',
    description: 'Save $149 vs monthly — best value'
  }
};

// Create or retrieve Stripe customer for a user
export async function getOrCreateStripeCustomer(userId, email) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId }
  });

  await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}

// Sync Stripe subscription to Supabase
export async function syncSubscription(stripeSubscription) {
  const customerId = stripeSubscription.customer;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) return;

  const plan = stripeSubscription.items.data[0]?.price?.id === process.env.STRIPE_YEARLY_PRICE_ID
    ? 'yearly' : 'monthly';

  await supabaseAdmin.from('subscriptions').upsert({
    id: stripeSubscription.id,
    user_id: profile.id,
    status: stripeSubscription.status,
    price_id: stripeSubscription.items.data[0]?.price?.id,
    plan,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  });
}
`;