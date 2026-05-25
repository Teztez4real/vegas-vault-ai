import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'no key', ts: Date.now() });

  const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=nba', {
    headers: { 'X-API-Key': sharpKey }, cache: 'no-store'
  });
  const data = await res.json();
  const rows = data.data || [];
  const cavRows = rows.filter(r => r.home_team?.includes('Cavaliers') || r.away_team?.includes('Cavaliers'));
  const marketTypes = [...new Set(cavRows.map(r => r.market_type))];
  const byMarket = {};
  for (const row of cavRows) {
    if (!byMarket[row.market_type]) byMarket[row.market_type] = { market: row.market_type, selection: row.selection, line: row.line, odds: row.odds_american, book: row.sportsbook };
  }
  return NextResponse.json({ ts: Date.now(), totalCavRows: cavRows.length, marketTypes, samples: Object.values(byMarket) });
}
