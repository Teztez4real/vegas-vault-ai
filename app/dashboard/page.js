'use client';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [status, setStatus] = useState('loading');
  
  useEffect(() => {
    setStatus('loaded');
  }, []);

  return (
    <div style={{ background: '#07091a', minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div>
        <div style={{ color: '#c9a227', fontSize: 24, marginBottom: 20 }}>VEGAS VAULT AI</div>
        <div style={{ color: '#4ade80' }}>Status: {status}</div>
        <div style={{ color: '#64748b', marginTop: 10, fontSize: 12 }}>If you see this, the page loads correctly.</div>
      </div>
    </div>
  );
}
