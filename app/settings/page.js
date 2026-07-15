'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useIdleSignOut } from '@/lib/useIdleSignOut';
import NewLookShell from '@/components/NewLookShell';
import '@/app/new-look.css';
import '@/app/vv-4d-modern.css';
import '@/app/vv-4d-modern-v2.css';
import '@/app/vv-dark-theme.css';

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
  const [smartUpdateMsg, setSmartUpdateMsg] = useState('');
  const [smartUpdating, setSmartUpdating] = useState(false);
  const [forcingAll, setForcingAll] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window)
      setNotifStatus(Notification.permission);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  // Auto sign-out after inactivity — all settings/data are saved as they're
  // changed, so this never loses anything.
  useIdleSignOut(supabase, !!session?.user, () => { window.location.href = '/dashboard'; }, 30);

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
      await fetch('/api/topplay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s?.access_token, test: true }) });
      setTestMsg('✅ Test notification sent');
    } catch(e) { setTestMsg('❌ ' + e.message); }
  }

  async function clearAllPlays() {
    setClearMsg('');
    try {
      localStorage.removeItem('vv_results');
      localStorage.removeItem('vv_finalized');
      localStorage.removeItem('vv_pick_history');
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user?.id) {
        await supabase.from('user_data').delete().eq('user_id', s.user.id).in('key', ['results', 'finalized', 'pick_history']);
      }
      // CRITICAL: also clear the SHARED game_analyses table — this is where
      // every device reloads from. Clearing only user data leaves stale
      // analyses here that reload on the next fetch (why clear "did nothing").
      try {
        await fetch('/api/clear-analyses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true, token: s?.access_token }),
        });
      } catch {}
      setClearMsg('✅ Cleared everything — redirecting to dashboard...');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
    } catch(e) { setClearMsg('❌ ' + e.message); }
  }

  async function saveSlotPattern() {
    setSlotSaving(true); setSlotMsg('');
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/slot-pattern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: slotDate, sport: slotSport, pattern: slotPattern, note: slotNote, token: s?.access_token }) });
      const data = await res.json();
      if (data.success) {
        setSlotMsg('✅ Pattern saved! AI is now analyzing the slate…');
        // Kick off server-side analysis immediately so the AI starts working
        // the moment the pattern is saved — no waiting for the next cron.
        fetch('/api/auto-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: slotDate, trigger: 'admin-pattern-save', token: s?.access_token, base: window.location.origin }),
        }).catch(()=>{});
      }
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
  const formatEmailName = (email) => {
    if (!email) return 'Member';
    const local = email.split('@')[0];
    return local
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Member';
  };
  const shellUserName = session?.user?.email === ADMIN_EMAIL
    ? 'Cortez Battle'
    : (session?.user?.user_metadata?.full_name || formatEmailName(session?.user?.email) || 'Member');

  const glass = { background:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.93)', borderRadius:16, backdropFilter:'blur(20px)', boxShadow:'0 8px 30px rgba(0,0,0,0.06),0 2px 8px rgba(0,0,0,0.03),inset 0 1px 0 rgba(255,255,255,0.95)' };
  const glassG = { background:'rgba(255,255,255,0.62)', border:'1px solid rgba(57,255,20,0.28)', borderRadius:16, backdropFilter:'blur(20px)', boxShadow:'0 10px 36px rgba(57,255,20,0.09),0 3px 10px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.95)' };
  const sectionLabel = { fontSize:9, fontWeight:800, letterSpacing:'1px', color:'#aaa', textTransform:'uppercase', marginBottom:10, display:'block' };
  const row = { padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' };
  const inputStyle = { background:'rgba(255,255,255,0.8)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:9, padding:'9px 12px', fontSize:12, color:'#333', fontFamily:'inherit' };
  const btnPrimary = { padding:'10px 16px', background:'linear-gradient(135deg,#39FF14,#22cc00)', border:'none', borderRadius:9, fontSize:12, fontWeight:800, color:'#111', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 10px rgba(57,255,20,0.3)' };
  const btnSecondary = { padding:'9px 16px', background:'rgba(255,255,255,0.7)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:9, fontSize:11, fontWeight:700, color:'#666', cursor:'pointer', fontFamily:'inherit' };
  const btnDanger = { padding:'9px 16px', background:'rgba(255,80,80,0.07)', border:'1px solid rgba(255,80,80,0.2)', borderRadius:9, fontSize:11, fontWeight:700, color:'#dd4444', cursor:'pointer', fontFamily:'inherit' };

  if (loading) {
    return (
      <NewLookShell activeSection="settings" onNavigate={(k)=>{ if(k!=='settings') window.location.href='/dashboard'; }} userName={shellUserName} isAdmin={isAdmin} hasNotification={false}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#aaa', fontSize:12 }}>
          <div style={{ width:24, height:24, border:'3px solid rgba(57,255,20,0.2)', borderTopColor:'#39FF14', borderRadius:'50%', marginRight:10, animation:'spin 0.8s linear infinite' }} />
          Loading settings...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </NewLookShell>
    );
  }

  return (
    <NewLookShell activeSection="settings" onNavigate={(k)=>{ if(k!=='settings') window.location.href='/dashboard'; }} userName={shellUserName} isAdmin={isAdmin} hasNotification={false}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button { font-family: inherit; }
        input, select { font-family: inherit; }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(57,255,20,0.2);border-radius:2px;}
        @media (max-width:520px){
          .vv-sub-grid{grid-template-columns:1fr !important}
        }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', gap:14, flex:1, minHeight:0, overflowY:'auto', maxWidth:760, margin:'0 auto', width:'100%', paddingBottom:30 }}>

        <div style={{ ...glass, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#111', letterSpacing:-0.3 }}>Settings</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{session?.user?.email || 'Not signed in'}</div>
          </div>
          {isAdmin && (
            <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#111,#333)', padding:'4px 11px', borderRadius:7, letterSpacing:1 }}>ADMIN</span>
          )}
        </div>

        {isAdmin && (
          <div style={glassG}>
            <div style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#111,#333)', padding:'2px 9px', borderRadius:6, letterSpacing:1 }}>ADMIN</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#111' }}>Slot Pattern Manager</span>
              </div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>Set PUBLIC/VEGAS assignments for each game before analysis begins</div>

              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:9, color:'#bbb', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:5, fontWeight:700 }}>Date</div>
                  <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} style={{ ...inputStyle, width:'100%' }}/>
                </div>
                <div style={{ width:100 }}>
                  <div style={{ fontSize:9, color:'#bbb', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:5, fontWeight:700 }}>Sport</div>
                  <select value={slotSport} onChange={e => { setSlotSport(e.target.value); setSlotPattern([]); setSlotNote(''); }} style={{ ...inputStyle, width:'100%' }}>
                    <option value="mlb">MLB</option>
                    <option value="nba">NBA</option>
                    <option value="wnba">WNBA</option>
                    <option value="nfl">NFL</option>
                  </select>
                </div>
                <div style={{ width:90 }}>
                  <div style={{ fontSize:9, color:'#bbb', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:5, fontWeight:700 }}>Games</div>
                  <input type="number" min={1} max={30} value={slotCount} onChange={e => setSlotCount(parseInt(e.target.value)||15)} style={{ ...inputStyle, width:'100%' }}/>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:'#bbb', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:5, fontWeight:700 }}>Shorthand (V = Vegas, P = Public)</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input placeholder="e.g. VPPVPVP" onKeyDown={e => { if(e.key==='Enter') applyShorthand(e.target.value); }} id="shorthand-input" style={{ ...inputStyle, flex:1 }}/>
                  <button onClick={() => applyShorthand(document.getElementById('shorthand-input').value)} style={btnPrimary}>Apply</button>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:'#bbb', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:8, fontWeight:700 }}>Pattern (tap to toggle)</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {slotPattern.map((slot, i) => (
                    <button key={i} onClick={() => toggleSlot(i)} style={{
                      width:44, height:44, borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                      background: slot === 'VEGAS' ? 'rgba(57,255,20,0.1)' : 'rgba(80,140,255,0.08)',
                      color: slot === 'VEGAS' ? '#2aa800' : '#5588ee',
                      border: slot === 'VEGAS' ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(80,140,255,0.25)',
                      fontSize:9, fontWeight:800, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                    }}>
                      <span style={{ fontSize:13 }}>{slot === 'VEGAS' ? 'V' : 'P'}</span>
                      <span style={{ fontSize:7, opacity:0.6 }}>#{i+1}</span>
                    </button>
                  ))}
                </div>
                {slotPattern.length > 0 && (
                  <div style={{ marginTop:8, fontSize:10, color:'#999' }}>
                    {slotPattern.filter(s=>s==='VEGAS').length}V · {slotPattern.filter(s=>s==='PUBLIC').length}P · {slotPattern.length} total &nbsp;·&nbsp;
                    <span style={{ color:'#33aa00', fontWeight:700 }}>{slotPattern.map(s=>s==='VEGAS'?'V':'P').join('')}</span>
                  </div>
                )}
              </div>

              <input value={slotNote} onChange={e => setSlotNote(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, width:'100%', marginBottom:12 }}/>

              <button onClick={saveSlotPattern} disabled={slotSaving || slotPattern.length === 0} style={{ ...btnPrimary, width:'100%', padding:12, opacity: slotSaving ? 0.7 : 1, cursor: slotSaving ? 'not-allowed' : 'pointer' }}>
                {slotSaving ? 'Saving...' : `Save ${slotSport.toUpperCase()} Pattern for ${slotDate}`}
              </button>
              {slotMsg && <div style={{ marginTop:10, fontSize:11, color: slotMsg.startsWith('✅') ? '#33aa00' : '#dd4444', textAlign:'center', fontWeight:600 }}>{slotMsg}</div>}
            </div>

            <div style={row}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111', marginBottom:2 }}>Clear All Plays</div>
                <div style={{ fontSize:11, color:'#999' }}>Remove all analyzed plays and start fresh</div>
              </div>
              <button onClick={() => { if(window.confirm('Clear all analyzed plays?')) clearAllPlays(); }} style={btnDanger}>
                <i className="ti ti-refresh" style={{ fontSize:12, marginRight:5 }} />Clear Plays
              </button>
            </div>
            {clearMsg && <div style={{ padding:'8px 20px', fontSize:11, color: clearMsg.startsWith('✅') ? '#33aa00' : '#dd4444', fontWeight:600 }}>{clearMsg}</div>}

            <div style={{ ...row, borderBottom:'none' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111', marginBottom:2 }}>Test Notification</div>
                <div style={{ fontSize:11, color:'#999' }}>Send a test push notification to verify setup</div>
              </div>
              <button onClick={sendTestNotif} style={btnSecondary}>
                <i className="ti ti-bell" style={{ fontSize:12, marginRight:5 }} />Test
              </button>
            </div>
            {testMsg && <div style={{ padding:'0 20px 16px', fontSize:11, color: testMsg.startsWith('✅') ? '#33aa00' : '#dd4444', fontWeight:600 }}>{testMsg}</div>}
          </div>
        )}

        {/* Admin: Force Smart Update */}
        {session?.user?.email === ADMIN_EMAIL && (
          <div style={glass}>
            <div style={{ padding:'16px 20px 0' }}>
              <span style={sectionLabel}><i className="ti ti-refresh" style={{ fontSize:12, marginRight:6, color:'#0066ff' }} />AI Auto-Update</span>
            </div>
            <div style={{ padding:'12px 20px' }}>
              <div style={{ fontSize:11, color:'#777', marginBottom:12, lineHeight:1.5 }}>
                Detect lineup changes, pitcher confirmations, injuries, and line movement — then re-analyze affected games and notify watchlisted users.
              </div>
              {smartUpdateMsg && <div style={{ fontSize:11, color: smartUpdateMsg.startsWith('✅') ? '#33aa00' : '#dd4444', fontWeight:600, marginBottom:10 }}>{smartUpdateMsg}</div>}
              <button disabled={smartUpdating} onClick={async () => {
                setSmartUpdating(true); setSmartUpdateMsg('');
                try {
                  const res = await fetch('/api/cron/smart-update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trigger:'admin' }) });
                  const d = await res.json();
                  setSmartUpdateMsg(d.error ? `❌ ${d.error}` : `✅ ${d.gamesChecked||0} checked — ${d.gamesUpdated||0} updated, ${d.finalizedPlays||0} finalized`);
                } catch(e) { setSmartUpdateMsg(`❌ ${e.message}`); }
                setSmartUpdating(false);
              }} style={{ ...btnPrimary, opacity: smartUpdating ? 0.6 : 1 }}>
                <i className={`ti ${smartUpdating ? 'ti-loader-2' : 'ti-refresh'}`} style={{ fontSize:12, marginRight:5 }} />
                {smartUpdating ? 'Running...' : 'Run Smart Update Now'}
              </button>
              <div style={{ fontSize:11, color:'#777', margin:'16px 0 8px', lineHeight:1.5 }}>
                Force a full fresh re-analysis of EVERY game on today's slate (ignores the "recently analyzed" skip). Use after a model change.
              </div>
              <button disabled={forcingAll} onClick={async () => {
                setForcingAll(true); setSmartUpdateMsg('');
                try {
                  const { data: { session: s } } = await supabase.auth.getSession();
                  const today = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Chicago'}));
                  const ctDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                  const res = await fetch('/api/auto-analyze', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ date: ctDate, forceAll: true, trigger:'admin-pattern-save', token: s?.access_token, base: window.location.origin })
                  });
                  const text = await res.text();
                  let d; try { d = JSON.parse(text); } catch { d = { error: `Non-JSON response (${res.status}): ${text.slice(0,120)}` }; }
                  if (d.error) setSmartUpdateMsg(`❌ ${d.error}`);
                  else if (d.analyzed > 0) setSmartUpdateMsg(`✅ Re-analyzing ${d.analyzed} games — refresh the slate in ~1-2 min`);
                  else setSmartUpdateMsg(`⚠️ ${d.message || '0 games re-analyzing'}`);
                } catch(e) { setSmartUpdateMsg(`❌ ${e.message}`); }
                setForcingAll(false);
              }} style={{ ...btnPrimary, background:'rgba(57,255,20,0.12)', color:'#33aa00', border:'1px solid rgba(57,255,20,0.4)', opacity: forcingAll ? 0.6 : 1 }}>
                <i className={`ti ${forcingAll ? 'ti-loader-2' : 'ti-bolt'}`} style={{ fontSize:12, marginRight:5 }} />
                {forcingAll ? 'Re-analyzing all…' : 'Force Re-analyze All Games'}
              </button>
            </div>
          </div>
        )}

        <div style={glass}>
          <div style={{ padding:'16px 20px 0' }}>
            <span style={sectionLabel}><i className="ti ti-bell" style={{ fontSize:12, marginRight:6, color:'#39FF14' }} />Notifications</span>
          </div>
          <div style={row}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#111', marginBottom:2 }}>Push Notifications</div>
              <div style={{ fontSize:11, color:'#999' }}>Bet ready alerts, Trell Rule, sharp money, injuries</div>
            </div>
            <span style={{ fontSize:9, fontWeight:800, padding:'4px 11px', borderRadius:6, letterSpacing:'0.5px',
              color: notifStatus==='granted'?'#33aa00':notifStatus==='denied'?'#dd4444':'#bb8800',
              background: notifStatus==='granted'?'rgba(57,255,20,0.1)':notifStatus==='denied'?'rgba(255,80,80,0.08)':'rgba(255,200,0,0.08)',
              border: notifStatus==='granted'?'1px solid rgba(57,255,20,0.25)':notifStatus==='denied'?'1px solid rgba(255,80,80,0.2)':'1px solid rgba(255,200,0,0.2)' }}>
              {notifStatus==='granted'?'✓ ENABLED':notifStatus==='denied'?'✗ BLOCKED':'○ NOT SET'}
            </span>
          </div>
          <div style={{ padding:'14px 20px', borderBottom:'none' }}>
            {notifStatus !== 'granted' && notifStatus !== 'denied' && (
              <button onClick={enableNotifications} style={{ ...btnPrimary, width:'100%', padding:12 }}>Enable Notifications</button>
            )}
            {notifStatus === 'denied' && (
              <div style={{ padding:'12px 14px', background:'rgba(255,80,80,0.06)', border:'1px solid rgba(255,80,80,0.18)', borderRadius:10, fontSize:11, color:'#cc5555', lineHeight:1.8 }}>
                Notifications are blocked.<br/>
                <strong>iOS:</strong> Settings → Safari → [this site] → Allow<br/>
                <strong>Android:</strong> Tap lock icon → Notifications → Allow
              </div>
            )}
            {notifStatus === 'granted' && (
              <div style={{ fontSize:11, color:'#999', lineHeight:1.8 }}>
                Alerts enabled for: 🔔 Bet ready · ⚡ Trell Rule · 📈 Sharp money · 🔒 Finalized plays · 🚨 Injuries
              </div>
            )}
            <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(246,249,246,0.6)', border:'1px solid rgba(195,240,195,0.4)', borderRadius:9, fontSize:10, color:'#999', lineHeight:1.7 }}>
              <strong style={{ color:'#555' }}>iOS note:</strong> Add to Home Screen for notifications (Safari → Share → Add to Home Screen)
            </div>
          </div>
        </div>

        <div style={glass}>
          <div style={{ padding:'16px 20px 0' }}>
            <span style={sectionLabel}><i className="ti ti-credit-card" style={{ fontSize:12, marginRight:6, color:'#39FF14' }} />Subscription</span>
          </div>
          <div style={row}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:2 }}>Current Plan</div>
              <div style={{ fontSize:11, color:'#999' }}>Full AI analysis on every game</div>
            </div>
            <div style={{ fontSize:9, fontWeight:800, color:'#dd4444', background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', borderRadius:6, padding:'4px 11px', letterSpacing:'0.5px' }}>FREE</div>
          </div>
          <div className="vv-sub-grid" style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              { id:'weekly', label:'Weekly', price:'$19.99', period:'/week', features:['Full AI model','All games','Auto plays','Trell Rule alerts'], highlight:false },
              { id:'monthly', label:'Monthly', price:'$49.99', period:'/month', features:['Everything in weekly','Priority generation','Model updates','Early access'], highlight:true, badge:'Best Value' },
            ].map(plan => (
              <div key={plan.id} style={{
                background: plan.highlight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                border: plan.highlight ? '2px solid #39FF14' : '1px solid rgba(0,0,0,0.07)',
                borderRadius:14, padding:'16px 14px', position:'relative',
                boxShadow: plan.highlight ? '0 0 24px rgba(57,255,20,0.15)' : 'none',
              }}>
                {plan.badge && <div style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', background:'#39FF14', color:'#111', fontSize:8, fontWeight:800, padding:'3px 10px', borderRadius:8, whiteSpace:'nowrap', letterSpacing:0.5 }}>{plan.badge}</div>}
                <div style={{ fontSize:11, fontWeight:700, color: plan.highlight?'#33aa00':'#aaa', letterSpacing:'0.6px', marginTop:6, marginBottom:8, textTransform:'uppercase' }}>{plan.label}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:12 }}>
                  <span style={{ fontSize:24, fontWeight:900, color:'#111' }}>{plan.price}</span>
                  <span style={{ fontSize:10, color:'#bbb' }}>{plan.period}</span>
                </div>
                <ul style={{ listStyle:'none', marginBottom:14, padding:0 }}>
                  {plan.features.map((f,i) => <li key={i} style={{ fontSize:10, color:'#777', marginBottom:5, display:'flex', gap:6, alignItems:'flex-start' }}>
                    <i className="ti ti-check" style={{ fontSize:12, color:'#33aa00', marginTop:1 }} />{f}
                  </li>)}
                </ul>
                <button onClick={() => handleSubscribe(plan.id)} disabled={!!subLoading} style={{
                  width:'100%', padding:'10px',
                  background: plan.highlight ? 'linear-gradient(135deg,#39FF14,#22cc00)' : 'rgba(255,255,255,0.7)',
                  border: plan.highlight ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  borderRadius:9, fontSize:11, fontWeight:800,
                  color: plan.highlight ? '#111' : '#666', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em',
                  boxShadow: plan.highlight ? '0 2px 10px rgba(57,255,20,0.3)' : 'none',
                }}>
                  {subLoading === plan.id ? 'Loading...' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(0,0,0,0.05)' }}>
            <button onClick={handleManage} disabled={portalLoading} style={{ ...btnSecondary, width:'100%', padding:11, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {portalLoading ? 'Loading...' : 'Manage Existing Subscription'}
              {!portalLoading && <i className="ti ti-arrow-right" style={{ fontSize:12 }} />}
            </button>
          </div>
        </div>

        <div style={glass}>
          <div style={{ padding:'16px 20px 0' }}>
            <span style={sectionLabel}><i className="ti ti-user" style={{ fontSize:12, marginRight:6, color:'#39FF14' }} />Account</span>
          </div>
          <div style={row}>
            <div>
              <div style={{ fontSize:11, color:'#999', marginBottom:3 }}>Email</div>
              <div style={{ fontSize:13, color:'#111', fontWeight:600 }}>{session?.user?.email || '—'}</div>
            </div>
            {isAdmin && (
              <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#111,#333)', padding:'3px 10px', borderRadius:6, letterSpacing:1 }}>ADMIN</span>
            )}
          </div>
          <div style={{ padding:'14px 20px', borderBottom:'none' }}>
            <button onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); window.location.href = '/dashboard'; }} style={btnDanger}>
              <i className="ti ti-logout" style={{ fontSize:12, marginRight:5 }} />Sign Out
            </button>
          </div>
        </div>

      </div>
    </NewLookShell>
  );
}
