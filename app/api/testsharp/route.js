import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'no key' });
  const headers = { 'X-API-Key': sharpKey };
  const results = {};

  // Discover available market types on the main odds endpoint
  try {
    const r = await fetch('https://api.sharpapi.io/api/v1/odds?league=mlb', { headers, cache: 'no-store' });
    const d = await r.json();
    const rows = d.data || [];
    results.oddsMarketTypes = [...new Set(rows.map(r => r.market_type))];
    results.oddsSportsbooks = [...new Set(rows.map(r => r.sportsbook))].slice(0, 15);
    results.sampleRow = rows[0] || null;
    results.totalRows = rows.length;
  } catch(e) { results.oddsError = e.message; }

  // Try percentages endpoint
  try {
    const r = await fetch('https://api.sharpapi.io/api/v1/percentages?league=mlb', { headers, cache: 'no-store' });
    const d = await r.json();
    results.percentagesStatus = r.status;
    results.percentagesSample = JSON.stringify(d).slice(0, 800);
  } catch(e) { results.percentagesError = e.message; }

  // Try bet-splits endpoint
  try {
    const r = await fetch('https://api.sharpapi.io/api/v1/bet-splits?league=mlb', { headers, cache: 'no-store' });
    const d = await r.json();
    results.betSplitsStatus = r.status;
    results.betSplitsSample = JSON.stringify(d).slice(0, 800);
  } catch(e) { results.betSplitsError = e.message; }

  return NextResponse.json(results);
}
