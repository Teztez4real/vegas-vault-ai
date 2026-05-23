import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildBaseballPrompt, buildTennisPrompt } from '@/lib/prompts';
import { buildNBAPrompt } from '@/lib/nbaModel';

function buildPrompt(game) {
  if (game.sport === 'Tennis') return buildTennisPrompt(game);
  if (game.sport === 'NBA') return buildNBAPrompt(game);
  return buildBaseballPrompt(game);
}

export async function POST(request) {
  try {
    const { game } = await request.json();
    const prompt = buildPrompt(game);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
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