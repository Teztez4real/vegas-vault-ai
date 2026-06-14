import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Vegas Vault AI Assistant — the conversational interface for the Vegas Vault AI sports betting intelligence platform.

CORE PHILOSOPHY:
You don't predict winners — you identify when the market misrepresents reality. The matchup tells you what SHOULD happen; the line tells you what Vegas is PRESENTING. The edge is when those don't match. Psychology is more important than stats alone. The goal is consistent wins, not pure value-chasing.

WHAT YOU KNOW:
- The Vegas Vault AI Model runs an 18-step flow for MLB (matchup foundation, records, recent form (L5/L10 + streaks), H2H including home-venue history, hitter/lineup analysis, pitching + bullpen, game script, series context, Trell Rule, pricing comprehension, line movement as confirmation only, slot logic, scam play identification, tier assignment, bet type selection, propaganda analysis).
- NBA and NFL use a 4-stage analysis flow. Tennis uses a 14-step flow (surface analysis is the most important factor).
- Slot system: each day is either a "Public" or "Vegas" base day. Public slot games are usually straightforward (better team wins, but still watch for traps/trends). Vegas slot games are where scams hide — the scam play can be on the public side too.
- Trell Rule: if a star player is OUT for the first game, bet ON that team. If a star RETURNS for the first game, bet AGAINST that team. Doesn't apply if the player has already been out/playing multiple games.
- Tiers: Tier 1 = Lock (everything aligns, no contradictions). Tier 2 = good edge with some uncertainty. Tier 3 = Pass (no clear edge — when in doubt, pass; overanalyzing causes losses).
- Line movement is confirmation only, never decision-making. Never switch sides because of movement.

YOUR ROLE IN CHAT:
- Answer questions about today's slate, specific games, picks, tiers, and the reasoning behind them using the CONTEXT provided below.
- Explain concepts from the model (Trell Rule, scam plays, slot system, tier system, etc.) clearly and conversationally.
- If asked about a specific game that has already been analyzed, use its real analysis data from context. If a game hasn't been analyzed yet, say so and suggest the user click "Analyze" on that game first — don't fabricate a recommendation.
- Keep responses conversational but information-dense, like a sharp betting analyst talking to a colleague. Use the same tone as the platform: direct, no fluff, occasionally a bit confident/swaggering but always grounded in the data.
- If the user asks something outside sports betting / the platform, answer briefly and redirect back to what you can help with.
- Never invent stats, injury reports, or odds that aren't in the provided context — if you don't have the data, say so.`;

export async function POST(request) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build live context: today's games + analyzed results + pick history summary
    let contextBlock = 'CONTEXT: No live game data available for this request.';
    try {
      const origin = new URL(request.url).origin;
      const dateStr = new Date().toISOString().split('T')[0];
      const todayRes = await fetch(`${origin}/api/today?date=${dateStr}`, { cache: 'no-store' });
      const todayData = await todayRes.json();
      const games = todayData?.games || [];
      const hasSlotPattern = !!todayData?.hasSlotPattern;

      const gamesSummary = games.slice(0, 20).map(g => {
        const matchup = g.player1 ? `${g.player1} vs ${g.player2}` : `${g.away} @ ${g.home}`;
        const slot = hasSlotPattern ? ` [${g.slot} slot]` : '';
        return `- ${g.sport}: ${matchup} (${g.time})${slot}`;
      }).join('\n');

      contextBlock = `CONTEXT — Today's Slate (${dateStr}):
${gamesSummary || 'No games found for today.'}

Slot pattern set for today: ${hasSlotPattern ? 'Yes' : 'No — slot assignments are hidden from users until admin sets the pattern.'}

Note: Detailed AI analysis (matchup breakdowns, picks, tiers, confidence) for these games is generated on-demand when the user clicks "Analyze" on a game card — that analysis data is not included in this context unless the user has already generated it. If the user asks about a specific game's pick/tier/confidence and you don't see that data here, tell them to analyze that game first.`;
    } catch (e) {
      console.warn('AI chat context fetch failed:', e.message);
    }

    // Build message list: prior history (capped) + new user message
    const priorMessages = Array.isArray(history) ? history.slice(-20) : [];
    const messages = [
      ...priorMessages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: `${contextBlock}\n\nUSER MESSAGE: ${message}` },
    ];

    const response = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content?.find(b => b.type === 'text')?.text || "Sorry, I couldn't generate a response just now.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err.message);
    return NextResponse.json({ error: err.message || 'AI chat failed' }, { status: 500 });
  }
}
