import { NextResponse } from 'next/server';

async function fetchLiveScores() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=linescore,team`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const date of data.dates || []) {
      for (const game of date.games || []) {
        const linescore = game.linescore || {};
        games.push({
          gamePk: game.gamePk,
          away: game.teams?.away?.team?.name,
          home: game.teams?.home?.team?.name,
          awayAbbr: game.teams?.away?.team?.abbreviation,
          homeAbbr: game.teams?.home?.team?.abbreviation,
          awayScore: linescore.teams?.away?.runs ?? null,
          homeScore: linescore.teams?.home?.runs ?? null,
          inning: linescore.currentInning ?? null,
          inningHalf: linescore.inningHalf ?? null,
          outs: linescore.outs ?? null,
          status: game.status?.abstractGameState,
          detailedState: game.status?.detailedState,
          startTime: game.gameDate,
        });
      }
    }
    return games;
  } catch (err) {
    console.error('Live scores error:', err.message);
    return [];
  }
}

export async function GET() {
  const scores = await fetchLiveScores();
  return NextResponse.json({ scores, fetchedAt: new Date().toISOString() });
}
