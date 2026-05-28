import { NextResponse } from 'next/server';

<<<<<<< HEAD
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
=======
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`,
      { cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json({ scores: [], fetchedAt: new Date().toISOString() });

    const data = await res.json();
    const scores = [];

    for (const d of data.dates || []) {
      for (const game of d.games || []) {
        const linescore = game.linescore || {};
        const abstractState = game.status?.abstractGameState; // Preview, Live, Final
        const detailedState = game.status?.detailedState;    // Scheduled, In Progress, Final, Postponed, Delayed, etc.
        const codedState = game.status?.statusCode;

        // Determine display status
        let displayStatus = detailedState || abstractState || 'Scheduled';
        let isDelayed = false;
        let isPostponed = false;

        if (detailedState?.toLowerCase().includes('delay') || codedState === 'DI' || codedState === 'DC') {
          isDelayed = true;
          displayStatus = 'Delayed';
        }
        if (detailedState?.toLowerCase().includes('postpone') || codedState === 'PW' || codedState === 'PO') {
          isPostponed = true;
          displayStatus = 'Postponed';
        }

        scores.push({
>>>>>>> 83749ed07b4e8cefcdfa86a1c818b747a1f53cd4
          gamePk: game.gamePk,
          away: game.teams?.away?.team?.name,
          home: game.teams?.home?.team?.name,
          awayAbbr: game.teams?.away?.team?.abbreviation,
          homeAbbr: game.teams?.home?.team?.abbreviation,
          awayScore: linescore.teams?.away?.runs ?? null,
          homeScore: linescore.teams?.home?.runs ?? null,
<<<<<<< HEAD
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
=======
          awayHits: linescore.teams?.away?.hits ?? null,
          homeHits: linescore.teams?.home?.hits ?? null,
          awayErrors: linescore.teams?.away?.errors ?? null,
          homeErrors: linescore.teams?.home?.errors ?? null,
          inning: linescore.currentInning ?? null,
          inningHalf: linescore.inningHalf ?? null,
          outs: linescore.outs ?? null,
          status: abstractState,
          detailedState: displayStatus,
          isDelayed,
          isPostponed,
          startTime: game.gameDate,
          date: d.date,
        });
      }
    }

    return NextResponse.json({ scores, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Live scores error:', err.message);
    return NextResponse.json({ scores: [], fetchedAt: new Date().toISOString() });
  }
}
>>>>>>> 83749ed07b4e8cefcdfa86a1c818b747a1f53cd4
