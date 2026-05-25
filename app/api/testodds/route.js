import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  const results = {};
  
  // Test multiple possible endpoints
  const endpoints = [
    { name: 'mlb_lowercase', url: 'https://api.sharpapi.io/api/v1/odds?league=mlb' },
    { name: 'MLB_uppercase', url: 'https://api.sharpapi.io/api/v1/odds?league=MLB' },
    { name: 'baseball_mlb', url: 'https://api.sharpapi.io/api/v1/odds?league=baseball_mlb' },
    { name: 'no_league', url: 'https://api.sharpapi.io/api/v1/odds?sport=baseball' },
    { name: 'sports_list', url: 'https://api.sharpapi.io/api/v1/sports' },
    { name: 'leagues_list', url: 'https://api.sharpapi.io/api/v1/leagues' },
    { name: 'events', url: 'https://api.sharpapi.io/api/v1/events?league=MLB' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { 'X-API-Key': sharpKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      const rows = data.data || data.events || data || [];
      results[ep.name] = {
        status: res.status,
        rows: Array.isArray(rows) ? rows.length : typeof data,
        keys: Array.isArray(data) ? 'array' : Object.keys(data || {}).slice(0,8),
        sample: Array.isArray(rows) && rows[0] ? Object.keys(rows[0]).slice(0,6) : null,
      };
    } catch (err) {
      results[ep.name] = { error: err.message };
    }
  }

  return NextResponse.json(results);
}
