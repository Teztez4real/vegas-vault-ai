import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  let event;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = await req.text();
    const sig  = req.headers.get('stripe-signature');
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const obj = event.data.object;

  try {
    switch (event.type) {

      // Payment succeeded — activate subscription
      case 'checkout.session.completed': {
        const email = obj.customer_email || obj.customer_details?.email;
        const customerId   = obj.customer;
        const subscriptionId = obj.subscription;
        if (!email) break;

        // Look up the subscription to get period end
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const plan = sub.items.data[0]?.price?.recurring?.interval || 'month';

        await sb.from('subscriptions').upsert({
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: 'active',
          plan,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });

        console.log(`Subscription activated: ${email} (${plan})`);
        break;
      }

      // Subscription renewed
      case 'invoice.payment_succeeded': {
        const customerId     = obj.customer;
        const subscriptionId = obj.subscription;
        if (!subscriptionId) break;

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const email = sub.metadata?.email || obj.customer_email;

        if (email) {
          await sb.from('subscriptions').upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });
        }
        break;
      }

      // Subscription cancelled or payment failed
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const customerId     = obj.customer || obj.customer;
        const subscriptionId = obj.id || obj.subscription;

        await sb.from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);

        console.log(`Subscription canceled/failed: customer ${customerId}`);
        break;
      }

      // Subscription updated (plan change)
      case 'customer.subscription.updated': {
        const status    = obj.status;
        const periodEnd = new Date(obj.current_period_end * 1000).toISOString();
        const plan      = obj.items.data[0]?.price?.recurring?.interval || 'month';

        await sb.from('subscriptions')
          .update({
            status: status === 'active' ? 'active' : 'canceled',
            plan,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', obj.id);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  return NextResponse.json({ received: true });
}
