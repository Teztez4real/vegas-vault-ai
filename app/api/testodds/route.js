import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'no key' });

  // Get ALL market types for NBA to find full game spread
  const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=nba', {
    headers: { 'X-API-Key': sharpKey }, cache: 'no-store'
  });
  const data = await res.json();
  const rows = data.data || [];
  
  // Find Knicks/Cavs rows and show all unique market types
  const knicksCavs = rows.filter(r =>
    r.home_team?.includes('Cavaliers') || r.away_team?.includes('Cavaliers')
  );
  
  const marketTypes = [...new Set(knicksCavs.map(r => r.market_type))];
  
  // Show one row per market type
  const byMarket = {};
  for (const row of knicksCavs) {
    if (!byMarket[row.market_type]) byMarket[row.market_type] = {
      market: row.market_type,
      selection: row.selection,
      line: row.line,
      odds: row.odds_american,
      book: row.sportsbook,
    };
  }

  return NextResponse.json({ 
    totalRows: knicksCavs.length,
    marketTypes,
    oneRowPerMarket: Object.values(byMarket),
  });
}
