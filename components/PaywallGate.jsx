'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ENABLED_TEAM_SPORT_KEYS } from '../lib/sports';

const PLANS = [
  {
    id: 'weekly',
    label: 'Weekly',
    price: '$19.99',
    period: '/week',
    features: ['Full Vegas Vault AI model', ENABLED_TEAM_SPORT_KEYS.join(', '), 'Auto-generated plays', 'Trell Rule alerts', 'Props AI', 'Play history'],
    highlight: false,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$49.99',
    period: '/month',
    savings: 'Best value — save 37%',
    features: ['Everything in weekly', 'Priority play generation', 'Vault Locks', 'Sharp Money alerts', 'Early access to new sports'],
    highlight: true,
  }
];

export default function PaywallGate() {
  const [loading, setLoading]       = useState(null);
  const [session, setSession]       = useState(null);
  const [authMode, setAuthMode]     = useState('login'); // 'login' | 'signup'
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [authError, setAuthError]   = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [showAuth, setShowAuth]     = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      // If user just logged in and has a pending plan, proceed to checkout
      if (s && pendingPlan) {
        goToCheckout(pendingPlan, s);
      }
    });
    return () => subscription.unsubscribe();
  }, [pendingPlan]);

  async function goToCheckout(planId, activeSession) {
    setLoading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + activeSession.access_token,
        },
        body: JSON.stringify({ plan: planId }),
      });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else setAuthError(error || 'Could not start checkout');
    } catch (err) {
      setAuthError(err.message);
    }
    setLoading(null);
  }

  async function handleSubscribe(planId) {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) {
      goToCheckout(planId, s);
    } else {
      setPendingPlan(planId);
      setShowAuth(true);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = authMode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      // onAuthStateChange will handle the redirect to checkout
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  }

  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <div style={s.logo}>VEGAS <span style={s.gold}>VAULT</span> AI</div>
        <div style={s.headline}>Unlock the full Vegas Vault AI model</div>
        <div style={s.sub}>Every game. Every sport. Fully automated plays.</div>

        {/* Auth modal */}
        {showAuth && !session && (
          <div style={s.authOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}>
            <div style={s.authBox}>
              <div style={s.authTitle}>{authMode === 'login' ? 'Sign in to continue' : 'Create your account'}</div>
              <div style={s.authSub}>
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <span style={s.authToggle} onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
                  {authMode === 'login' ? 'Sign up' : 'Sign in'}
                </span>
              </div>
              <form onSubmit={handleAuth} style={s.form}>
                <input
                  type="email" placeholder="Email address" value={email}
                  onChange={e => setEmail(e.target.value)} required style={s.input}
                />
                <input
                  type="password" placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)} required style={s.input}
                />
                {authError && <div style={s.authErr}>{authError}</div>}
                <button type="submit" disabled={authLoading} style={s.authBtn}>
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign in & continue' : 'Create account & continue'}
                </button>
              </form>
              <div style={s.authFooter}>Your account will be created and you'll proceed directly to payment.</div>
            </div>
          </div>
        )}

        {/* Plans */}
        <div style={s.grid}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ ...s.planCard, ...(plan.highlight ? s.planHighlight : {}) }}>
              {plan.highlight && <div style={s.badge}>{plan.savings}</div>}
              <div style={s.planLabel}>{plan.label}</div>
              <div style={s.priceRow}>
                <span style={s.price}>{plan.price}</span>
                <span style={s.period}>{plan.period}</span>
              </div>
              <ul style={s.featureList}>
                {plan.features.map(f => (
                  <li key={f} style={s.feature}>
                    <span style={s.checkmark}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                style={{ ...s.subBtn, ...(plan.highlight ? s.subBtnGold : {}), opacity: loading === plan.id ? 0.7 : 1 }}
                onClick={() => handleSubscribe(plan.id)}
                disabled={!!loading}
              >
                {loading === plan.id ? 'Redirecting to checkout...' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        <div style={s.footer}>
          Secured by Stripe · Cancel anytime · No hidden fees
        </div>

        {session && (
          <div style={s.loggedIn}>
            Signed in as <strong>{session.user.email}</strong> ·{' '}
            <span style={s.authToggle} onClick={() => supabase.auth.signOut({ scope: 'global' })}>Sign out</span>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  inner: { width: '100%', maxWidth: 680, fontFamily: "'DM Mono', monospace" },
  logo: { fontSize: 16, fontWeight: 500, color: '#fff', textAlign: 'center', letterSpacing: '0.05em', marginBottom: 12 },
  gold: { color: '#c9a227' },
  headline: { fontSize: 22, fontWeight: 500, color: '#fff', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 36 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  planCard: { background: '#111', border: '0.5px solid #222', borderRadius: 14, padding: '24px 22px', position: 'relative' },
  planHighlight: { border: '1px solid #c9a227', background: '#0e0c00' },
  badge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#c9a227', color: '#000', fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' },
  planLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 18 },
  price: { fontSize: 32, fontWeight: 500, color: '#fff' },
  period: { fontSize: 13, color: '#555' },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 },
  feature: { fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'flex-start', gap: 8 },
  checkmark: { color: '#c9a227', flexShrink: 0 },
  subBtn: { width: '100%', padding: '10px 0', background: 'transparent', border: '0.5px solid #444', borderRadius: 8, color: '#ccc', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  subBtnGold: { background: '#c9a227', border: 'none', color: '#000', fontWeight: 600 },
  footer: { textAlign: 'center', fontSize: 11, color: '#444', marginBottom: 12 },
  loggedIn: { textAlign: 'center', fontSize: 11, color: '#444' },
  authOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  authBox: { background: '#111', border: '1px solid #222', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 400 },
  authTitle: { fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 6, textAlign: 'center' },
  authSub: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 24 },
  authToggle: { color: '#c9a227', cursor: 'pointer', textDecoration: 'underline' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  authErr: { fontSize: 11, color: '#f87171', textAlign: 'center' },
  authBtn: { background: '#c9a227', border: 'none', borderRadius: 8, padding: '11px', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  authFooter: { fontSize: 10, color: '#444', textAlign: 'center', marginTop: 16 },
};
