import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildBaseballPrompt, buildNFLPrompt } from '@/lib/prompts';
import { buildNBAPrompt } from '@/lib/nbaModel';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(game) {
  if (game.sport === 'NBA') return buildNBAPrompt(game);
  if (game.sport === 'NFL') return buildNFLPrompt(game);
  return buildBaseballPrompt(game);
}

// In-memory cache — persists across requests on same serverless instance
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function analyzeGame(game, slot) {
  const cacheKey = `${game.id}-${slot}-${game.lineMovement}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.result, cached: true };
  }
  const prompt = buildPrompt({ ...game, slot });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  const result = { summary: parsed.summary, analysis: parsed.analysis, finalVerdict: parsed.finalVerdict };
  cache.set(cacheKey, { result, timestamp: Date.now() });
  return { ...result, cached: false };
}

// POST — analyze single game (instant if cached)
export async function POST(request) {
  try {
    const { game, slot } = await request.json();
    if (!game || !slot) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const result = await analyzeGame(game, slot);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — pre-analyze all games in background
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vegas-vault-ai-mb9t.vercel.app';
    const gamesRes = await fetch(`${baseUrl}/api/today?date=${date}`, { cache: 'no-store' });
    const gamesData = await gamesRes.json();
    const games = (gamesData.games || []).slice(0, 15);

    const results = {};
    for (const game of games) {
      for (const slot of ['PUBLIC', 'VEGAS']) {
        const key = `${game.id}-${slot}`;
        try {
          results[key] = await analyzeGame(game, slot);
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          results[key] = { error: err.message };
        }
      }
    }
    return NextResponse.json({ results, analyzedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
