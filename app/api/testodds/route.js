import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  try {
    const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=MLB', {
      headers: { 'X-API-Key': sharpKey },
      cache: 'no-store',
    });
    const data = await res.json();
    // Return first game raw so we can see exact structure
    const games = data.data || data.events || data || [];
    const firstGame = Array.isArray(games) ? games[0] : null;
    return NextResponse.json({
      status: res.status,
      totalGames: Array.isArray(games) ? games.length : 0,
      topLevelKeys: Object.keys(data || {}),
      firstGameKeys: firstGame ? Object.keys(firstGame) : [],
      firstGame: firstGame,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
