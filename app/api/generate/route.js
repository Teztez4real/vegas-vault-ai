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
1. Return complete valid JSON only — no plain text, no markdown, no preamble.
2. If odds say N/A — estimate from records and matchup.
3. If H2H unavailable — use records and recent form.
4. If injuries unavailable — assume healthy unless stated.
5. If lineup unconfirmed — use typical depth and season stats.
6. PASS IS THE CORRECT ANSWER when the edge is not clear. Do not force picks. A game with no real edge MUST be Tier 3 PASS. Forcing a pick on a 50/50 game is how you lose. It is better to pass 8 games and win 4 than to play 12 and win 6.
7. Only pick a side when you can state ONE SPECIFIC CONCRETE reason the line is wrong. If you cannot state that reason clearly, the pick is PASS.
8. MARKET SELECTION — evaluate ML, spread/run line, and total equally on every game. No market has priority over another. Pick whichever market the data supports most clearly. Not every game should be ML — if the data points to an OVER/UNDER or a spread, take it. A slate should have a natural mix of all three markets.
9. saferPlay is MANDATORY — this is the SECOND BEST PLAY for this game, not just a safer version of the primary. Independently evaluate all three markets (ML, run line/spread, total) and pick the two strongest plays. Primary = best play. Secondary = second best play. They can be on different sides or different markets. Must use a different market than primary. Never null.
9. The verdict must be ONE plain sentence. Example: "Tigers ML +123 — they own this pitcher historically and the line is inflated by public momentum." Not a paragraph.`
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

    // Ensure saferPlay is always a proper object — never missing
    if (result.summary && (!result.summary.saferPlay || typeof result.summary.saferPlay === 'string')) {
      const primary = result.summary.pick || '';
      const primaryBet = result.summary.betType || 'ML';
      // Generate a fallback secondary based on primary bet type
      let fallbackBet = primaryBet;
      if (primaryBet.includes('ML') || primaryBet.toLowerCase().includes('moneyline')) {
        fallbackBet = '+1.5';
      } else if (primaryBet.includes('-1.5')) {
        fallbackBet = 'ML';
      } else if (primaryBet.includes('+1.5')) {
        fallbackBet = 'ML';
      } else if (primaryBet.toUpperCase().includes('OVER') || primaryBet.toUpperCase().includes('UNDER')) {
        fallbackBet = 'ML';
      }
      result.summary.saferPlay = {
        pick: primary,
        betType: fallbackBet,
        reasoning: 'Alternative expression of the same edge with different risk profile.',
      };
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