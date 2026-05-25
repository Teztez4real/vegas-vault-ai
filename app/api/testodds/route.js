import { NextResponse } from 'next/server';

export async function GET() {
  const sharpKey = process.env.SHARPAPI_KEY;
  if (!sharpKey) return NextResponse.json({ error: 'no key' });

  const res = await fetch('https://api.sharpapi.io/api/v1/odds?league=nba&market=moneyline', {
    headers: { 'X-API-Key': sharpKey }, cache: 'no-store'
  });
  const data = await res.json();
  const rows = data.data || [];
  const today = new Date().toISOString().split('T')[0];
  
  // Show what dates SharpAPI is returning
  const dates = [...new Set(rows.map(r => r.event_start_time?.split('T')[0]))];
  const sample = rows.slice(0,3).map(r => ({
    game: `${r.away_team} @ ${r.home_team}`,
    commenceTime: r.event_start_time,
    dateExtracted: r.event_start_time?.split('T')[0],
  }));

  return NextResponse.json({ today, datesInAPI: dates, sample });
}
