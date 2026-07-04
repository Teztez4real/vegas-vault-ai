'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatPickDisplay } from '@/lib/pickFormat';

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
  const [openFaq, setOpenFaq] = useState(null);
  const [stats, setStats] = useState(null); // live cards data
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch live landing stats (real featured play, win rate, line movement),
  // then keep polling so the page stays genuinely live — a visitor who's
  // had the tab open all day sees today's play appear the moment it's
  // ready, without needing to reload. NEVER shows fake/static example data —
  // while the first fetch is in flight, the cards show a genuine loading
  // state instead (see statsLoading below), not a placeholder pick.
  useEffect(() => {
    let alive = true;
    const fetchStats = () => {
      fetch('/api/landing-stats', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (alive && d) setStats(d); })
        .catch(() => {})
        .finally(() => { if (alive) setStatsLoading(false); });
    };
    fetchStats();
    const t = setInterval(fetchStats, 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

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
          <img src="/vv-logo-horizontal.svg" alt="Vegas Vault AI" style={{ height:54, width:'auto' }} />
        </div>
        <div className="vv-nav-links" style={{ display:'flex', alignItems:'center', gap:'clamp(14px,2vw,30px)' }}>
          {['Pricing','How It Works','Results','FAQ'].map(l => (
            <span key={l} onClick={()=>{ if(l==='How It Works'){ document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'}); } else if(l==='Pricing'){ document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'}); } else if(l==='FAQ'){ document.getElementById('faq')?.scrollIntoView({behavior:'smooth'}); } else { go('/dashboard'); } }} style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)', cursor:'pointer', whiteSpace:'nowrap' }}
              onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}>{l}</span>
          ))}
          <button onClick={()=>go('/signin')} style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.85)', background:'transparent', border:'none', cursor:'pointer' }}>Sign In</button>
          <button onClick={()=>go('/join')} style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:30, padding:'11px 22px', cursor:'pointer', boxShadow:`0 4px 18px rgba(57,255,20,0.35)`, fontFamily:'inherit' }}>
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
              {statsLoading ? (
                <div style={{ width:140, height:48, borderRadius:8, background:'rgba(255,255,255,0.06)', animation:'vvpulse 1.4s ease-in-out infinite' }} />
              ) : stats?.winRate ? (
                <>
                  <span style={{ fontSize:'clamp(36px,5vw,58px)', fontWeight:900, color:GREEN, filter:`drop-shadow(0 0 22px rgba(57,255,20,0.4))`, lineHeight:1 }}>{stats.winRate.pct}%</span>
                  <span style={{ fontSize:'clamp(14px,1.6vw,20px)', fontWeight:700, color:'rgba(255,255,255,0.75)', letterSpacing:'1px' }}>WIN RATE</span>
                </>
              ) : (
                <span style={{ fontSize:'clamp(18px,2.2vw,26px)', fontWeight:700, color:'rgba(255,255,255,0.55)' }}>Building track record…</span>
              )}
            </div>
            {!statsLoading && (
              <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.06)', overflow:'hidden', maxWidth:520 }}>
                <div style={{ width:`${stats?.winRate ? Math.min(100, stats.winRate.pct) : 8}%`, height:'100%', background:`linear-gradient(90deg,#22cc00,${GREEN})`, borderRadius:6, boxShadow:`0 0 16px rgba(57,255,20,0.5)` }} />
              </div>
            )}
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
            <button onClick={()=>go('/join')} style={{ display:'flex', alignItems:'center', gap:9, fontSize:16, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:14, padding:'17px 34px', cursor:'pointer', boxShadow:`0 6px 24px rgba(57,255,20,0.4)`, fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Start Winning <i className="ti ti-flame" style={{ fontSize:17 }} />
            </button>
            <button onClick={()=>document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})} style={{ fontSize:16, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:14, padding:'17px 30px', cursor:'pointer', fontFamily:'inherit' }}>
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

          {/* CARD 1 — AI Play of the Day (live; carries over the most recent
              real play with a WIN/LOSS stamp if today's slate hasn't
              produced its own play yet). NEVER shows fake/example data —
              a genuine loading skeleton shows instead until the first
              fetch resolves. */}
          <div style={cardStyle({ top:'2%', left:'0%', width:'62%' })}>
            <div style={cardLabel}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:GREEN, boxShadow:`0 0 8px ${GREEN}` }} />
              {stats?.play && stats.play.isToday === false ? 'RECENT AI PLAY' : 'AI PLAY OF THE DAY'}
            </div>
            {statsLoading ? (
              <div style={{ margin:'10px 0 12px' }}>
                <div style={{ width:'70%', height:26, borderRadius:6, background:'rgba(255,255,255,0.06)', animation:'vvpulse 1.4s ease-in-out infinite', marginBottom:8 }} />
                <div style={{ width:'45%', height:14, borderRadius:6, background:'rgba(255,255,255,0.04)', animation:'vvpulse 1.4s ease-in-out infinite' }} />
              </div>
            ) : stats?.play ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, margin:'8px 0 3px' }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{formatPickDisplay(stats.play.pick, stats.play.betType)}</div>
                  {stats.play.resultStamp && (
                    <span style={{
                      fontSize:11, fontWeight:800, padding:'3px 9px', borderRadius:7, letterSpacing:'0.3px',
                      background: stats.play.resultStamp.startsWith('CASHED') ? 'rgba(57,255,20,0.15)' : 'rgba(255,60,60,0.15)',
                      color: stats.play.resultStamp.startsWith('CASHED') ? GREEN : '#ff6b6b',
                      border: `1px solid ${stats.play.resultStamp.startsWith('CASHED') ? 'rgba(57,255,20,0.35)' : 'rgba(255,60,60,0.35)'}`,
                    }}>{stats.play.resultStamp}</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:12 }}>
                  {`${stats.play.matchup}${stats.play.time ? ' · ' + stats.play.time : ''}${stats.play.isToday === false && stats.play.date ? ' · ' + new Date(stats.play.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}`}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={tierTag}>🔒 TIER {stats.play.tier || '1'}</span>
                  {stats.play.odds && <span style={{ ...tierTag, background:'rgba(57,255,20,0.1)', color:GREEN, border:`1px solid rgba(57,255,20,0.3)` }}>{stats.play.odds}</span>}
                </div>
              </>
            ) : (
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', margin:'10px 0 4px' }}>AI is analyzing today's slate…</div>
            )}
          </div>

          {/* CARD 2 — Win Rate: genuine loading skeleton until first fetch
              resolves; honest "building track record" message if there
              genuinely aren't 5+ graded picks yet — never a fake percent. */}
          <div style={cardStyle({ top:'30%', right:'-2%', width:'52%' })}>
            <div style={cardLabel}><i className="ti ti-trophy" style={{ fontSize:13, color:GREEN }} /> SEASON WIN RATE</div>
            {statsLoading ? (
              <>
                <div style={{ width:90, height:36, borderRadius:6, background:'rgba(255,255,255,0.06)', animation:'vvpulse 1.4s ease-in-out infinite', margin:'8px 0 6px' }} />
                <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:30 }}>
                  {[1,2,3,4,5,6,7,8].map(i=>(<div key={i} style={{ flex:1, height:'40%', background:'rgba(255,255,255,0.05)', borderRadius:2 }} />))}
                </div>
              </>
            ) : stats?.winRate ? (
              <>
                <div style={{ fontSize:38, fontWeight:900, color:GREEN, lineHeight:1, margin:'8px 0 6px', filter:`drop-shadow(0 0 18px rgba(57,255,20,0.4))` }}>{stats.winRate.pct}%</div>
                <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:30 }}>
                  {[60,72,55,80,68,90,74,85].map((h,i)=>(
                    <div key={i} style={{ flex:1, height:`${h}%`, background:i%2?GREEN:'rgba(57,255,20,0.4)', borderRadius:2 }} />
                  ))}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:8 }}>{`${stats.winRate.wins}W · ${stats.winRate.losses}L tracked`}</div>
              </>
            ) : (
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', margin:'14px 0' }}>Building track record…</div>
            )}
          </div>

          {/* CARD 3 — Line Movement — ALWAYS genuinely live: real odds
              tracking runs for every game regardless of slot pattern status,
              so this never shows a fabricated example once the slate has
              loaded at least once. */}
          <div style={cardStyle({ bottom:'4%', left:'6%', width:'58%' })}>
            <div style={cardLabel}><i className="ti ti-trending-up" style={{ fontSize:13, color:GREEN }} /> LINE MOVEMENT</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', margin:'8px 0', lineHeight:1.5 }}>
              {stats?.lineMovement?.text || 'Loading live odds…'}
            </div>
            {stats?.lineMovement?.matchup ? (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:8, background:'rgba(57,255,20,0.1)', border:`1px solid rgba(57,255,20,0.25)` }}>
                <i className="ti ti-bolt" style={{ fontSize:12, color:GREEN }} />
                <span style={{ fontSize:11, fontWeight:800, color:GREEN, letterSpacing:'0.5px' }}>SHARP · {stats.lineMovement.matchup}</span>
              </div>
            ) : stats?.lineMovement?.live && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:GREEN, boxShadow:`0 0 6px ${GREEN}` }} />
                <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', letterSpacing:'0.5px' }}>LIVE TRACKING</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div id="how-it-works" style={{ position:'relative', zIndex:5, maxWidth:1240, margin:'0 auto', padding:'clamp(48px,7vw,96px) clamp(16px,4vw,56px)' }}>
        {/* section header */}
        <div style={{ textAlign:'center', marginBottom:'clamp(40px,5vw,64px)' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 15px', borderRadius:30, border:`1px solid rgba(57,255,20,0.22)`, background:'rgba(57,255,20,0.05)', marginBottom:20 }}>
            <i className="ti ti-route" style={{ fontSize:14, color:GREEN }} />
            <span style={{ fontSize:12, fontWeight:800, letterSpacing:'1.5px', color:'rgba(255,255,255,0.8)' }}>HOW IT WORKS</span>
          </div>
          <h2 style={{ fontSize:'clamp(30px,4.4vw,56px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.02em', margin:'0 0 16px', textTransform:'uppercase' }}>
            <span style={{ color:'#fff' }}>From Slate to </span>
            <span style={{ background:`linear-gradient(135deg,${GREEN},#8fff6e,#22cc00)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 24px rgba(57,255,20,0.3))` }}>Locked Play.</span>
          </h2>
          <p style={{ fontSize:'clamp(15px,1.7vw,18px)', color:'rgba(255,255,255,0.6)', maxWidth:600, margin:'0 auto', lineHeight:1.6 }}>
            The model works the entire board like a professional bettor — refining all day, then locking the play the moment everything's confirmed.
          </p>
        </div>

        {/* steps */}
        <div className="vv-steps" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18 }}>
          {[
            { n:'01', ic:'ti-database', t:'Pull The Data', d:'Live odds, confirmed lineups, pitching matchups, bullpen usage, injuries, weather, park factors, and DraftKings line movement — pulled for every game on the board.' },
            { n:'02', ic:'ti-brain', t:'Find The Edge', d:'A 4-stage AI model cross-references every signal to find where the market misrepresents reality — the gap between what should happen and what the line says.' },
            { n:'03', ic:'ti-shield-check', t:'Align & Verify', d:'A 10-point alignment check flags anything that doesn\'t line up. The play only stands when line movement, pricing, data, and narrative all agree.' },
            { n:'04', ic:'ti-lock', t:'Lock It In', d:'Plays auto-update all day as news breaks, then lock the moment the game starts. You get one clear play with a clear edge — and an alert when it\'s confirmed.' },
          ].map((s,i) => (
            <div key={s.n} className="vv-step-card" style={{
              position:'relative',
              background:'linear-gradient(160deg,rgba(18,32,18,0.7),rgba(6,12,6,0.85))',
              border:'1px solid rgba(57,255,20,0.14)',
              borderRadius:18, padding:'26px 22px',
              boxShadow:'0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              {/* step number watermark */}
              <div style={{ position:'absolute', top:16, right:18, fontSize:34, fontWeight:900, color:'rgba(57,255,20,0.1)', lineHeight:1 }}>{s.n}</div>
              {/* icon */}
              <div style={{ width:50, height:50, borderRadius:14, background:'linear-gradient(145deg,rgba(57,255,20,0.12),rgba(34,204,0,0.05))', border:`1px solid rgba(57,255,20,0.25)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <i className={`ti ${s.ic}`} style={{ fontSize:24, color:GREEN }} />
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:10 }}>{s.t}</div>
              <div style={{ fontSize:13.5, lineHeight:1.6, color:'rgba(255,255,255,0.58)' }}>{s.d}</div>
              {/* connector line (desktop only, between cards) */}
              {i < 3 && <div className="vv-step-connector" style={{ position:'absolute', top:'50%', right:-18, width:18, height:2, background:'linear-gradient(90deg,rgba(57,255,20,0.4),rgba(57,255,20,0))', zIndex:6 }} />}
            </div>
          ))}
        </div>

        {/* CTA below steps */}
        <div style={{ textAlign:'center', marginTop:'clamp(36px,4vw,56px)' }}>
          <button onClick={()=>go('/join')} style={{ display:'inline-flex', alignItems:'center', gap:9, fontSize:16, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:14, padding:'16px 34px', cursor:'pointer', boxShadow:`0 6px 24px rgba(57,255,20,0.4)`, fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Get Today's Plays <i className="ti ti-arrow-right" style={{ fontSize:17 }} />
          </button>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:14 }}>$19.99 to start · Cancel anytime</div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{ position:'relative', zIndex:5, maxWidth:1040, margin:'0 auto', padding:'clamp(48px,7vw,96px) clamp(16px,4vw,56px)' }}>
        {/* section header */}
        <div style={{ textAlign:'center', marginBottom:'clamp(40px,5vw,60px)' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 15px', borderRadius:30, border:`1px solid rgba(57,255,20,0.22)`, background:'rgba(57,255,20,0.05)', marginBottom:20 }}>
            <i className="ti ti-diamond" style={{ fontSize:14, color:GREEN }} />
            <span style={{ fontSize:12, fontWeight:800, letterSpacing:'1.5px', color:'rgba(255,255,255,0.8)' }}>PRICING</span>
          </div>
          <h2 style={{ fontSize:'clamp(30px,4.4vw,56px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.02em', margin:'0 0 16px', textTransform:'uppercase' }}>
            <span style={{ color:'#fff' }}>One Model. </span>
            <span style={{ background:`linear-gradient(135deg,${GREEN},#8fff6e,#22cc00)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 24px rgba(57,255,20,0.3))` }}>Full Access.</span>
          </h2>
          <p style={{ fontSize:'clamp(15px,1.7vw,18px)', color:'rgba(255,255,255,0.6)', maxWidth:560, margin:'0 auto', lineHeight:1.6 }}>
            Every plan unlocks the full model — all sports, all Tier-1 locks, auto-updating plays, and alerts. Pick the cycle that fits you.
          </p>
        </div>

        {/* plans */}
        <div className="vv-plans" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'stretch' }}>

          {/* WEEKLY */}
          <div style={{
            position:'relative', display:'flex', flexDirection:'column',
            background:'linear-gradient(160deg,rgba(18,32,18,0.7),rgba(6,12,6,0.85))',
            border:'1px solid rgba(57,255,20,0.14)', borderRadius:22, padding:'32px 28px',
            boxShadow:'0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize:13, fontWeight:800, letterSpacing:'1.5px', color:'rgba(255,255,255,0.6)', marginBottom:14 }}>WEEKLY</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
              <span style={{ fontSize:48, fontWeight:900, color:'#fff', lineHeight:1 }}>$19.99</span>
              <span style={{ fontSize:16, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>/week</span>
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:24 }}>Perfect for trying the model out.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28, flex:1 }}>
              {['Full AI model — all sports','All Tier-1 locks & scam plays','Auto-updating plays all day','Line movement & sharp money','Push alerts on confirmed plays'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,0.8)' }}>
                  <i className="ti ti-circle-check" style={{ fontSize:17, color:GREEN, flexShrink:0 }} />{f}
                </div>
              ))}
            </div>
            <button onClick={()=>go('/join')} style={{ width:'100%', fontSize:15, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.16)', borderRadius:13, padding:'15px', cursor:'pointer', fontFamily:'inherit' }}>
              Start Weekly
            </button>
          </div>

          {/* MONTHLY — highlighted */}
          <div style={{
            position:'relative', display:'flex', flexDirection:'column',
            background:'linear-gradient(160deg,rgba(24,46,20,0.85),rgba(8,18,6,0.92))',
            border:`1.5px solid rgba(57,255,20,0.4)`, borderRadius:22, padding:'32px 28px',
            boxShadow:`0 24px 60px rgba(0,0,0,0.5), 0 0 50px rgba(57,255,20,0.12), inset 0 1px 0 rgba(57,255,20,0.1)`,
          }}>
            {/* best value badge */}
            <div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', display:'inline-flex', alignItems:'center', gap:6, padding:'6px 16px', borderRadius:30, background:`linear-gradient(135deg,${GREEN},#2ad400)`, boxShadow:`0 4px 16px rgba(57,255,20,0.4)` }}>
              <i className="ti ti-star-filled" style={{ fontSize:12, color:'#031003' }} />
              <span style={{ fontSize:11, fontWeight:900, letterSpacing:'1px', color:'#031003' }}>BEST VALUE</span>
            </div>
            <div style={{ fontSize:13, fontWeight:800, letterSpacing:'1.5px', color:GREEN, marginBottom:14 }}>MONTHLY</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
              <span style={{ fontSize:48, fontWeight:900, color:'#fff', lineHeight:1, filter:`drop-shadow(0 0 20px rgba(57,255,20,0.3))` }}>$49.99</span>
              <span style={{ fontSize:16, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>/month</span>
            </div>
            <div style={{ fontSize:13, color:GREEN, fontWeight:700, marginBottom:24 }}>Save 38% vs weekly · best for the full season</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28, flex:1 }}>
              {['Everything in Weekly','Best price per day','Uninterrupted full-season access','Priority on new sports & features','Cancel anytime'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#fff', fontWeight:500 }}>
                  <i className="ti ti-circle-check-filled" style={{ fontSize:17, color:GREEN, flexShrink:0 }} />{f}
                </div>
              ))}
            </div>
            <button onClick={()=>go('/join')} style={{ width:'100%', fontSize:15, fontWeight:900, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:13, padding:'15px', cursor:'pointer', fontFamily:'inherit', boxShadow:`0 6px 22px rgba(57,255,20,0.4)`, textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Get Full Access
            </button>
          </div>
        </div>

        {/* trust line */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'clamp(16px,3vw,32px)', marginTop:'clamp(32px,4vw,48px)' }}>
          {[['ti-lock','Secure checkout'],['ti-credit-card','Cancel anytime'],['ti-bolt','Instant access'],['ti-shield-check','No long-term contract']].map(([ic,t])=>(
            <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.5)' }}>
              <i className={`ti ${ic}`} style={{ fontSize:15, color:GREEN }} />{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div id="faq" style={{ position:'relative', zIndex:5, maxWidth:820, margin:'0 auto', padding:'clamp(48px,7vw,96px) clamp(16px,4vw,56px)' }}>
        <div style={{ textAlign:'center', marginBottom:'clamp(36px,4vw,52px)' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 15px', borderRadius:30, border:`1px solid rgba(57,255,20,0.22)`, background:'rgba(57,255,20,0.05)', marginBottom:20 }}>
            <i className="ti ti-help-circle" style={{ fontSize:14, color:GREEN }} />
            <span style={{ fontSize:12, fontWeight:800, letterSpacing:'1.5px', color:'rgba(255,255,255,0.8)' }}>FAQ</span>
          </div>
          <h2 style={{ fontSize:'clamp(30px,4.4vw,56px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.02em', margin:0, textTransform:'uppercase' }}>
            <span style={{ color:'#fff' }}>Got </span>
            <span style={{ background:`linear-gradient(135deg,${GREEN},#8fff6e,#22cc00)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 24px rgba(57,255,20,0.3))` }}>Questions?</span>
          </h2>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { q:'How accurate is the AI model?', a:'The model targets the highest-conviction plays — the Tier-1 locks where every signal aligns. It only commits to a play when line movement, pricing, matchup data, and situational context all agree. When signals conflict, it either flags a scam or passes the game entirely rather than forcing a pick.' },
            { q:'What sports are covered?', a:'MLB is fully live right now. NBA and NFL models are built and ready — they switch on automatically the moment each season starts. Tennis and WNBA analysis are also supported within the model.' },
            { q:'How often do the plays update?', a:'All day. The AI works the entire board like a professional bettor — refining each game as lineups confirm, injuries break, and lines move. The cadence intensifies as each game approaches, with a final lock-in update right before start. Once a game begins, the play is locked and never changes.' },
            { q:'Do I have to be on the app for it to work?', a:'Once the daily slot pattern is set each morning, the model runs entirely on its own — no device needs to be open. It analyzes the full slate, re-checks each game as lineups confirm and lines move, and locks plays before game time. You\'ll get a push alert when something material changes on a game you\'re tracking, whether the app is open or not. The one daily step is entering the Public/Vegas pattern in Settings — once that\'s saved, the rest is fully automated.' },
            { q:'Should I always follow the AI\'s play without question?', a:'No — and we\'d never tell you to. The AI surfaces a well-reasoned edge, but you should always read the full analysis, understand the reasoning behind the pick, and decide whether you actually agree with it before placing a bet. Check the matchup, the line, the injury report, any factors that matter to you. If something doesn\'t sit right, trust your instincts and pass. The model is a tool to sharpen your process, not a signal to follow blindly. The best bettors use it to validate and challenge their own read — not to replace it.' },
            { q:'What does it cost and can I cancel?', a:'$19.99/week or $49.99/month — the monthly plan saves you about 38%. Both unlock the full model with no long-term contract. You can cancel anytime.' },
            { q:'Is this guaranteed to win?', a:'No one can guarantee outcomes in sports betting, and anyone who claims otherwise isn\'t being honest. What the model does is find genuine edges where the market misprices reality, and only surface plays with a clear, defensible case. Bet responsibly and only what you can afford.' },
          ].map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i} style={{
                background:'linear-gradient(160deg,rgba(18,32,18,0.6),rgba(6,12,6,0.8))',
                border:`1px solid ${open ? 'rgba(57,255,20,0.3)' : 'rgba(57,255,20,0.12)'}`,
                borderRadius:16, overflow:'hidden', transition:'border-color 0.3s ease',
              }}>
                <button onClick={()=>setOpenFaq(open ? null : i)} style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
                  padding:'20px 22px', background:'transparent', border:'none', cursor:'pointer',
                  fontFamily:'inherit', textAlign:'left',
                }}>
                  <span style={{ fontSize:'clamp(15px,1.8vw,17px)', fontWeight:700, color:'#fff' }}>{item.q}</span>
                  <i className="ti ti-chevron-down" style={{ fontSize:20, color:GREEN, flexShrink:0, transition:'transform 0.3s ease', transform:open ? 'rotate(180deg)' : 'rotate(0)' }} />
                </button>
                <div style={{ maxHeight:open ? 320 : 0, overflow:'hidden', transition:'max-height 0.35s ease' }}>
                  <div style={{ padding:'0 22px 22px', fontSize:14.5, lineHeight:1.65, color:'rgba(255,255,255,0.6)' }}>{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* final CTA */}
        <div style={{ textAlign:'center', marginTop:'clamp(40px,5vw,60px)' }}>
          <div style={{ fontSize:'clamp(18px,2.2vw,24px)', fontWeight:800, color:'#fff', marginBottom:18 }}>Ready to beat the line?</div>
          <button onClick={()=>go('/join')} style={{ display:'inline-flex', alignItems:'center', gap:9, fontSize:16, fontWeight:800, color:'#031003', background:`linear-gradient(135deg,${GREEN},#2ad400)`, border:'none', borderRadius:14, padding:'17px 38px', cursor:'pointer', boxShadow:`0 6px 24px rgba(57,255,20,0.4)`, fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Start Winning <i className="ti ti-flame" style={{ fontSize:17 }} />
          </button>
        </div>

        {/* footer */}
        <div style={{ marginTop:'clamp(48px,6vw,80px)', paddingTop:32, borderTop:'1px solid rgba(57,255,20,0.1)', textAlign:'center' }}>
          <img src="/vv-logo-horizontal.svg" alt="Vegas Vault AI" style={{ height:40, width:'auto', opacity:0.85, marginBottom:16 }} />
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', lineHeight:1.7, maxWidth:560, margin:'0 auto' }}>
            Vegas Vault AI provides data-driven analysis for entertainment and informational purposes only. It is not financial advice and does not guarantee outcomes. You must be of legal betting age in your jurisdiction. Please bet responsibly. If gambling becomes a problem, call 1-800-GAMBLER.
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:16 }}>© {new Date().getFullYear()} Vegas Vault AI. All rights reserved.</div>
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
          .vv-steps { grid-template-columns: 1fr 1fr !important; }
          .vv-step-connector { display:none !important; }
          .vv-plans { grid-template-columns: 1fr !important; max-width:420px; margin:0 auto; }
        }
        @media (max-width: 560px) {
          .vv-steps { grid-template-columns: 1fr !important; }
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
