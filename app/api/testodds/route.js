import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  const oddsKey = process.env.ODDS_API_KEY;

  const results = { sharpapi: null, oddsapi: null };

  // Test SharpAPI
  if (sharpKey) {
    try {
      const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=MLB', {
        headers: { 'X-API-Key': sharpKey },
        cache: 'no-store',
      });
      const data = await res.json();
      const games = data.data || data.events || data || [];
      results.sharpapi = {
        status: res.status,
        gamesFound: Array.isArray(games) ? games.length : 0,
        error: res.ok ? null : data,
        firstGame: Array.isArray(games) && games[0] ? {
          away: games[0].away_team || games[0].awayTeam,
          home: games[0].home_team || games[0].homeTeam,
          bookmakers: (games[0].bookmakers || games[0].books || []).length,
          hasEV: !!(games[0].ev || games[0].expected_value),
          hasRLM: !!(games[0].reverse_line_movement || games[0].rlm),
        } : null,
      };
    } catch (err) {
      results.sharpapi = { error: err.message };
    }
  } else {
    results.sharpapi = { error: 'SHARPAPI_KEY not set' };
  }

  // Test Odds API
  if (oddsKey) {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${oddsKey}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      results.oddsapi = {
        status: res.status,
        requestsRemaining: res.headers.get('x-requests-remaining'),
        gamesFound: Array.isArray(data) ? data.length : 0,
        error: Array.isArray(data) ? null : data,
      };
    } catch (err) {
      results.oddsapi = { error: err.message };
    }
  } else {
    results.oddsapi = { error: 'ODDS_API_KEY not set' };
  }

  return NextResponse.json(results);
}
