import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  try {
    // Get leagues list to find correct MLB/NBA/NFL league IDs
    const leaguesRes = await fetch('https://api.sharpapi.io/api/v1/leagues', {
      headers: { 'X-API-Key': sharpKey },
      cache: 'no-store',
    });
    const leaguesData = await leaguesRes.json();
    const leagues = leaguesData.data || [];
    
    // Find MLB, NBA, NFL
    const target = leagues.filter(l => 
      ['mlb','nba','nfl','baseball','basketball','football'].some(s => 
        (l.name||l.display_name||l.id||'').toLowerCase().includes(s)
      )
    ).slice(0, 20);

    // Also test events endpoint with league=mlb
    const eventsRes = await fetch('https://api.sharpapi.io/api/v1/events?league=mlb', {
      headers: { 'X-API-Key': sharpKey },
      cache: 'no-store',
    });
    const eventsData = await eventsRes.json();
    const events = eventsData.data || [];
    const sampleEvent = events[0] || null;

    return NextResponse.json({
      targetLeagues: target,
      eventsCount: events.length,
      sampleEventKeys: sampleEvent ? Object.keys(sampleEvent) : [],
      sampleEvent,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
