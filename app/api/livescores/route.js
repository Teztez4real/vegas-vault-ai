import { NextResponse } from 'next/server';

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

        // Only mark delayed if API explicitly says so
        if (detailedState?.toLowerCase().includes('delay') || codedState === 'DI' || codedState === 'DC') {
          isDelayed = true;
          displayStatus = 'Delayed';
        }
        // Only mark postponed if API explicitly confirms it — never assume
        const postponedCodes = ['PW', 'PO', 'PPD'];
        if (
          postponedCodes.includes(codedState) ||
          detailedState?.toLowerCase() === 'postponed'
        ) {
          isPostponed = true;
          isDelayed = false; // postponed overrides delayed
          displayStatus = 'Postponed';
        }
        // If game has a linescore with runs, it is NOT postponed regardless of status edge cases
        const hasScoreData = linescore?.teams?.away?.runs != null || linescore?.teams?.home?.runs != null;
        if (hasScoreData && isPostponed) {
          isPostponed = false;
          displayStatus = abstractState === 'Final' ? 'Final' : 'In Progress';
        }

        scores.push({
          gamePk: game.gamePk,
          away: game.teams?.away?.team?.name,
          home: game.teams?.home?.team?.name,
          awayAbbr: game.teams?.away?.team?.abbreviation,
          homeAbbr: game.teams?.home?.team?.abbreviation,
          awayScore: linescore.teams?.away?.runs ?? null,
          homeScore: linescore.teams?.home?.runs ?? null,
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
          updatedTime: (() => {
            // Use rescheduled time if available, otherwise original
            const t = game.rescheduleDate || game.gameDate;
            if (!t) return null;
            const d = new Date(t);
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) + ' CT';
          })(),
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
