import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildBaseballPrompt, buildTennisPrompt, buildNFLPrompt } from '@/lib/prompts';
import { buildNBAPrompt } from '@/lib/nbaModel';

function buildPrompt(game) {
  if (game.sport === 'Tennis') return buildTennisPrompt(game);
  if (game.sport === 'NBA') return buildNBAPrompt(game);
  if (game.sport === 'NFL') return buildNFLPrompt(game);
  return buildBaseballPrompt(game);
}

export async function POST(request) {
  try {
    const { game } = await request.json();
    const prompt = buildPrompt(game);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2200,
      messages: [
        {
          role: 'user',
          content: prompt + `\n\nCRITICAL INSTRUCTIONS:
1. You MUST return a complete JSON analysis for every game regardless of missing data.
2. If odds say N/A or Odds API not connected — estimate based on records and matchup. Do NOT refuse.
3. If H2H says "See MLB Stats" — use records and recent form to infer H2H advantage.
4. If injuries say "Check rotowire" — assume both teams are healthy unless stated otherwise.
5. If lineup says "Not yet confirmed" — analyze based on typical lineup depth and season stats.
6. NEVER say data is missing. ALWAYS make a pick. Incomplete data = use best judgment.
7. Keep each analysis field to 2 sentences max. Return valid JSON only. No preamble.`
        }
      ],
    });
    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Generate error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}