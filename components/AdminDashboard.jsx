'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const VegasVaultApp  = dynamic(() => import('@/components/VegasVaultApp'),    { ssr: false });
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'),    { ssr: false });

// Admin email list — must match AuthGate.jsx
const ADMIN_EMAILS = [
  'battlecortez@gmail.com',
];

function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.some(a => a.toLowerCase() === email.toLowerCase());
}

export default function DashboardPage() {
  const [view, setView] = useState('main'); // 'main' | 'admin'
  const [userEmail, setUserEmail] = useState('');
  const [adminUser, setAdminUser] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email || '';
      setUserEmail(email);
      setAdminUser(isAdmin(email));
    });
  }, []);

  if (adminUser && view === 'admin') {
    return (
      <div>
        {/* Admin switcher bar */}
        <div style={{ position:'fixed', top:0, left:0, right:0, height:40, background:'rgba(201,162,39,0.95)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:9999, fontFamily:"'DM Mono',monospace" }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#000', letterSpacing:'0.1em' }}>⚡ ADMIN MODE — {userEmail}</span>
          <button onClick={() => setView('main')} style={{ fontSize:11, fontWeight:700, color:'#000', background:'rgba(0,0,0,0.15)', border:'1px solid rgba(0,0,0,0.2)', borderRadius:6, padding:'4px 12px', cursor:'pointer', fontFamily:'inherit' }}>
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ paddingTop:40 }}>
          <AdminDashboard />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Admin badge — only visible to admin users */}
      {adminUser && (
        <div style={{ position:'fixed', bottom:70, right:16, zIndex:9999 }}>
          <button
            onClick={() => setView('admin')}
            style={{ background:'linear-gradient(135deg,#c9a227,#8b6d10)', border:'none', borderRadius:10, padding:'10px 16px', fontSize:11, fontWeight:700, color:'#000', cursor:'pointer', letterSpacing:'0.08em', boxShadow:'0 4px 20px rgba(201,162,39,0.4)', fontFamily:"'DM Mono',monospace", display:'flex', alignItems:'center', gap:8 }}
          >
            ⚡ ADMIN PANEL
          </button>
        </div>
      )}
      <VegasVaultApp />
    </div>
  );
}
