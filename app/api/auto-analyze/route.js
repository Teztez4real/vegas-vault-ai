import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildBaseballPrompt, buildTennisPrompt, buildNFLPrompt } from '../../../lib/prompts.js';
import { buildNBAPrompt } from '../../../lib/nbaModel.js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min max for full slate

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(game) {
  if (game.sport === 'Tennis') return buildTennisPrompt(game);
  if (game.sport === 'NBA') return buildNBAPrompt(game);
  if (game.sport === 'NFL') return buildNFLPrompt(game);
  return buildBaseballPrompt(game);
}

async function analyzeGame(game) {
  const prompt = buildPrompt(game);
  const message = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt + `\n\nCRITICAL: Return valid JSON only. No preamble. No markdown.
1. If odds say N/A — estimate from records and matchup.
2. If H2H unavailable — use records and recent form.
3. If injuries unavailable — assume healthy unless stated.
4. NEVER return plain text. ALWAYS return valid JSON.
5. If no confident play exists — tier MUST be PASS.`
    }],
  });

  const text = message.content.map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    return {
      summary: {
        tier: '3', tierLabel: 'Tier 3', pick: 'Parse Error',
        betType: 'N/A', confidence: 'LOW',
        verdict: 'AI response could not be parsed.',
        isScamPlay: false, slot: game.slot || 'PUBLIC',
      },
      parseError: true,
    };
  }
}

export async function POST(req) {
  try {
    // Verify this is an authorized call (cron or admin)
    const { authorization } = Object.fromEntries(req.headers);
    const body = await req.json().catch(() => ({}));
    const isAuthorized =
      authorization === `Bearer ${process.env.CRON_SECRET}` ||
      body.adminKey === process.env.ADMIN_SECRET_KEY;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const date = body.date || new Date().toISOString().split('T')[0];

    // 1. Fetch today's games
    const gamesRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/today?date=${date}`,
      { cache: 'no-store' }
    );
    if (!gamesRes.ok) throw new Error('Failed to fetch games');
    const { games } = await gamesRes.json();

    if (!games?.length) {
      return NextResponse.json({ message: 'No games today', analyzed: 0 });
    }

    // 2. Filter games that have a slot assigned (admin has set the pattern)
    const toAnalyze = games.filter(g => g.slot && g.slot !== 'NONE');
    if (!toAnalyze.length) {
      return NextResponse.json({ message: 'No slot pattern set yet', analyzed: 0 });
    }

    // 3. Check which games already have fresh results in Supabase
    const { data: existing } = await sb
      .from('game_analyses')
      .select('game_key, updated_at')
      .eq('date', date);

    const existingKeys = new Set((existing || []).map(r => r.game_key));

    // Only analyze games not already done today
    const pending = toAnalyze.filter(g => !existingKeys.has(`${g.id}-${g.slot}`));

    if (!pending.length) {
      return NextResponse.json({ message: 'All games already analyzed', analyzed: 0 });
    }

    // 4. Analyze games in batches of 3 to avoid timeout
    const results = [];
    for (let i = 0; i < pending.length; i += 3) {
      const batch = pending.slice(i, i + 3);
      const batchResults = await Promise.allSettled(
        batch.map(async (game) => {
          const result = await analyzeGame(game);
          const gameKey = `${game.id}-${game.slot}`;

          // Save to Supabase
          await sb.from('game_analyses').upsert({
            game_key: gameKey,
            game_id: game.id,
            date,
            slot: game.slot,
            sport: game.sport,
            away: game.away,
            home: game.home,
            result: JSON.stringify(result),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'game_key' });

          return { gameKey, result };
        })
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // 5. Send push notification to all subscribers
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔒 Vegas Vault AI — Analysis Complete',
          body: `${succeeded} game${succeeded !== 1 ? 's' : ''} analyzed for today. Your plays are ready.`,
          url: '/',
          tag: 'vv-analysis-complete',
          adminKey: process.env.ADMIN_SECRET_KEY,
        }),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      analyzed: succeeded,
      failed,
      total: pending.length,
      date,
    });

  } catch (err) {
    console.error('Auto-analyze error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Vercel cron calls GET — proxy to POST
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  // If cron secret matches, run analysis
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const date = new Date().toISOString().split('T')[0];
    const mockReq = new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': authHeader },
      body: JSON.stringify({ date }),
    });
    return POST(mockReq);
  }

  // Otherwise return stored analyses
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await sb
      .from('game_analyses')
      .select('*')
      .eq('date', date);
    if (error) throw error;
    const analyses = {};
    for (const row of data || []) {
      try { analyses[row.game_key] = JSON.parse(row.result); } catch {}
    }
    return NextResponse.json({ analyses, date });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// OLD GET handler below — replaced above

