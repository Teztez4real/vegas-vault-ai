'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const ADMIN_EMAIL = 'battlecortez@gmail.com';
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Slot pattern state
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotPattern, setSlotPattern] = useState([]);
  const [slotNote, setSlotNote] = useState('');
  const [slotCount, setSlotCount] = useState(15);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotMsg, setSlotMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  // Load existing pattern when date changes
  useEffect(() => {
    fetch(`/api/slot-pattern?date=${slotDate}`)
      .then(r => r.json())
      .then(data => {
        if (data.pattern?.length) {
          setSlotPattern(data.pattern);
          setSlotCount(data.pattern.length);
          setSlotNote(data.note || '');
        } else {
          setSlotPattern([]);
        }
      }).catch(() => {});
  }, [slotDate]);

  // Build pattern array when count changes
  useEffect(() => {
    setSlotPattern(prev => {
      const arr = [...prev];
      while (arr.length < slotCount) arr.push('PUBLIC');
      return arr.slice(0, slotCount);
    });
  }, [slotCount]);

  async function saveSlotPattern() {
    setSlotSaving(true);
    setSlotMsg('');
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/slot-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: slotDate, pattern: slotPattern, note: slotNote, token: s?.access_token }),
      });
      const data = await res.json();
      if (data.success) setSlotMsg('✅ Pattern saved! Games will reload with new slots.');
      else setSlotMsg('❌ ' + (data.error || 'Save failed'));
    } catch (e) {
      setSlotMsg('❌ ' + e.message);
    }
    setSlotSaving(false);
  }

  function toggleSlot(i) {
    setSlotPattern(prev => {
      const arr = [...prev];
      arr[i] = arr[i] === 'VEGAS' ? 'PUBLIC' : 'VEGAS';
      return arr;
    });
  }

  function applyShorthand(str) {
    // Parse shorthand like "V PP VVVV PP VV PP V P"
    const pattern = str.toUpperCase().replace(/\s+/g, '').split('').map(c => c === 'V' ? 'VEGAS' : 'PUBLIC');
    if (pattern.length > 0) {
      setSlotPattern(pattern);
      setSlotCount(pattern.length);
    }
  }

  async function handleSubscribe(plan) {
    setSubLoading(plan);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setSubLoading(null);
  }

  async function handleManage() {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/dashboard';
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#07091a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", color:'#3a4a5e', fontSize:12, letterSpacing:'0.1em' }}>
      LOADING...
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#07091a', fontFamily:"'DM Mono','Courier New',monospace", color:'#e2e8f0' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} body{background:#07091a;}`}</style>

      {/* Header */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(7,9,26,0.96)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => window.location.href='/dashboard'} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#64748b', fontSize:13, padding:'6px 14px', cursor:'pointer', fontFamily:'inherit' }}>← Dashboard</button>
          <span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>Settings</span>
        </div>
        <div style={{ fontSize:11, color:'#3a4a5e' }}>{session?.user?.email || 'Not signed in'}</div>
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px' }}>

        {/* Subscription section */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:'#c9a227', marginBottom:16 }}>SUBSCRIPTION</div>

          <div style={{ background:'#0b0f1e', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden' }}>
            {/* Current status */}
            <div style={{ padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#f1f5f9', marginBottom:4 }}>Current Plan</div>
                <div style={{ fontSize:11, color:'#475569' }}>Unlock full AI analysis on every game</div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'#f87171', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:6, padding:'4px 10px' }}>FREE</div>
            </div>

            {/* Plans */}
            <div style={{ padding:'18px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { id:'weekly', label:'Weekly', price:'$19.99', period:'/week', features:['Full AI model', 'All games', 'Auto plays', 'Trell Rule alerts'], highlight:false },
                { id:'monthly', label:'Monthly', price:'$49.99', period:'/month', features:['Everything in weekly', 'Priority generation', 'Model updates', 'Early access'], highlight:true, badge:'Best Value' },
              ].map(plan => (
                <div key={plan.id} style={{ background: plan.highlight ? 'rgba(201,162,39,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${plan.highlight ? 'rgba(201,162,39,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius:12, padding:'16px 14px', position:'relative' }}>
                  {plan.badge && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#c9a227', color:'#000', fontSize:9, fontWeight:800, padding:'2px 10px', borderRadius:10, letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{plan.badge}</div>}
                  <div style={{ fontSize:11, fontWeight:700, color: plan.highlight ? '#c9a227' : '#94a3b8', letterSpacing:'0.08em', marginBottom:8 }}>{plan.label.toUpperCase()}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:12 }}>
                    <span style={{ fontSize:22, fontWeight:800, color:'#f1f5f9' }}>{plan.price}</span>
                    <span style={{ fontSize:10, color:'#475569' }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle:'none', marginBottom:14 }}>
                    {plan.features.map((f,i) => (
                      <li key={i} style={{ fontSize:10, color:'#64748b', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color:'#c9a227' }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => handleSubscribe(plan.id)} disabled={!!subLoading} style={{ width:'100%', padding:'9px 0', background: plan.highlight ? 'linear-gradient(135deg,#c9a227,#8b6d10)' : 'rgba(255,255,255,0.05)', border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11, fontWeight:700, color: plan.highlight ? '#000' : '#94a3b8', cursor:'pointer', letterSpacing:'0.06em', fontFamily:'inherit' }}>
                    {subLoading === plan.id ? 'Loading...' : 'Subscribe'}
                  </button>
                </div>
              ))}
            </div>

            {/* Manage existing */}
            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={handleManage} disabled={portalLoading} style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:11, color:'#64748b', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em' }}>
                {portalLoading ? 'Loading...' : 'Manage Existing Subscription →'}
              </button>
            </div>
          </div>
        </div>

        {/* Slot Pattern — Admin Only */}
        {session?.user?.email === ADMIN_EMAIL && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:'#c9a227', marginBottom:16 }}>🎰 DAILY SLOT PATTERN</div>
            <div style={{ background:'#0b0f1e', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px', overflow:'hidden' }}>

              {/* Date + game count */}
              <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:6 }}>DATE</div>
                  <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)}
                    style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit', boxSizing:'border-box' }}/>
                </div>
                <div style={{ width:90 }}>
                  <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:6 }}>GAMES</div>
                  <input type="number" min={1} max={30} value={slotCount} onChange={e => setSlotCount(parseInt(e.target.value)||15)}
                    style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit', boxSizing:'border-box' }}/>
                </div>
              </div>

              {/* Shorthand input */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:6 }}>SHORTHAND (e.g. V PP VVVV PP VV PP V P)</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    placeholder="V PP VVVV PP VV PP V P"
                    onKeyDown={e => { if(e.key==='Enter') applyShorthand(e.target.value); }}
                    style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit' }}
                  />
                  <button
                    onClick={e => applyShorthand(e.target.previousSibling.value)}
                    style={{ background:'rgba(201,162,39,0.1)', border:'1px solid rgba(201,162,39,0.3)', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, color:'#c9a227', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    Apply
                  </button>
                </div>
                <div style={{ fontSize:9, color:'#2d3a4a', marginTop:4 }}>V = Vegas, P = Public · spaces optional · press Enter or Apply</div>
              </div>

              {/* Visual grid */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:8 }}>PATTERN (tap to toggle)</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {slotPattern.map((slot, i) => (
                    <button key={i} onClick={() => toggleSlot(i)} style={{
                      width:44, height:44, borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                      background: slot === 'VEGAS' ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)',
                      color: slot === 'VEGAS' ? '#f87171' : '#60a5fa',
                      fontSize:9, fontWeight:700, letterSpacing:'0.05em',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                      outline: slot === 'VEGAS' ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(96,165,250,0.3)',
                    }}>
                      <span style={{ fontSize:11 }}>{slot === 'VEGAS' ? 'V' : 'P'}</span>
                      <span style={{ fontSize:7, opacity:0.6 }}>#{i+1}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop:8, fontSize:10, color:'#475569' }}>
                  {slotPattern.filter(s=>s==='VEGAS').length}V · {slotPattern.filter(s=>s==='PUBLIC').length}P · {slotPattern.length} total
                  &nbsp;·&nbsp;
                  <span style={{ color:'#c9a227', letterSpacing:'0.04em' }}>
                    {slotPattern.map(s=>s==='VEGAS'?'V':'P').join('')}
                  </span>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:6 }}>NOTE (optional)</div>
                <input value={slotNote} onChange={e => setSlotNote(e.target.value)} placeholder="e.g. Wednesday — algorithm verified"
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit', boxSizing:'border-box' }}/>
              </div>

              {/* Save */}
              <button onClick={saveSlotPattern} disabled={slotSaving || slotPattern.length === 0}
                style={{ width:'100%', padding:'11px 0', background:'linear-gradient(135deg,#c9a227,#8b6d10)', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#000', cursor:slotSaving?'not-allowed':'pointer', letterSpacing:'0.06em', fontFamily:'inherit', opacity:slotSaving?0.7:1 }}>
                {slotSaving ? 'Saving...' : `Save Pattern for ${slotDate}`}
              </button>

              {slotMsg && (
                <div style={{ marginTop:10, fontSize:11, color: slotMsg.startsWith('✅') ? '#4ade80' : '#f87171', textAlign:'center' }}>
                  {slotMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account section */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:'#c9a227', marginBottom:16 }}>ACCOUNT</div>
          <div style={{ background:'#0b0f1e', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:2 }}>Email</div>
                <div style={{ fontSize:13, color:'#f1f5f9' }}>{session?.user?.email || '—'}</div>
              </div>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <button onClick={handleSignOut} style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, padding:'9px 20px', fontSize:11, fontWeight:600, color:'#f87171', cursor:'pointer', letterSpacing:'0.06em', fontFamily:'inherit' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
