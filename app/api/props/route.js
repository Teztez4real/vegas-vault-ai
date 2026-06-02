import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildPropsPrompt } from '../../../lib/propsModel.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const propData = await req.json();

    const prompt = buildPropsPrompt(propData);

    const message = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch {
      result = {
        summary: {
          pick: 'Parse Error',
          line: propData.line,
          price: 'N/A',
          tier: '3',
          tierLabel: 'Tier 3',
          confidence: 'LOW',
          discrepancySize: 'SMALL',
          projection: 'N/A',
          verdict: 'AI response could not be parsed. Please re-analyze.',
        },
        parseError: true,
        rawText: clean.slice(0, 500),
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Props analyze error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Fetch player props from Odds API for a given game
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || 'baseball_mlb';
    const eventId = searchParams.get('eventId');
    const oddsKey = process.env.ODDS_API_KEY;

    if (!oddsKey) return NextResponse.json({ props: [] });

    // Map sport to odds API format
    const sportMap = {
      'MLB': 'baseball_mlb',
      'NBA': 'basketball_nba',
      'NFL': 'americanfootball_nfl',
      'Tennis': 'tennis_atp',
      'WNBA': 'basketball_wnba',
    };
    const apiSport = sportMap[sport] || sport;

    // Fetch player props markets
    const markets = sport === 'MLB'
      ? 'batter_hits,batter_home_runs,batter_rbis,batter_total_bases,batter_strikeouts,pitcher_strikeouts,pitcher_hits_allowed,pitcher_earned_runs'
      : sport === 'NBA'
      ? 'player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals'
      : sport === 'NFL'
      ? 'player_pass_tds,player_pass_yards,player_rush_yards,player_reception_yards,player_receptions'
      : 'player_points,player_assists';

    const url = eventId
      ? `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${eventId}/odds?apiKey=${oddsKey}&regions=us&markets=${markets}&bookmakers=draftkings&oddsFormat=american`
      : `https://api.the-odds-api.com/v4/sports/${apiSport}/odds?apiKey=${oddsKey}&regions=us&markets=${markets}&bookmakers=draftkings&oddsFormat=american`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ props: [] });

    const data = await res.json();
    const events = Array.isArray(data) ? data : [data];

    const props = [];
    for (const event of events) {
      if (!event?.bookmakers?.length) continue;
      const dk = event.bookmakers.find(b => b.key === 'draftkings');
      if (!dk) continue;

      for (const market of dk.markets || []) {
        for (const outcome of market.outcomes || []) {
          props.push({
            eventId: event.id,
            away: event.away_team,
            home: event.home_team,
            commenceTime: event.commence_time,
            marketKey: market.key,
            playerName: outcome.description || outcome.name,
            propType: market.key.replace(/_/g, ' ').replace('player ', '').replace('batter ', '').replace('pitcher ', ''),
            line: outcome.point,
            side: outcome.name, // Over/Under
            price: outcome.price,
          });
        }
      }
    }

    return NextResponse.json({ props });
  } catch (err) {
    console.error('Props fetch error:', err.message);
    return NextResponse.json({ props: [] });
  }
}
