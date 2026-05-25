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

    // Group by event to test parsing
    const events = {};
    for (const row of rows) {
      const key = `${row.away_team}|${row.home_team}`;
      if (!events[key]) events[key] = { home: row.home_team, away: row.away_team, markets: [] };
      events[key].markets.push(row.market_type);
    }

    const eventList = Object.entries(events).slice(0,5).map(([k,v]) => ({
      game: `${v.away} @ ${v.home}`,
      marketTypes: [...new Set(v.markets)],
    }));

    const allMarkets = [...new Set(rows.map(r => r.market_type))];
    const allBooks = [...new Set(rows.map(r => r.sportsbook))];

    return NextResponse.json({
      status: res.status,
      totalRows: rows.length,
      uniqueGames: Object.keys(events).length,
      allMarketTypes: allMarkets,
      allSportsbooks: allBooks,
      sampleGames: eventList,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
