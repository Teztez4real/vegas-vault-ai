import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;
  
  return NextResponse.json({
    keyExists: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyFirst10: apiKey?.substring(0, 10) || 'none',
    keyLast4: apiKey?.slice(-4) || 'none',
  });
}
