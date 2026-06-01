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
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt + `\n\nCRITICAL INSTRUCTIONS:
1. You MUST return a complete JSON object — no exceptions, no plain text responses.
2. If odds say N/A — estimate based on records and matchup context.
3. If H2H says "See MLB Stats" — use records and recent form to infer advantage.
4. If injuries say "Check rotowire" — assume both teams healthy unless stated otherwise.
5. If lineup says "Not yet confirmed" — analyze based on typical lineup depth and season stats.
6. NEVER return plain text. ALWAYS return valid JSON.
7. If the analysis does not support a confident play — tier MUST be PASS. Do not force a pick.
7. Return valid JSON only. No preamble.`
        }
      ],
    });
    const text = message.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message, '— raw:', clean.slice(0, 200));
      // Return a valid fallback structure so the card doesn't crash
      result = {
        summary: {
          tier: '3',
          tierLabel: 'Tier 3',
          pick: 'Parse Error',
          betType: 'N/A',
          confidence: 'LOW',
          verdict: 'AI response could not be parsed. Please re-analyze.',
          isScamPlay: false,
          slot: 'PUBLIC',
        },
        parseError: true,
        rawText: clean.slice(0, 500),
      };
    }

    // Ensure summary always exists
    if (!result.summary) {
      result.summary = {
        tier: '3', tierLabel: 'Tier 3', pick: 'No Pick',
        betType: 'N/A', confidence: 'LOW',
        verdict: 'Analysis incomplete — please re-analyze.',
        isScamPlay: false, slot: 'PUBLIC',
      };
    }

    // Map summary fields to analysis for breakdown display
    if (result.summary && !result.analysis) {
      result.analysis = result.summary;
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('Generate error:', err.message);
    // Return valid structure on total failure
    return NextResponse.json({
      summary: {
        tier: '3', tierLabel: 'Tier 3', pick: 'Error',
        betType: 'N/A', confidence: 'LOW',
        verdict: `Analysis failed: ${err.message}. Please re-analyze.`,
        isScamPlay: false, slot: 'PUBLIC',
      },
      error: err.message,
    });
  }
}