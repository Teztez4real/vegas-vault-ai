'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const ADMIN_EMAIL = 'battlecortez@gmail.com';
  const [notifStatus, setNotifStatus] = useState('unknown');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotSport, setSlotSport] = useState('mlb');
  const [slotPattern, setSlotPattern] = useState([]);
  const [slotNote, setSlotNote] = useState('');
  const [slotCount, setSlotCount] = useState(15);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotMsg, setSlotMsg] = useState('');
  const [clearMsg, setClearMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('vv_theme') || 'dark';
    return 'dark';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window)
      setNotifStatus(Notification.permission);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('vv_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.style.setProperty('--bg', '#f1f5f9');
      document.documentElement.style.setProperty('--bg2', '#ffffff');
      document.documentElement.style.setProperty('--text', '#0f172a');
      document.documentElement.style.setProperty('--text2', '#475569');
      document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.08)');
      document.body.style.background = '#f1f5f9';
      document.body.style.color = '#0f172a';
    } else {
      document.documentElement.style.setProperty('--bg', '#080808');
      document.documentElement.style.setProperty('--bg2', '#0f172a');
      document.documentElement.style.setProperty('--text', '#f1f5f9');
      document.documentElement.style.setProperty('--text2', '#94a3b8');
      document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
      document.body.style.background = '#080808';
      document.body.style.color = '#f1f5f9';
    }
  }, [theme]);

  useEffect(() => {
    fetch(`/api/slot-pattern?date=${slotDate}&sport=${slotSport}`)
      .then(r => r.json())
      .then(data => {
        if (data.pattern?.length) { setSlotPattern(data.pattern); setSlotCount(data.pattern.length); setSlotNote(data.note || ''); }
        else setSlotPattern([]);
      }).catch(() => {});
  }, [slotDate, slotSport]);

  useEffect(() => {
    setSlotPattern(prev => {
      const arr = [...prev];
      while (arr.length < slotCount) arr.push('PUBLIC');
      return arr.slice(0, slotCount);
    });
  }, [slotCount]);

  async function enableNotifications() {
    if (!('Notification' in window)) { alert('This browser does not support notifications.'); return; }
    const result = await Notification.requestPermission();
    setNotifStatus(result);
    if (result === 'granted') {
      const reg = await navigator.serviceWorker?.ready.catch(() => null);
      reg?.showNotification?.('✅ Vegas Vault AI', { body: 'Notifications enabled!', icon: '/favicon.ico' });
    }
  }

  async function sendTestNotif() {
    setTestMsg('');
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/topplay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s?.access_token, test: true }) });
      setTestMsg('✅ Test notification sent');
    } catch(e) { setTestMsg('❌ ' + e.message); }
  }

  async function clearAllPlays() {
    setClearMsg('');
    try {
      localStorage.removeItem('vv_results');
      localStorage.removeItem('vv_finalized');
      localStorage.removeItem('vv_pick_history');
      // Also clear from Supabase
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user?.id) {
        await supabase.from('user_data').delete().eq('user_id', s.user.id).in('key', ['results', 'finalized', 'pick_history']);
      }
      setClearMsg('✅ Cleared — redirecting to dashboard...');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
    } catch(e) { setClearMsg('❌ ' + e.message); }
  }

  async function saveSlotPattern() {
    setSlotSaving(true); setSlotMsg('');
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/slot-pattern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: slotDate, sport: slotSport, pattern: slotPattern, note: slotNote, token: s?.access_token }) });
      const data = await res.json();
      if (data.success) setSlotMsg('✅ Pattern saved!');
      else setSlotMsg('❌ ' + (data.error || 'Save failed'));
    } catch(e) { setSlotMsg('❌ ' + e.message); }
    setSlotSaving(false);
  }

  function toggleSlot(i) { setSlotPattern(prev => { const arr = [...prev]; arr[i] = arr[i] === 'VEGAS' ? 'PUBLIC' : 'VEGAS'; return arr; }); }

  function applyShorthand(str) {
    const pattern = str.toUpperCase().replace(/\s+/g,'').split('').map(c => c === 'V' ? 'VEGAS' : 'PUBLIC');
    if (pattern.length > 0) { setSlotPattern(pattern); setSlotCount(pattern.length); }
  }

  async function handleSubscribe(plan) {
    setSubLoading(plan);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ plan }) });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setSubLoading(null);
  }

  async function handleManage() {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token } });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const S = { section: { marginBottom: 28 }, label: { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#c9a227', marginBottom: 14, display: 'block' }, card: { background: '#0b0f1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }, row: { padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, btn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' } };

  if (loading) return <div style={{ minHeight:'100vh', background:'#07091a', display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a5e', fontSize:12, fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em' }}>LOADING...</div>;

  return (
    <div style={{ minHeight:'100vh', background:'#07091a', fontFamily:"'DM Mono','Courier New',monospace", color:'#e2e8f0' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} body{background:#07091a;} input,select,textarea{outline:none;} button:focus{outline:none;}`}</style>

      {/* Header */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(7,9,26,0.96)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => window.location.href='/dashboard'} style={{ ...S.btn }}>← Dashboard</button>
          <span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>⚙ Settings</span>
        </div>
        <div style={{ fontSize:11, color:'#3a4a5e' }}>{session?.user?.email || 'Not signed in'}</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── ADMIN CONTROLS ─────────────────────────────────── */}
        {isAdmin && (
          <div style={S.section}>
            <span style={S.label}>🛡 ADMIN CONTROLS</span>
            <div style={S.card}>

              {/* Slot Pattern */}
              <div style={{ padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#f1f5f9', marginBottom:4 }}>Daily Slot Pattern</div>
                <div style={{ fontSize:11, color:'#475569', marginBottom:16 }}>Set PUBLIC/VEGAS assignments for each game before analysis begins</div>

                <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:130 }}>
                    <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:5 }}>DATE</div>
                    <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit' }}/>
                  </div>
                  <div style={{ width:85 }}>
                    <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:5 }}>SPORT</div>
                    <select value={slotSport} onChange={e => { setSlotSport(e.target.value); setSlotPattern([]); setSlotNote(''); }} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit' }}>
                      <option value="mlb">MLB</option>
                      <option value="nba">NBA</option>
                      <option value="nfl">NFL</option>
                    </select>
                  </div>
                  <div style={{ width:80 }}>
                    <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:5 }}>GAMES</div>
                    <input type="number" min={1} max={30} value={slotCount} onChange={e => setSlotCount(parseInt(e.target.value)||15)} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit' }}/>
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:5 }}>SHORTHAND (V = Vegas, P = Public)</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input placeholder="e.g. VPPVPVP" onKeyDown={e => { if(e.key==='Enter') applyShorthand(e.target.value); }} id="shorthand-input" style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit' }}/>
                    <button onClick={() => applyShorthand(document.getElementById('shorthand-input').value)} style={{ background:'rgba(201,162,39,0.1)', border:'1px solid rgba(201,162,39,0.3)', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, color:'#c9a227', cursor:'pointer', fontFamily:'inherit' }}>Apply</button>
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, color:'#3a4a5e', letterSpacing:'0.1em', marginBottom:8 }}>PATTERN (tap to toggle)</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {slotPattern.map((slot, i) => (
                      <button key={i} onClick={() => toggleSlot(i)} style={{ width:44, height:44, borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', background: slot === 'VEGAS' ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)', color: slot === 'VEGAS' ? '#f87171' : '#60a5fa', fontSize:9, fontWeight:700, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, outline: slot === 'VEGAS' ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(96,165,250,0.3)' }}>
                        <span style={{ fontSize:11 }}>{slot === 'VEGAS' ? 'V' : 'P'}</span>
                        <span style={{ fontSize:7, opacity:0.6 }}>#{i+1}</span>
                      </button>
                    ))}
                  </div>
                  {slotPattern.length > 0 && (
                    <div style={{ marginTop:8, fontSize:10, color:'#475569' }}>
                      {slotPattern.filter(s=>s==='VEGAS').length}V · {slotPattern.filter(s=>s==='PUBLIC').length}P · {slotPattern.length} total &nbsp;·&nbsp;
                      <span style={{ color:'#c9a227' }}>{slotPattern.map(s=>s==='VEGAS'?'V':'P').join('')}</span>
                    </div>
                  )}
                </div>

                <input value={slotNote} onChange={e => setSlotNote(e.target.value)} placeholder="Note (optional)" style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f1f5f9', fontFamily:'inherit', marginBottom:12 }}/>

                <button onClick={saveSlotPattern} disabled={slotSaving || slotPattern.length === 0} style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#c9a227,#8b6d10)', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#000', cursor:slotSaving?'not-allowed':'pointer', letterSpacing:'0.06em', fontFamily:'inherit', opacity:slotSaving?0.7:1 }}>
                  {slotSaving ? 'Saving...' : `Save ${slotSport.toUpperCase()} Pattern for ${slotDate}`}
                </button>
                {slotMsg && <div style={{ marginTop:10, fontSize:11, color: slotMsg.startsWith('✅') ? '#4ade80' : '#f87171', textAlign:'center' }}>{slotMsg}</div>}
              </div>

              {/* Theme Toggle */}
              <div style={{ ...S.row }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:3 }}>Display Mode</div>
                  <div style={{ fontSize:11, color:'#475569' }}>Switch between dark and light mode</div>
                </div>
                <div style={{ display:'flex', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, overflow:'hidden' }}>
                  <button onClick={() => setTheme('dark')} style={{ padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.05em', border:'none', background: theme === 'dark' ? '#c9a227' : 'transparent', color: theme === 'dark' ? '#000' : '#64748b', transition:'all 0.15s' }}>
                    🌙 Dark
                  </button>
                  <button onClick={() => setTheme('light')} style={{ padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.05em', border:'none', background: theme === 'light' ? '#c9a227' : 'transparent', color: theme === 'light' ? '#000' : '#64748b', transition:'all 0.15s' }}>
                    ☀️ Light
                  </button>
                </div>
              </div>

              {/* Clear Plays */}
              <div style={{ ...S.row }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:3 }}>Clear All Plays</div>
                  <div style={{ fontSize:11, color:'#475569' }}>Remove all analyzed plays and start fresh</div>
                </div>
                <button onClick={() => { if(window.confirm('Clear all analyzed plays?')) clearAllPlays(); }} style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, color:'#f87171', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
                  ↺ Clear Plays
                </button>
              </div>
              {clearMsg && <div style={{ padding:'8px 20px', fontSize:11, color: clearMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{clearMsg}</div>}

              {/* Test Notification */}
              <div style={{ ...S.row, borderBottom:'none' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:3 }}>Test Notification</div>
                  <div style={{ fontSize:11, color:'#475569' }}>Send a test push notification to verify setup</div>
                </div>
                <button onClick={sendTestNotif} style={{ background:'rgba(201,162,39,0.08)', border:'1px solid rgba(201,162,39,0.25)', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, color:'#c9a227', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
                  🔔 Test
                </button>
              </div>
              {testMsg && <div style={{ padding:'8px 20px', fontSize:11, color: testMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{testMsg}</div>}

            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ──────────────────────────────────── */}
        <div style={S.section}>
          <span style={S.label}>🔔 NOTIFICATIONS</span>
          <div style={S.card}>
            <div style={{ ...S.row }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:3 }}>Push Notifications</div>
                <div style={{ fontSize:11, color:'#475569' }}>Bet ready alerts, Trell Rule, sharp money, injuries</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: notifStatus==='granted'?'#4ade80':notifStatus==='denied'?'#f87171':'#c9a227', background: notifStatus==='granted'?'rgba(74,222,128,0.1)':notifStatus==='denied'?'rgba(248,113,113,0.1)':'rgba(201,162,39,0.1)', border:`1px solid ${notifStatus==='granted'?'rgba(74,222,128,0.3)':notifStatus==='denied'?'rgba(248,113,113,0.3)':'rgba(201,162,39,0.3)'}`, borderRadius:6, padding:'4px 10px' }}>
                {notifStatus==='granted'?'✓ ENABLED':notifStatus==='denied'?'✗ BLOCKED':'○ NOT SET'}
              </span>
            </div>
            <div style={{ padding:'14px 20px', borderBottom:'none' }}>
              {notifStatus !== 'granted' && notifStatus !== 'denied' && (
                <button onClick={enableNotifications} style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#c9a227,#8b6d10)', border:'none', borderRadius:8, fontSize:12, fontWeight:700, color:'#000', cursor:'pointer', letterSpacing:'0.06em', fontFamily:'inherit' }}>Enable Notifications</button>
              )}
              {notifStatus === 'denied' && (
                <div style={{ padding:'12px', background:'rgba(248,113,113,0.06)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, fontSize:11, color:'#f87171', lineHeight:1.7 }}>
                  Notifications are blocked.<br/>
                  <strong>iOS:</strong> Settings → Safari → [this site] → Allow<br/>
                  <strong>Android:</strong> Tap lock icon → Notifications → Allow
                </div>
              )}
              {notifStatus === 'granted' && (
                <div style={{ fontSize:11, color:'#3a4a5e', lineHeight:1.7 }}>
                  Alerts enabled for: 🔔 Bet ready · ⚡ Trell Rule · 📈 Sharp money · 🔒 Finalized plays · 🚨 Injuries
                </div>
              )}
              <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:8, fontSize:10, color:'#2d3a4a', lineHeight:1.6 }}>
                <strong style={{ color:'#3a4a5e' }}>iOS note:</strong> Add to Home Screen for notifications (Safari → Share → Add to Home Screen)
              </div>
            </div>
          </div>
        </div>

        {/* ── SUBSCRIPTION ───────────────────────────────────── */}
        <div style={S.section}>
          <span style={S.label}>💳 SUBSCRIPTION</span>
          <div style={S.card}>
            <div style={{ ...S.row }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#f1f5f9', marginBottom:3 }}>Current Plan</div>
                <div style={{ fontSize:11, color:'#475569' }}>Full AI analysis on every game</div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:'#f87171', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:6, padding:'4px 10px' }}>FREE</div>
            </div>
            <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { id:'weekly', label:'Weekly', price:'$19.99', period:'/week', features:['Full AI model','All games','Auto plays','Trell Rule alerts'], highlight:false },
                { id:'monthly', label:'Monthly', price:'$49.99', period:'/month', features:['Everything in weekly','Priority generation','Model updates','Early access'], highlight:true, badge:'Best Value' },
              ].map(plan => (
                <div key={plan.id} style={{ background: plan.highlight?'rgba(201,162,39,0.06)':'rgba(255,255,255,0.02)', border:`1px solid ${plan.highlight?'rgba(201,162,39,0.3)':'rgba(255,255,255,0.07)'}`, borderRadius:12, padding:'16px 14px', position:'relative' }}>
                  {plan.badge && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#c9a227', color:'#000', fontSize:9, fontWeight:800, padding:'2px 10px', borderRadius:10, whiteSpace:'nowrap' }}>{plan.badge}</div>}
                  <div style={{ fontSize:11, fontWeight:700, color: plan.highlight?'#c9a227':'#94a3b8', letterSpacing:'0.08em', marginBottom:8 }}>{plan.label.toUpperCase()}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:12 }}>
                    <span style={{ fontSize:22, fontWeight:800, color:'#f1f5f9' }}>{plan.price}</span>
                    <span style={{ fontSize:10, color:'#475569' }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle:'none', marginBottom:14 }}>
                    {plan.features.map((f,i) => <li key={i} style={{ fontSize:10, color:'#64748b', marginBottom:4, display:'flex', gap:6 }}><span style={{ color:'#c9a227' }}>✓</span>{f}</li>)}
                  </ul>
                  <button onClick={() => handleSubscribe(plan.id)} disabled={!!subLoading} style={{ width:'100%', padding:'9px', background: plan.highlight?'linear-gradient(135deg,#c9a227,#8b6d10)':'rgba(255,255,255,0.05)', border: plan.highlight?'none':'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11, fontWeight:700, color: plan.highlight?'#000':'#94a3b8', cursor:'pointer', letterSpacing:'0.06em', fontFamily:'inherit' }}>
                    {subLoading === plan.id ? 'Loading...' : 'Subscribe'}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={handleManage} disabled={portalLoading} style={{ width:'100%', padding:'10px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:11, color:'#64748b', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em' }}>
                {portalLoading ? 'Loading...' : 'Manage Existing Subscription →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── ACCOUNT ────────────────────────────────────────── */}
        <div style={S.section}>
          <span style={S.label}>👤 ACCOUNT</span>
          <div style={S.card}>
            <div style={{ ...S.row }}>
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Email</div>
                <div style={{ fontSize:13, color:'#f1f5f9' }}>{session?.user?.email || '—'}</div>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderBottom:'none' }}>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/dashboard'; }} style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, padding:'9px 20px', fontSize:11, fontWeight:600, color:'#f87171', cursor:'pointer', letterSpacing:'0.06em', fontFamily:'inherit' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
