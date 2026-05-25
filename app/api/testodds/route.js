import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No ODDS_API_KEY set' });

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    return NextResponse.json({
      status: res.status,
      requestsRemaining: remaining,
      requestsUsed: used,
      gamesFound: Array.isArray(data) ? data.length : 0,
      error: Array.isArray(data) ? null : data,
      firstGame: Array.isArray(data) && data[0] ? {
        away: data[0].away_team,
        home: data[0].home_team,
        bookmakers: data[0].bookmakers?.length,
      } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
