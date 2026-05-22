'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PLANS = [
  {
    id: 'weekly',
    label: 'Weekly',
    price: '$19.99',
    period: '/week',
    features: ['Full Vegas Vault AI model', 'All MLB + tennis games', 'Auto-generated plays', 'Trell Rule alerts', 'Play history'],
    highlight: false,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$49.99',
    period: '/month',
    savings: 'Best value',
    features: ['Everything in weekly', 'Priority play generation', 'Exclusive model updates', 'Early access to new sports'],
    highlight: true,
  }
];

export default function PaywallGate() {
  const [loading, setLoading] = useState(null);

  async function handleSubscribe(planId) {
    setLoading(planId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ plan: planId })
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(null);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.logo}>VEGAS <span style={styles.gold}>VAULT</span> AI</div>
        <div style={styles.headline}>Subscribe to start generating plays</div>
        <div style={styles.sub}>Full Vegas Vault AI model. Every game. Fully automated.</div>

        <div style={styles.grid}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ ...styles.planCard, ...(plan.highlight ? styles.planHighlight : {}) }}>
              {plan.highlight && <div style={styles.badge}>{plan.savings}</div>}
              <div style={styles.planLabel}>{plan.label}</div>
              <div style={styles.priceRow}>
                <span style={styles.price}>{plan.price}</span>
                <span style={styles.period}>{plan.period}</span>
              </div>
              <ul style={styles.featureList}>
                {plan.features.map(f => (
                  <li key={f} style={styles.feature}>
                    <span style={styles.checkmark}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                style={{ ...styles.subBtn, ...(plan.highlight ? styles.subBtnGold : {}) }}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Redirecting...' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          Secured by Stripe · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  inner: { width: '100%', maxWidth: 680, fontFamily: "'DM Mono', monospace" },
  logo: { fontSize: 16, fontWeight: 500, color: '#fff', textAlign: 'center', letterSpacing: '0.05em', marginBottom: 12 },
  gold: { color: '#c9a227' },
  headline: { fontSize: 22, fontWeight: 500, color: '#fff', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 36 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  planCard: { background: '#111', border: '0.5px solid #222', borderRadius: 14, padding: '24px 22px', position: 'relative' },
  planHighlight: { border: '1px solid #c9a227', background: '#0e0c00' },
  badge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#c9a227', color: '#000', fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20 },
  planLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 18 },
  price: { fontSize: 32, fontWeight: 500, color: '#fff' },
  period: { fontSize: 13, color: '#555' },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 },
  feature: { fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'flex-start', gap: 8 },
  checkmark: { color: '#c9a227', flexShrink: 0 },
  subBtn: { width: '100%', padding: '10px 0', background: 'transparent', border: '0.5px solid #444', borderRadius: 8, color: '#ccc', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  subBtnGold: { background: '#c9a227', border: 'none', color: '#000', fontWeight: 600 },
  footer: { textAlign: 'center', fontSize: 11, color: '#444' }
};;