'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AuthShell, Field, ErrorMsg, PrimaryButton } from '@/components/SignInPage';

const GREEN = '#39FF14';
const ADMIN_EMAIL = 'battlecortez@gmail.com';

export default function JoinPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  // Already signed in → go to dashboard
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (alive && data?.session?.user) router.replace('/dashboard');
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [router]);

  async function handleJoin() {
    if (!fullName.trim()) { setError('Enter your name.'); return; }
    if (!email || !pw) { setError('Enter your email and password.'); return; }
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      if (!supabase) { setError('Auth unavailable. Try again later.'); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.session && data.user) {
        // Email confirmation disabled — signed in immediately → dashboard to subscribe
        if (data.user.email === ADMIN_EMAIL) localStorage.setItem('vv_admin','1');
        router.replace('/dashboard');
      } else {
        // Email confirmation required
        setConfirm(true);
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  if (confirm) {
    return (
      <AuthShell title="Check Your Email" subtitle="We sent you a confirmation link.">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'8px 0 4px' }}>
          <div style={{ width:60, height:60, borderRadius:16, background:'linear-gradient(145deg,rgba(57,255,20,0.12),rgba(34,204,0,0.05))', border:`1px solid rgba(57,255,20,0.3)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
            <i className="ti ti-mail-check" style={{ fontSize:28, color:GREEN }} />
          </div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,0.65)', lineHeight:1.6 }}>
            Confirm your email at <span style={{ color:'#fff', fontWeight:700 }}>{email}</span>, then sign in to start.
          </div>
          <div onClick={()=>router.push('/signin')} style={{ marginTop:22, fontSize:14, color:GREEN, fontWeight:700, cursor:'pointer' }}>Go to Sign In →</div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Join Vegas Vault AI" subtitle="Create your account · $19.99 to start.">
      <Field label="Full Name" type="text" value={fullName} onChange={setFullName} placeholder="Your name" onEnter={handleJoin} />
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" onEnter={handleJoin} />
      <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="At least 6 characters" onEnter={handleJoin} />
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <PrimaryButton loading={loading} onClick={handleJoin}>Create Account</PrimaryButton>

      {/* perks */}
      <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:22, padding:'16px', background:'rgba(57,255,20,0.03)', border:'1px solid rgba(57,255,20,0.12)', borderRadius:12 }}>
        {['Full AI model — all sports','All Tier-1 locks & scam plays','Auto-updating plays + alerts'].map(p=>(
          <div key={p} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'rgba(255,255,255,0.75)' }}>
            <i className="ti ti-circle-check-filled" style={{ fontSize:15, color:GREEN }} />{p}
          </div>
        ))}
      </div>

      <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:'rgba(255,255,255,0.5)' }}>
        Already have an account?{' '}
        <span onClick={()=>router.push('/signin')} style={{ color:GREEN, fontWeight:700, cursor:'pointer' }}>Sign in →</span>
      </div>
    </AuthShell>
  );
}
