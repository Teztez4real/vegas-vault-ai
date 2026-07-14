import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL } from '@/lib/aiModel.js';
import { buildPropsPrompt } from '../../../lib/propsModel.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST: Analyze a prop ──────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const propData = await req.json();
    const prompt = buildPropsPrompt(propData);

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt + '\n\nRespond with ONLY a valid JSON object. No preamble, no markdown. Start with { and end with }.' },
      ],
    });

    const raw = message.content?.[0]?.text || '';
    // Extract JSON — find the outermost { }
    let result;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      // Try direct parse first
      result = JSON.parse(clean);
    } catch {
      try {
        // Try extracting JSON block
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) result = JSON.parse(match[0]);
        else throw new Error('No JSON found');
      } catch {
        result = {
          summary: {
            pick: 'Parse Error', line: propData.line, price: 'N/A',
            tier: '3', tierLabel: 'Tier 3', confidence: 'LOW',
            discrepancySize: 'SMALL', projection: 'N/A',
            verdict: 'Re-analyze to get the full breakdown.',
          },
          parseError: true,
        };
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Props analyze error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── GET: Fetch all props for today's games automatically ──────────────────────
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') || 'MLB';
    const oddsKey = process.env.ODDS_API_KEY;

    if (!oddsKey) return NextResponse.json({ props: [] });

    const sportMap = {
      'MLB': 'baseball_mlb',
      'NBA': 'basketball_nba',
      'NFL': 'americanfootball_nfl',
      'Tennis': 'tennis_atp_french_open',
      'WNBA': 'basketball_wnba',
    };
    const apiSport = sportMap[sport] || 'baseball_mlb';

    const marketsMap = {
      'MLB': 'batter_hits,batter_home_runs,batter_rbis,batter_total_bases,pitcher_strikeouts,pitcher_hits_allowed,pitcher_earned_runs',
      'NBA': 'player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals',
      'NFL': 'player_pass_tds,player_pass_yards,player_rush_yards,player_reception_yards,player_receptions',
      'Tennis': 'match_winner',
      'WNBA': 'player_points,player_rebounds,player_assists',
    };
    const markets = marketsMap[sport] || marketsMap['MLB'];

    // Step 1: Get today's events for this sport
    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${apiSport}/events?apiKey=${oddsKey}`,
      { cache: 'no-store' }
    );
    if (!eventsRes.ok) return NextResponse.json({ props: [] });
    const events = await eventsRes.json();

    // Filter to today only
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = (events || []).filter(e => {
      const d = e.commence_time?.split('T')[0];
      return d === today;
    });

    if (!todayEvents.length) return NextResponse.json({ props: [] });

    // Step 2: Fetch props per event in parallel (limit to 8 games to save API credits)
    const props = [];
    await Promise.allSettled(
      todayEvents.slice(0, 8).map(async (event) => {
        try {
          const propRes = await fetch(
            `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${event.id}/odds?apiKey=${oddsKey}&regions=us&markets=${markets}&bookmakers=draftkings&oddsFormat=american`,
            { cache: 'no-store' }
          );
          if (!propRes.ok) return;
          const propData = await propRes.json();
          const dk = propData.bookmakers?.find(b => b.key === 'draftkings');
          if (!dk) return;

          for (const market of dk.markets || []) {
            // Group outcomes by player (description field)
            const byPlayer = {};
            for (const outcome of market.outcomes || []) {
              const player = outcome.description || outcome.name;
              if (!byPlayer[player]) byPlayer[player] = { over: null, under: null, line: outcome.point };
              if (outcome.name === 'Over') byPlayer[player].over = outcome.price;
              if (outcome.name === 'Under') byPlayer[player].under = outcome.price;
            }

            for (const [playerName, pData] of Object.entries(byPlayer)) {
              if (!pData.line && pData.line !== 0) continue;
              props.push({
                eventId: event.id,
                away: event.away_team,
                home: event.home_team,
                commenceTime: event.commence_time,
                sport,
                marketKey: market.key,
                propType: market.key
                  .replace('batter_', '')
                  .replace('pitcher_', '')
                  .replace('player_', '')
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase()),
                playerName,
                line: pData.line,
                overPrice: pData.over != null ? (pData.over > 0 ? `+${pData.over}` : String(pData.over)) : '-110',
                underPrice: pData.under != null ? (pData.under > 0 ? `+${pData.under}` : String(pData.under)) : '-110',
              });
            }
          }
        } catch {}
      })
    );

    return NextResponse.json({ props });
  } catch (err) {
    console.error('Props fetch error:', err.message);
    return NextResponse.json({ props: [] });
  }
}
