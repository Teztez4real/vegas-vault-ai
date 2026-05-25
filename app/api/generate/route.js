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
      max_tokens: 1800,
      messages: [
        {
          role: 'user',
          content: prompt + '\n\nIMPORTANT: Be concise. Keep each analysis field to 1-2 sentences max. Return valid JSON only.'
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