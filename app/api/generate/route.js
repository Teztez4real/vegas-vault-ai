import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildBaseballPrompt, buildTennisPrompt } from '@/lib/prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  const { game } = await request.json();
  const prompt = game.sport === 'Tennis'
    ? buildTennisPrompt(game)
    : buildBaseballPrompt(game);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content.map(b => b.text || '').join('');
  const result = JSON.parse(text.replace(/```json|```/g, '').trim());

  return NextResponse.json(result);
}