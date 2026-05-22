'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthGate() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm your account.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = '/dashboard';
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>VEGAS <span style={styles.gold}>VAULT</span> AI</div>
        <div style={styles.tagline}>Professional sports betting intelligence</div>

        <div style={styles.tabs}>
          <button style={mode === 'login' ? styles.tabActive : styles.tab} onClick={() => setMode('login')}>Log in</button>
          <button style={mode === 'signup' ? styles.tabActive : styles.tab} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        <button style={styles.googleBtn} onClick={handleGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div style={styles.divider}><span>or</span></div>

        <input
          style={styles.input}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}

        <button style={styles.primaryBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        {mode === 'login' && (
          <div style={styles.forgot}>
            <button style={styles.link} onClick={async () => {
              if (!email) { setError('Enter your email first'); return; }
              await supabase.auth.resetPasswordForEmail(email);
              setMessage('Password reset email sent.');
            }}>Forgot password?</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: '#111', border: '0.5px solid #222', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 400, fontFamily: "'DM Mono', monospace" },
  logo: { fontSize: 18, fontWeight: 500, color: '#fff', textAlign: 'center', letterSpacing: '0.05em', marginBottom: 6 },
  gold: { color: '#c9a227' },
  tagline: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 24 },
  tabs: { display: 'flex', border: '0.5px solid #222', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  tab: { flex: 1, padding: '8px 0', fontSize: 13, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' },
  tabActive: { flex: 1, padding: '8px 0', fontSize: 13, background: '#1a1500', border: 'none', color: '#c9a227', cursor: 'pointer', fontWeight: 500 },
  googleBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 0', background: 'transparent', border: '0.5px solid #333', borderRadius: 8, color: '#ccc', fontSize: 13, cursor: 'pointer', marginBottom: 16 },
  divider: { textAlign: 'center', color: '#444', fontSize: 12, marginBottom: 16, position: 'relative' },
  input: { width: '100%', marginBottom: 10, padding: '10px 12px', background: '#0a0a0a', border: '0.5px solid #2a2a2a', borderRadius: 8, color: '#e5e5e5', fontSize: 13, outline: 'none', fontFamily: 'inherit', display: 'block' },
  error: { fontSize: 12, color: '#f87171', marginBottom: 10, padding: '8px 12px', background: '#1f0a0a', borderRadius: 6 },
  success: { fontSize: 12, color: '#4ade80', marginBottom: 10, padding: '8px 12px', background: '#0a2e1a', borderRadius: 6 },
  primaryBtn: { width: '100%', padding: '11px 0', background: '#c9a227', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  forgot: { textAlign: 'center', marginTop: 14 },
  link: { background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }
};
;