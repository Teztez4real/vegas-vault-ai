import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'no key' });

  try {
    const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=nba&market=spread', {
      headers: { 'X-API-Key': sharpKey }, cache: 'no-store'
    });
    const data = await res.json();
    const rows = data.data || [];
    
    // Show all rows for Knicks/Cavs game
    const knicksCavs = rows.filter(r => 
      (r.home_team?.includes('Cavaliers') || r.away_team?.includes('Cavaliers') ||
       r.home_team?.includes('Knicks') || r.away_team?.includes('Knicks'))
    );

    return NextResponse.json({
      totalRows: rows.length,
      knicksCavsRows: knicksCavs,
      allMarketTypes: [...new Set(rows.map(r => r.market_type))],
    });
  } catch(err) {
    return NextResponse.json({ error: err.message });
  }
}
