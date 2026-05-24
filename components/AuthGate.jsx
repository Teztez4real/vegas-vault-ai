'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ── ADMIN EMAILS ──────────────────────────────────────────────────────────────
// Add any email that should have full admin access
const ADMIN_EMAILS = [
  'teztez4real@gmail.com',
  'teztez4real@icloud.com',
  'teztez4real@yahoo.com',
];

export function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.some(a => a.toLowerCase() === email.toLowerCase());
}

// ── SVG COMPONENTS ────────────────────────────────────────────────────────────

function VLogo({ size = 56 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 56 45" fill="none">
      <path d="M28 44L2 4h8l18 30L46 4h8L28 44z" fill="none" stroke="#c9a227" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M28 44L14 20h8l6 10 6-10h8L28 44z" fill="#c9a227" opacity="0.25"/>
      <line x1="10" y1="4" x2="46" y2="4" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function RadarScan() {
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {[0.25,0.5,0.75,1].map((f,i)=>(
        <circle key={i} cx={70} cy={70} r={70*f} fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="1"/>
      ))}
      {[0,45,90,135].map((a,i)=>(
        <line key={i} x1={70} y1={70}
          x2={70+Math.cos(a*Math.PI/180)*70}
          y2={70+Math.sin(a*Math.PI/180)*70}
          stroke="rgba(16,185,129,0.1)" strokeWidth="1"/>
      ))}
      {/* Sweep line */}
      <line x1={70} y1={70} x2={70} y2={5} stroke="#10b981" strokeWidth="1.5" opacity="0.7"
        style={{ transformOrigin:"70px 70px", animation:"sweep 3s linear infinite" }}/>
      {/* Dots */}
      {[[45,35],[90,55],[60,80],[100,40]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={2.5} fill="#10b981" opacity="0.8"/>
      ))}
      <circle cx={70} cy={70} r={4} fill="none" stroke="rgba(16,185,129,0.4)" strokeWidth="1"/>
      <style>{`@keyframes sweep{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`}</style>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── MAIN AUTH GATE ────────────────────────────────────────────────────────────

export default function AuthGate() {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');
  const [error, setError]       = useState('');
  const [inputFocus, setInputFocus] = useState(null);

  async function handleSubmit() {
    setLoading(true); setError(''); setMessage('');
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm your account.');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); }
      else {
        const admin = isAdmin(data.user?.email);
        // Store admin flag in localStorage for the dashboard to read
        if (admin) localStorage.setItem('vv_admin', '1');
        else localStorage.removeItem('vv_admin');
        window.location.href = '/dashboard';
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email address first.'); return; }
    await supabase.auth.resetPasswordForEmail(email);
    setMessage('Password reset email sent.');
  }

  const inputStyle = (name) => ({
    width: '100%', padding: '12px 14px 12px 42px',
    background: inputFocus === name ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${inputFocus === name ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10, color: '#e2e8f0', fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ minHeight:'100vh', background:'#07091a', display:'flex', flexDirection:'column', fontFamily:"'DM Mono','Courier New',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#07091a;overflow-x:hidden;}
        input::placeholder{color:#3a4a5e;}
        input{font-family:inherit;}
        button{font-family:inherit;}
        .auth-hover:hover{background:rgba(255,255,255,0.05)!important;border-color:rgba(255,255,255,0.15)!important;}
        .tab-hover:hover{color:#94a3b8!important;}
      `}</style>

      <div style={{ flex:1, display:'flex', minHeight:'100vh' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          flex:'0 0 480px', position:'relative', overflow:'hidden',
          background:'linear-gradient(160deg, #07091a 0%, #0a0d22 40%, #070b18 100%)',
          borderRight:'1px solid rgba(255,255,255,0.05)',
          display:'flex', flexDirection:'column', padding:'48px 44px',
        }}>
          {/* Background glow */}
          <div style={{ position:'absolute', top:'-10%', left:'15%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(201,162,39,0.06) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:'20%', right:'-10%', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', pointerEvents:'none' }}/>

          {/* Stadium image overlay */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(7,9,26,0.3) 0%, rgba(7,9,26,0.1) 30%, rgba(7,9,26,0.7) 70%, rgba(7,9,26,0.95) 100%)', pointerEvents:'none', zIndex:1 }}/>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'55%', background:'linear-gradient(to top, #07091a 0%, transparent 100%)', pointerEvents:'none', zIndex:2 }}/>

          {/* Simulated stadium silhouette */}
          <div style={{ position:'absolute', bottom:'22%', left:'50%', transform:'translateX(-50%)', width:360, height:180, zIndex:1, opacity:0.15 }}>
            <svg viewBox="0 0 360 180" fill="none" style={{ width:'100%', height:'100%' }}>
              <ellipse cx={180} cy={160} rx={170} ry={50} fill="none" stroke="#60a5fa" strokeWidth="1"/>
              <ellipse cx={180} cy={150} rx={130} ry={38} fill="none" stroke="#60a5fa" strokeWidth="0.5"/>
              <path d="M10 160 Q30 80 90 60 Q150 40 180 50 Q210 40 270 60 Q330 80 350 160" stroke="#60a5fa" strokeWidth="1" fill="none"/>
              {[40,80,120,160,200,240,280,320].map((x,i)=>(
                <line key={i} x1={x} y1={160} x2={x + (i<4?-10:10)} y2={80} stroke="#60a5fa" strokeWidth="0.5" opacity="0.5"/>
              ))}
            </svg>
          </div>

          {/* Gold beam */}
          <div style={{ position:'absolute', bottom:'20%', left:'50%', transform:'translateX(-50%)', width:3, height:'45%', background:'linear-gradient(to top, #c9a227, rgba(201,162,39,0))', zIndex:3, borderRadius:2 }}/>
          <div style={{ position:'absolute', bottom:'20%', left:'50%', transform:'translateX(-50%)', width:60, height:'45%', background:'linear-gradient(to top, rgba(201,162,39,0.15), transparent)', zIndex:2, borderRadius:'50%' }}/>

          {/* Content */}
          <div style={{ position:'relative', zIndex:10, flex:1, display:'flex', flexDirection:'column' }}>
            {/* Logo */}
            <div style={{ marginBottom:32 }}>
              <VLogo size={52}/>
              <div style={{ marginTop:10 }}>
                <span style={{ fontSize:18, fontWeight:700, color:'#f8fafc', letterSpacing:'0.1em' }}>VEGAS </span>
                <span style={{ fontSize:18, fontWeight:700, color:'#c9a227', letterSpacing:'0.1em' }}>VAULT</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <div style={{ flex:1, height:1, background:'linear-gradient(to right, rgba(201,162,39,0.4), transparent)' }}/>
                <span style={{ fontSize:11, color:'#c9a227', letterSpacing:'0.2em' }}>AI</span>
                <div style={{ flex:1, height:1, background:'linear-gradient(to left, rgba(201,162,39,0.4), transparent)' }}/>
              </div>
            </div>

            {/* Headline */}
            <div style={{ marginBottom:32 }}>
              <div style={{ fontSize:26, fontWeight:800, color:'#f8fafc', letterSpacing:'0.04em', lineHeight:1.15, marginBottom:12 }}>
                <span style={{ color:'#c9a227' }}>AI-POWERED</span> SPORTS{'\n'}
                <span style={{ display:'block' }}>INTELLIGENCE</span>
              </div>
              <div style={{ fontSize:12, color:'#64748b', lineHeight:1.6, marginBottom:4 }}>Advanced algorithms. Real-time data.</div>
              <div style={{ fontSize:12, color:'#c9a227', fontWeight:600 }}>Unfair advantages.</div>
            </div>

            {/* Feature list */}
            <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:'auto' }}>
              {[
                { icon:'◉', title:'AI PREDICTIONS', desc:'Proprietary models with ', accent:'68%+ win rate.', color:'#c9a227', bg:'rgba(201,162,39,0.1)' },
                { icon:'🔒', title:'VAULT LOCKS',    desc:'Top tier plays backed by sharp data & analytics.', color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
                { icon:'📊', title:'REAL-TIME EDGE', desc:'Beat the market with ', accent:'live odds movement & alerts.', color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
              ].map((item,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:item.bg, border:`1px solid ${item.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:4 }}>{item.title}</div>
                    <div style={{ fontSize:12, color:'#4a5568', lineHeight:1.5 }}>
                      {item.desc}{item.accent && <span style={{ color:item.color }}>{item.accent}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live System Status */}
            <div style={{ marginTop:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>LIVE SYSTEM STATUS</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }}/>
                  <span style={{ fontSize:11, color:'#64748b' }}>AI ENGINE: </span>
                  <span style={{ fontSize:11, color:'#10b981', fontWeight:700 }}>ONLINE</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }}/>
                  <span style={{ fontSize:11, color:'#64748b' }}>MARKET SCANNER: </span>
                  <span style={{ fontSize:11, color:'#10b981', fontWeight:700 }}>ACTIVE</span>
                </div>
              </div>
              <RadarScan/>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'48px 40px',
          background:'#07091a',
        }}>
          <div style={{ width:'100%', maxWidth:480 }}>

            {/* Tabs */}
            <div style={{ display:'flex', marginBottom:36, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              {['login','signup'].map((m,i)=>(
                <button key={m} onClick={()=>{setMode(m);setError('');setMessage('');}} className="tab-hover" style={{
                  flex:1, padding:'12px 0', fontSize:13, fontWeight:m===mode?700:400,
                  color:m===mode?'#c9a227':'#3a4a5e',
                  background:'none', border:'none', cursor:'pointer',
                  borderBottom:m===mode?'2px solid #c9a227':'2px solid transparent',
                  letterSpacing:'0.05em', transition:'all 0.15s',
                }}>
                  {m==='login'?'SIGN IN':'SIGN UP'}
                </button>
              ))}
            </div>

            {/* Heading */}
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:'#f8fafc', marginBottom:8, letterSpacing:'-0.01em' }}>
                {mode==='login' ? 'Welcome back,' : 'Create your account,'}
              </h1>
              <p style={{ fontSize:13, color:'#4a5568' }}>
                {mode==='login'
                  ? <>Log in to access your <span style={{ color:'#c9a227' }}>Vegas Vault AI</span> dashboard.</>
                  : <>Join <span style={{ color:'#c9a227' }}>Vegas Vault AI</span> and start winning.</>
                }
              </p>
            </div>

            {/* Email field */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:'#4a5568', letterSpacing:'0.1em', fontWeight:700, display:'block', marginBottom:7 }}>EMAIL ADDRESS</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#2d3a4a', fontSize:14, pointerEvents:'none' }}>✉</span>
                <input
                  type="email" placeholder="you@example.com" value={email}
                  onChange={e=>setEmail(e.target.value)}
                  onFocus={()=>setInputFocus('email')} onBlur={()=>setInputFocus(null)}
                  style={inputStyle('email')}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:10, color:'#4a5568', letterSpacing:'0.1em', fontWeight:700, display:'block', marginBottom:7 }}>PASSWORD</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#2d3a4a', fontSize:14, pointerEvents:'none' }}>🔒</span>
                <input
                  type={showPw?'text':'password'} placeholder="Enter your password" value={password}
                  onChange={e=>setPassword(e.target.value)}
                  onFocus={()=>setInputFocus('password')} onBlur={()=>setInputFocus(null)}
                  onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                  style={{ ...inputStyle('password'), paddingRight:44 }}
                />
                <button onClick={()=>setShowPw(!showPw)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#3a4a5e', fontSize:14, padding:0, lineHeight:1 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {mode==='login'&&(
              <div style={{ textAlign:'right', marginBottom:22 }}>
                <button onClick={handleForgotPassword} style={{ background:'none', border:'none', color:'#c9a227', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Forgot password?</button>
              </div>
            )}

            {/* Error / success */}
            {error&&<div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, fontSize:12, color:'#f87171' }}>{error}</div>}
            {message&&<div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:8, fontSize:12, color:'#4ade80' }}>{message}</div>}

            {/* Primary button */}
            <button
              onClick={handleSubmit} disabled={loading}
              style={{ width:'100%', padding:'14px 0', marginBottom:20, background:loading?'rgba(201,162,39,0.4)':'linear-gradient(135deg, #c9a227, #a07d1a)', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#000', cursor:loading?'not-allowed':'pointer', letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 4px 24px rgba(201,162,39,0.25)', transition:'all 0.15s' }}
            >
              {loading ? 'Please wait…' : mode==='login' ? 'LOG IN TO VAULT' : 'CREATE ACCOUNT'}
              {!loading && <span style={{ fontSize:16 }}>→</span>}
            </button>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }}/>
              <span style={{ fontSize:10, color:'#2d3a4a', letterSpacing:'0.1em' }}>OR CONTINUE WITH</span>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }}/>
            </div>

            {/* Google */}
            <button onClick={handleGoogle} className="auth-hover" style={{ width:'100%', padding:'12px 0', marginBottom:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, fontSize:13, color:'#e2e8f0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.15s' }}>
              <GoogleIcon/> Continue with Google
            </button>

            {/* Apple */}
            <button className="auth-hover" style={{ width:'100%', padding:'12px 0', marginBottom:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, fontSize:13, color:'#e2e8f0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.15s' }}>
              <span style={{ fontSize:16 }}>🍎</span> Continue with Apple
            </button>

            {/* Security note */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'#2d3a4a' }}>🔒</span>
              <span style={{ fontSize:11, color:'#2d3a4a' }}>Bank-level encryption. Your data is always protected.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'14px 0', borderTop:'1px solid rgba(255,255,255,0.04)', fontSize:11, color:'#1e2a3a' }}>
        © 2026 <span style={{ color:'#c9a227' }}>Vegas Vault AI</span>. All rights reserved.
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media(max-width:860px){
          .vv-left-panel{display:none!important;}
          .vv-right-form{padding:32px 20px!important;}
        }
      `}</style>
    </div>
  );
}
