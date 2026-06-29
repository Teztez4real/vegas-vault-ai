'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const GREEN = '#39FF14';
const ADMIN_EMAIL = 'battlecortez@gmail.com';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  async function handleSignIn() {
    if (!email || !pw) { setError('Enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      if (!supabase) { setError('Auth unavailable. Try again later.'); setLoading(false); return; }
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.user?.email === ADMIN_EMAIL) { localStorage.setItem('vv_admin','1'); }
      router.replace('/dashboard');
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to access today's plays.">
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" onEnter={handleSignIn} />
      <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" onEnter={handleSignIn} />
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <PrimaryButton loading={loading} onClick={handleSignIn}>Sign In</PrimaryButton>
      <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:'rgba(255,255,255,0.5)' }}>
        New here?{' '}
        <span onClick={()=>router.push('/join')} style={{ color:GREEN, fontWeight:700, cursor:'pointer' }}>Join now →</span>
      </div>
    </AuthShell>
  );
}

/* ── shared auth UI (also used by Join page) ─────────────────────────────────── */
export function AuthShell({ title, subtitle, children }) {
  const router = useRouter();
  return (
    <div style={{ minHeight:'100vh', background:'#030603', color:'#fff', fontFamily:"'Inter',system-ui,sans-serif", display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden' }}>
      {/* ambient */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(rgba(57,255,20,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.025) 1px,transparent 1px)`, backgroundSize:'48px 48px', pointerEvents:'none' }} />
      <div style={{ position:'fixed', top:'-20%', right:'-10%', width:'50vw', height:'50vw', maxWidth:600, maxHeight:600, background:`radial-gradient(circle,rgba(57,255,20,0.06) 0%,rgba(57,255,20,0) 65%)`, pointerEvents:'none' }} />

      {/* logo */}
      <img src="/vv-logo-horizontal.svg" alt="Vegas Vault AI" onClick={()=>router.push('/')} style={{ height:48, width:'auto', marginBottom:36, cursor:'pointer', position:'relative', zIndex:2 }} />

      {/* card */}
      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:420, background:'linear-gradient(160deg,rgba(18,32,18,0.8),rgba(6,12,6,0.9))', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:`1px solid rgba(57,255,20,0.18)`, borderRadius:24, padding:'clamp(28px,5vw,40px)', boxShadow:'0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize:'clamp(24px,4vw,30px)', fontWeight:900, color:'#fff', marginBottom:6, letterSpacing:'-0.02em' }}>{title}</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)', marginBottom:28 }}>{subtitle}</div>
        {children}
      </div>

      <div onClick={()=>router.push('/')} style={{ position:'relative', zIndex:2, marginTop:24, fontSize:13, color:'rgba(255,255,255,0.4)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
        <i className="ti ti-arrow-left" style={{ fontSize:14 }} /> Back to home
      </div>
    </div>
  );
}

export function Field({ label, type, value, onChange, placeholder, onEnter }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:7, letterSpacing:'0.3px' }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter' && onEnter) onEnter(); }}
        style={{ width:'100%', padding:'13px 15px', fontSize:15, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:11, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.2s ease' }}
        onFocus={e=>e.target.style.borderColor='rgba(57,255,20,0.5)'}
        onBlur={e=>e.target.style.borderColor='rgba(57,255,20,0.15)'}
      />
    </div>
  );
}

export function ErrorMsg({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#ff5a5a', background:'rgba(255,60,60,0.08)', border:'1px solid rgba(255,60,60,0.2)', borderRadius:10, padding:'10px 13px', marginBottom:16 }}>
      <i className="ti ti-alert-circle" style={{ fontSize:15 }} />{children}
    </div>
  );
}

export function PrimaryButton({ loading, onClick, children }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ width:'100%', fontSize:15, fontWeight:900, color:'#031003', background:loading ? 'rgba(57,255,20,0.5)' : `linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:13, padding:'15px', cursor:loading?'wait':'pointer', fontFamily:'inherit', boxShadow:`0 6px 22px rgba(57,255,20,0.35)`, textTransform:'uppercase', letterSpacing:'0.5px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
      {loading ? <span style={{ width:16, height:16, border:'2px solid rgba(3,16,3,0.3)', borderTopColor:'#031003', borderRadius:'50%', animation:'vvspin 0.7s linear infinite' }} /> : children}
      <style>{`@keyframes vvspin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
