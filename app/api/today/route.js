import { NextResponse } from 'next/server';
import { MOCK_GAMES_FALLBACK, MOCK_TRELL_ALERTS } from '@/lib/dataLayer';

export async function GET() {
  return NextResponse.json({
    games: MOCK_GAMES_FALLBACK,
    trellAlerts: MOCK_TRELL_ALERTS,
    generatedAt: new Date().toISOString(),
  });
}