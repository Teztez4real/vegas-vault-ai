import { NextResponse } from 'next/server';

async function fetchMLBSchedule() {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,linescore`,
    { next: { revalidate: 600 } }
  );
  const data = await res.json();
  return data.dates?.[0]?.games || [];
}

async function fetchTeamRecord(teamId) {
  const season = new Date().getFullYear();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  for (const record of data.records || []) {
    for (const tr of record.teamRecords || []) {
      if (tr.team?.id === teamId) {
        return `${tr.wins}-${tr.losses}`;
      }
    }
  }
  return 'N/A';
}

function assignSlots(games) {
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const dayBase = dayOfYear % 2 === 0 ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');
  let currentSlot = opposite(dayBase);
  let lastTime = null;
  return games.map((g, i) => {
    if (i === 0) { lastTime = g.rawTime; return { ...g, slot: currentSlot }; }
    if (g.rawTime !== lastTime) { currentSlot = opposite(currentSlot); lastTime = g.rawTime; }
    return { ...g, slot: currentSlot };
  });
}

export async function GET() {
  try {
    const scheduleGames = await fetchMLBSchedule();

    const games = await Promise.all(
      scheduleGames.map(async (g, i) => {
        const home = g.teams.home.team;
        const away = g.teams.away.team;
        const homePitcher = g.teams.home.probablePitcher;
        const awayPitcher = g.teams.away.probablePitcher;

        const [homeRecord, awayRecord] = await Promise.all([
          fetchTeamRecord(home.id),
          fetchTeamRecord(away.id),
        ]);

        const gameTime = new Date(g.gameDate).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
        });

        return {
          id: g.gamePk,
          sport: 'MLB',
          rawTime: g.gameDate,
          time: gameTime + ' CT',
          date: new Date().toISOString().split('T')[0],
          away: away.name,
          home: home.name,
          awayRecord,
          homeRecord,
          awayAwayRecord: 'N/A',
          homeHomeRecord: 'N/A',
          awayLast5: 'N/A',
          homeLast5: 'N/A',
          awayLast10: 'N/A',
          homeLast10: 'N/A',
          awayML: 'N/A',
          homeML: 'N/A',
          runLine: 'N/A',
          awayPitcher: awayPitcher?.fullName || 'TBD',
          homePitcher: homePitcher?.fullName || 'TBD',
          awayPitcherStats: 'Live stats loading',
          homePitcherStats: 'Live stats loading',
          awayBullpenERA: 'N/A',
          homeBullpenERA: 'N/A',
          awayOffense: 'Live data',
          homeOffense: 'Live data',
          h2hLast5: 'N/A',
          h2hAtHome: 'N/A',
          injuries: 'Check RotoWire',
          lineMovement: 'Check The Odds API',
          seriesGame: g.seriesGameNumber || 1,
          seriesLength: g.gamesInSeries || 3,
          slot: 'PUBLIC',
        };
      })
    );

    games.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const withSlots = assignSlots(games);

    return NextResponse.json({
      games: withSlots,
      trellAlerts: [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}