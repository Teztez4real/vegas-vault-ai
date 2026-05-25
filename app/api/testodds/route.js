import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  const results = {};

  // Test different approaches to get game odds
  const tests = [
    { name: 'odds_mlb', url: 'https://api.sharpapi.io/api/v1/odds?league=mlb&market=moneyline' },
    { name: 'odds_spread', url: 'https://api.sharpapi.io/api/v1/odds?league=mlb&market=spread' },
    { name: 'events_today', url: `https://api.sharpapi.io/api/v1/events?league=mlb&date=${new Date().toISOString().split('T')[0]}` },
    { name: 'events_no_filter', url: 'https://api.sharpapi.io/api/v1/events?league=mlb&status=upcoming' },
    { name: 'docs', url: 'https://api.sharpapi.io/api/v1' },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(test.url, {
        headers: { 'X-API-Key': sharpKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      const rows = data.data || data || [];
      const first = Array.isArray(rows) ? rows[0] : null;
      results[test.name] = {
        status: res.status,
        count: Array.isArray(rows) ? rows.length : 'object',
        firstKeys: first ? Object.keys(first).slice(0,10) : Object.keys(data||{}).slice(0,10),
        firstItem: first ? {
          home: first.home_team,
          away: first.away_team,
          market: first.market_type || first.market,
          book: first.sportsbook || first.book,
          oddsAmerican: first.odds_american,
          selection: first.selection,
        } : null,
      };
    } catch(err) {
      results[test.name] = { error: err.message };
    }
  }

  return NextResponse.json(results);
}
