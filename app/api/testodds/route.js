import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  try {
    const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=mlb', {
      headers: { 'X-API-Key': sharpKey },
      cache: 'no-store',
    });
    const data = await res.json();
    const rows = data.data || [];
    const events = {};
    for (const row of rows) {
      const key = `${row.away_team}|${row.home_team}`;
      if (!events[key]) events[key] = { home: row.home_team, away: row.away_team, markets: new Set(), books: new Set() };
      events[key].markets.add(row.market_type);
      events[key].books.add(row.sportsbook);
    }
    return NextResponse.json({
      status: res.status,
      totalRows: rows.length,
      uniqueGames: Object.keys(events).length,
      allMarketTypes: [...new Set(rows.map(r => r.market_type))],
      allSportsbooks: [...new Set(rows.map(r => r.sportsbook))],
      sampleGames: Object.entries(events).slice(0,5).map(([k,v]) => ({
        game: `${v.away} @ ${v.home}`,
        markets: [...v.markets],
        books: [...v.books],
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
