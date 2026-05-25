import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  try {
    const [mlRes, spreadRes, totRes] = await Promise.all([
      fetch('https://api.sharpapi.io/api/v1/odds?league=nba&market=moneyline', { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
      fetch('https://api.sharpapi.io/api/v1/odds?league=nba&market=spread', { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
      fetch('https://api.sharpapi.io/api/v1/odds?league=nba&market=total', { headers: { 'X-API-Key': sharpKey }, cache: 'no-store' }),
    ]);

    const mlRows    = (await mlRes.json()).data    || [];
    const spreadRows = (await spreadRes.json()).data || [];
    const totRows   = (await totRes.json()).data   || [];
    const allRows   = [...mlRows, ...spreadRows, ...totRows];

    const games = {};
    for (const row of allRows) {
      const k = `${row.away_team}|${row.home_team}`;
      if (!games[k]) games[k] = { home: row.home_team, away: row.away_team, markets: new Set(), books: new Set() };
      games[k].markets.add(row.market_type);
      games[k].books.add(row.sportsbook);
    }

    return NextResponse.json({
      mlRows: mlRows.length,
      spreadRows: spreadRows.length,
      totRows: totRows.length,
      uniqueGames: Object.keys(games).length,
      allBooks: [...new Set(allRows.map(r => r.sportsbook))],
      sampleGames: Object.values(games).slice(0,5).map(g => ({
        game: `${g.away} @ ${g.home}`,
        markets: [...g.markets],
        books: [...g.books],
      })),
    });
  } catch(err) {
    return NextResponse.json({ error: err.message });
  }
}
