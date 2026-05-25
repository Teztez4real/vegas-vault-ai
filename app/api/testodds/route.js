import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'SHARPAPI_KEY not set' });

  try {
    const res = await fetch('https://api.sharpapi.io/api/v1/events?league=mlb&include=odds', {
      headers: { 'X-API-Key': sharpKey },
      cache: 'no-store',
    });
    const data = await res.json();
    const events = data.data || [];
    const upcoming = events.filter(e => e.status !== 'completed');
    const sample = upcoming[0];
    return NextResponse.json({
      status: res.status,
      totalEvents: events.length,
      upcomingEvents: upcoming.length,
      sampleEventKeys: sample ? Object.keys(sample) : [],
      sampleBooks: sample?.books ? sample.books.slice(0,2).map(b => ({
        name: b.name || b.id,
        markets: (b.markets||[]).map(m => m.name || m.id),
      })) : [],
      sampleGame: sample ? `${sample.away_team} @ ${sample.home_team} — ${sample.start_time}` : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
