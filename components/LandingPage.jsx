'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── VEGAS VAULT AI — LANDING PAGE ────────────────────────────────────────────
// Structure modeled on a modern AI fintech hero (two-column: copy left,
// layered glass data cards right), rendered entirely in the Vegas Vault
// battery-green / dark AI-OS identity. Self-contained — no dependency on the
// dashboard component, so it can't affect app stability.

const GREEN = '#39FF14';
const TICKER = [
  '$19.99 TO START', 'AI-POWERED ANALYSIS', 'TIER-1 LOCKS', 'LINE MOVEMENT TRACKING',
  'SCAM PLAY DETECTION', 'MLB · NBA · NFL', 'SHARP MONEY SIGNALS', 'AUTO-UPDATING PLAYS',
];

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // If already signed in, skip the landing page and go to the dashboard.
  // EXCEPTION: ?preview in the URL lets you view the landing page while
  // signed in (for reviewing the design before it goes live).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview');
        if (!isPreview && supabase) {
          const { data } = await supabase.auth.getSession();
          if (alive && data?.session?.user) { router.replace('/dashboard'); return; }
        }
      } catch {}
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
  }, [router]);

  if (checking) {
    return (
      <div style={{ minHeight:'100vh', background:'#030603', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:34, height:34, border:`3px solid rgba(57,255,20,0.2)`, borderTopColor:GREEN, borderRadius:'50%', animation:'vvspin 0.8s linear infinite' }} />
        <style>{`@keyframes vvspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const go = (path) => router.push(path);

  return (
    <div style={{ minHeight:'100vh', background:'#030603', color:'#fff', fontFamily:"'Inter',system-ui,sans-serif", overflowX:'hidden', position:'relative' }}>
      {/* ambient grid + auras */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(rgba(57,255,20,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.025) 1px,transparent 1px)`, backgroundSize:'48px 48px', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', top:'-15%', right:'-8%', width:'45vw', height:'45vw', maxWidth:650, maxHeight:650, background:`radial-gradient(circle,rgba(57,255,20,0.07) 0%,rgba(57,255,20,0) 65%)`, pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:'-20%', left:'-10%', width:'50vw', height:'50vw', maxWidth:700, maxHeight:700, background:`radial-gradient(circle,rgba(57,255,20,0.05) 0%,rgba(57,255,20,0) 68%)`, pointerEvents:'none', zIndex:0 }} />

      {/* ── NAV ── */}
      <nav style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px clamp(16px,4vw,56px)', maxWidth:1400, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/vv-logo.svg" alt="Vegas Vault AI" style={{ height:46, width:'auto' }} />
        </div>
        <div className="vv-nav-links" style={{ display:'flex', alignItems:'center', gap:'clamp(14px,2vw,30px)' }}>
          {['Pricing','How It Works','Results','FAQ'].map(l => (
            <span key={l} onClick={()=>go('/dashboard')} style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)', cursor:'pointer', whiteSpace:'nowrap' }}
              onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}>{l}</span>
          ))}
          <button onClick={()=>go('/dashboard')} style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.85)', background:'transparent', border:'none', cursor:'pointer' }}>Sign In</button>
          <button onClick={()=>go('/dashboard')} style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:30, padding:'11px 22px', cursor:'pointer', boxShadow:`0 4px 18px rgba(57,255,20,0.35)`, fontFamily:'inherit' }}>
            Join Now <span style={{ fontSize:16 }}>›</span>
          </button>
        </div>
      </nav>

      {/* ── TICKER STRIP ── */}
      <div style={{ position:'relative', zIndex:5, borderTop:'1px solid rgba(57,255,20,0.08)', borderBottom:'1px solid rgba(57,255,20,0.08)', padding:'12px 0', overflow:'hidden', background:'rgba(57,255,20,0.015)' }}>
        <div style={{ display:'flex', gap:0, whiteSpace:'nowrap', animation:'vvticker 28s linear infinite', width:'max-content' }}>
          {[...TICKER, ...TICKER].map((t,i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', fontSize:12, fontWeight:700, letterSpacing:'1.5px', color:'rgba(255,255,255,0.55)', padding:'0 32px' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:GREEN, marginRight:32, boxShadow:`0 0 8px ${GREEN}` }} />{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO ── */}
      <div className="vv-hero" style={{ position:'relative', zIndex:5, maxWidth:1400, margin:'0 auto', padding:'clamp(36px,5vw,72px) clamp(16px,4vw,56px)', display:'grid', gridTemplateColumns:'1.05fr 1fr', gap:'clamp(32px,4vw,64px)', alignItems:'center' }}>

        {/* LEFT: copy */}
        <div>
          {/* live pill */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'9px 16px', borderRadius:30, border:`1px solid rgba(57,255,20,0.25)`, background:'rgba(57,255,20,0.05)', marginBottom:28 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:GREEN, boxShadow:`0 0 10px ${GREEN}`, animation:'vvpulse 1.8s ease-in-out infinite' }} />
            <span style={{ fontSize:12.5, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'0.3px' }}>Today's slate is live · AI analyzing now</span>
          </div>

          {/* headline */}
          <h1 style={{ fontSize:'clamp(42px,6.4vw,92px)', fontWeight:900, lineHeight:0.96, letterSpacing:'-0.02em', margin:'0 0 28px', textTransform:'uppercase' }}>
            <span style={{ color:'#fff' }}>The AI That</span><br/>
            <span style={{ background:`linear-gradient(135deg,${GREEN} 0%,#8fff6e 45%,#22cc00 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 28px rgba(57,255,20,0.35))` }}>Beats The Line.</span>
          </h1>

          {/* big stat + bar */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:12 }}>
              <span style={{ fontSize:'clamp(36px,5vw,58px)', fontWeight:900, color:GREEN, filter:`drop-shadow(0 0 22px rgba(57,255,20,0.4))`, lineHeight:1 }}>72%+</span>
              <span style={{ fontSize:'clamp(14px,1.6vw,20px)', fontWeight:700, color:'rgba(255,255,255,0.75)', letterSpacing:'1px' }}>TIER-1 HIT RATE</span>
            </div>
            <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.06)', overflow:'hidden', maxWidth:520 }}>
              <div style={{ width:'72%', height:'100%', background:`linear-gradient(90deg,#22cc00,${GREEN})`, borderRadius:6, boxShadow:`0 0 16px rgba(57,255,20,0.5)` }} />
            </div>
          </div>

          {/* feature chips */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:28 }}>
            {[['ti-target','Scam Play Detection'],['ti-bolt','Auto-Updating Picks'],['ti-cash','$19.99 to Start'],['ti-lock','Tier-1 Locks']].map(([ic,label]) => (
              <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 15px', borderRadius:10, border:`1px solid rgba(57,255,20,0.18)`, background:'rgba(57,255,20,0.04)', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.88)' }}>
                <i className={`ti ${ic}`} style={{ fontSize:14, color:GREEN }} />{label}
              </span>
            ))}
          </div>

          {/* description */}
          <p style={{ fontSize:'clamp(15px,1.7vw,18px)', lineHeight:1.6, color:'rgba(255,255,255,0.62)', maxWidth:540, margin:'0 0 32px' }}>
            An anonymous AI model that finds where the market misrepresents reality — analyzing pitching, matchups, line movement, and sharp money across MLB, NBA, and NFL. <span style={{ color:'#fff', fontWeight:700 }}>Plays auto-update all day</span> and lock when the game starts.
          </p>

          {/* CTAs */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:14 }}>
            <button onClick={()=>go('/dashboard')} style={{ display:'flex', alignItems:'center', gap:9, fontSize:16, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:14, padding:'17px 34px', cursor:'pointer', boxShadow:`0 6px 24px rgba(57,255,20,0.4)`, fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Start Winning <i className="ti ti-flame" style={{ fontSize:17 }} />
            </button>
            <button onClick={()=>go('/dashboard')} style={{ fontSize:16, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:14, padding:'17px 30px', cursor:'pointer', fontFamily:'inherit' }}>
              See How It Works
            </button>
          </div>
        </div>

        {/* RIGHT: layered glass data cards */}
        <div className="vv-hero-cards" style={{ position:'relative', minHeight:540 }}>
          {/* base panel — mock dashboard surface */}
          <div style={{ position:'absolute', inset:'8% 0 8% 4%', borderRadius:24, background:'linear-gradient(160deg,rgba(20,40,20,0.6),rgba(3,6,3,0.8))', border:'1px solid rgba(57,255,20,0.1)', boxShadow:'0 40px 100px rgba(0,0,0,0.6)', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(rgba(57,255,20,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.04) 1px,transparent 1px)`, backgroundSize:'32px 32px' }} />
          </div>

          {/* CARD 1 — AI Play of the Day */}
          <div style={cardStyle({ top:'2%', left:'0%', width:'62%' })}>
            <div style={cardLabel}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:GREEN, boxShadow:`0 0 8px ${GREEN}` }} />
              AI PLAY OF THE DAY
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', margin:'8px 0 3px' }}>Yankees −1.5</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:12 }}>NYY @ BOS · 7:10 PM ET</div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={tierTag}>🔒 TIER 1</span>
              <span style={{ ...tierTag, background:'rgba(57,255,20,0.1)', color:GREEN, border:`1px solid rgba(57,255,20,0.3)` }}>−115</span>
            </div>
          </div>

          {/* CARD 2 — Win Rate */}
          <div style={cardStyle({ top:'30%', right:'-2%', width:'52%' })}>
            <div style={cardLabel}><i className="ti ti-trophy" style={{ fontSize:13, color:GREEN }} /> SEASON WIN RATE</div>
            <div style={{ fontSize:38, fontWeight:900, color:GREEN, lineHeight:1, margin:'8px 0 6px', filter:`drop-shadow(0 0 18px rgba(57,255,20,0.4))` }}>72.4%</div>
            <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:30 }}>
              {[60,72,55,80,68,90,74,85].map((h,i)=>(
                <div key={i} style={{ flex:1, height:`${h}%`, background:i%2?GREEN:'rgba(57,255,20,0.4)', borderRadius:2 }} />
              ))}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:8 }}>Tier-1 plays · last 30 days</div>
          </div>

          {/* CARD 3 — Line Movement */}
          <div style={cardStyle({ bottom:'4%', left:'6%', width:'58%' })}>
            <div style={cardLabel}><i className="ti ti-trending-up" style={{ fontSize:13, color:GREEN }} /> LINE MOVEMENT</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', margin:'8px 0', lineHeight:1.5 }}>
              DraftKings opened <span style={{ color:'#fff', fontWeight:700 }}>−142</span> → now <span style={{ color:GREEN, fontWeight:800 }}>−158</span>
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:8, background:'rgba(57,255,20,0.1)', border:`1px solid rgba(57,255,20,0.25)` }}>
              <i className="ti ti-bolt" style={{ fontSize:12, color:GREEN }} />
              <span style={{ fontSize:11, fontWeight:800, color:GREEN, letterSpacing:'0.5px' }}>SHARP MONEY · YANKEES</span>
            </div>
          </div>
        </div>
      </div>

      {/* responsive + animations */}
      <style>{`
        @keyframes vvticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes vvpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 900px) {
          .vv-hero { grid-template-columns: 1fr !important; }
          .vv-hero-cards { min-height: 460px !important; margin-top: 12px; }
          .vv-nav-links span:not(:last-child) { display:none !important; }
        }
      `}</style>
    </div>
  );
}

// ── shared card styling ───────────────────────────────────────────────────────
function cardStyle(pos) {
  return {
    position:'absolute', ...pos,
    background:'linear-gradient(160deg,rgba(18,32,18,0.92),rgba(6,12,6,0.95))',
    backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
    border:'1px solid rgba(57,255,20,0.18)',
    borderRadius:18, padding:'16px 18px',
    boxShadow:'0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
    zIndex:3,
  };
}
const cardLabel = { display:'flex', alignItems:'center', gap:7, fontSize:11, fontWeight:800, letterSpacing:'1px', color:'rgba(255,255,255,0.55)' };
const tierTag = { fontSize:11, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.08)', padding:'5px 10px', borderRadius:7 };
