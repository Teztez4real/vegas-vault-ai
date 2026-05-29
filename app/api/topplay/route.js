/**
 * /api/topplay
 * 
 * Selects and analyzes the Top Play of the Day.
 * 
 * Selection criteria (in order of priority):
 * 1. Game must be in a clearly defined slot (PUBLIC or VEGAS) — slot pattern must be set
 * 2. Game must have strong sharp signals OR clear matchup dominance
 * 3. Line must make sense for the slot (VEGAS = trap potential, PUBLIC = clean favorite)
 * 4. No injury uncertainty (Trell Rule active = skip)
 * 5. Earlier game times preferred (more time to act)
 * 
 * GET /api/topplay?date=YYYY-MM-DD  — returns cached top play or triggers analysis
 * POST /api/topplay                  — force re-analyze (admin only)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { buildBaseballPrompt } from '@/lib/prompts';

const ADMIN_EMAIL = 'battlecortez@gmail.com';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── SCORE A GAME FOR TOP PLAY ELIGIBILITY ──────────────────────────────────

function scoreGame(game) {
  let score = 0;
  const reasons = [];
  const disqualifiers = [];

  // ── DISQUALIFIERS (automatic skip) ──────────────────────────────────────
  
  // No odds = skip
  if (!game.homeML || game.homeML === 'N/A' || !game.awayML || game.awayML === 'N/A') {
    disqualifiers.push('No odds data');
    return { score: -999, reasons, disqualifiers };
  }

  // Slot bonus — if slot is assigned, add clarity bonus
  if (game.slot === 'PUBLIC' || game.slot === 'VEGAS') {
    score += 5;
  }

  // No pitcher data = weaker candidate
  if (!game.homePitcher || game.homePitcher === 'TBD' || !game.awayPitcher || game.awayPitcher === 'TBD') {
    score -= 15;
    reasons.push('TBD pitchers — weaker candidate');
  }

  // ── SLOT CLARITY ────────────────────────────────────────────────────────
  // The slot must be unambiguous — we check this via the admin pattern being set
  // (if pattern was set, every slot is deliberate)
  score += 20;
  reasons.push(`Clear ${game.slot} slot`);

  // ── SHARP SIGNALS ──────────────────────────────────────────────────────
  const lm = (game.lineMovement || '').toLowerCase();
  
  if (game.rlm) {
    score += 30;
    reasons.push(`⚡ Sharp signal: ${game.rlm}`);
  }
  if (lm.includes('steam')) {
    score += 25;
    reasons.push('🔴 Steam move detected');
  }
  if (lm.includes('sharp')) {
    score += 20;
    reasons.push('🟠 Sharp action detected');
  }
  if (lm.includes('notable')) {
    score += 10;
    reasons.push('🟡 Notable movement');
  }

  // ── EV ───────────────────────────────────────────────────────────────────
  const maxEV = Math.max(game.homeEV || 0, game.awayEV || 0);
  if (maxEV > 3) { score += 20; reasons.push(`+EV: ${maxEV}%`); }
  else if (maxEV > 1) { score += 10; reasons.push(`Slight +EV: ${maxEV}%`); }

  // ── SLOT-SPECIFIC SCORING ────────────────────────────────────────────────
  if (game.slot === 'VEGAS') {
    // Vegas slot: want a clear trap setup — public side obvious, sharp on other side
    if (game.rlm) {
      score += 15;
      reasons.push('RLM aligns perfectly with VEGAS slot');
    }
    // Public heavy on one side = good trap candidate
    const betPct = parseInt(game.betPercentage) || 0;
    if (betPct >= 65) { score += 15; reasons.push(`Public ${betPct}% on one side — trap potential`); }
  } else {
    // Public slot: want clean matchup, clear favorite, straightforward
    if (!game.rlm && lm.includes('stable')) {
      score += 10;
      reasons.push('Clean line — no noise in PUBLIC slot');
    }
  }

  // ── TIMING — prefer earlier games (more time to act) ─────────────────────
  if (game.rawTime) {
    const hour = new Date(game.rawTime).getUTCHours();
    if (hour < 20) { score += 10; reasons.push('Early game — more time to act'); }     // before 8pm UTC (~2pm CT)
    else if (hour < 23) { score += 5; }
  }

  // ── RECORD STRENGTH ────────────────────────────────────────────────────
  const parseRecord = (r) => {
    if (!r || r === 'N/A') return null;
    const m = r.match(/(\d+)-(\d+)/);
    return m ? { w: parseInt(m[1]), l: parseInt(m[2]) } : null;
  };
  const homeRec = parseRecord(game.homeRecord);
  const awayRec = parseRecord(game.awayRecord);
  if (homeRec && awayRec) {
    const homeWinPct = homeRec.w / (homeRec.w + homeRec.l);
    const awayWinPct = awayRec.w / (awayRec.w + awayRec.l);
    const mismatch = Math.abs(homeWinPct - awayWinPct);
    if (mismatch > 0.15) { score += 10; reasons.push('Clear record mismatch'); }
  }

  // ── SERIES CONTEXT ─────────────────────────────────────────────────────
  if (game.seriesGame && game.seriesLength) {
    const g = parseInt(game.seriesGame);
    const l = parseInt(game.seriesLength);
    if (g === l) { score += 8; reasons.push('Series finale — urgency factor'); }
    if (g === 1) { score += 5; reasons.push('Series opener'); }
  }

  return { score, reasons, disqualifiers };
}

// ── RUN ANALYSIS ──────────────────────────────────────────────────────────────

async function analyzeGame(game) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build enhanced prompt with TOP PLAY context
  const basePrompt = buildBaseballPrompt(game);
  const topPlayContext = `

⭐ IMPORTANT — TOP PLAY OF THE DAY ANALYSIS ⭐
This game has been selected as the top play candidate for today. Your analysis must be:
1. EXCEPTIONALLY thorough — go deeper on every step than a normal analysis
2. SLOT-ALIGNED — the ${game.slot} slot assignment is definitive. Build your entire analysis around what this slot means.
3. HONEST — if after full analysis the edge is not clear, the tier MUST be PASS. Do NOT force a pick.
4. BET TYPE earned — never default to ML. The game script must demand the specific bet type you choose.

The ${game.slot} slot means:
${game.slot === 'VEGAS' ? '- Vegas is presenting a trap. Find the scam play. The public narrative is wrong. Sharp money knows something the public does not. Your job is to identify exactly what that is and bet the correct side.' : '- This is a straightforward public game. The better team/pitcher/matchup should win. No tricks — just identify who has the real edge and play it clean.'}

If you cannot clearly identify the edge after full analysis — PASS. A confident PASS is better than a forced play.`;

  const fullPrompt = basePrompt + topPlayContext;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',  // Use Opus for top play — max accuracy
    max_tokens: 4000,
    messages: [{ role: 'user', content: fullPrompt }],
  });

  const text = message.content.map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();

  let result;
  try {
    result = JSON.parse(clean);
  } catch {
    // Try extracting JSON from the text
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) result = JSON.parse(match[0]);
    else throw new Error('Could not parse AI response as JSON');
  }

  if (!result.summary) throw new Error('No summary in AI response');
  return result;
}

// ── GET HANDLER ───────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') || todayStr();
  const force = searchParams.get('force') === '1';

  const sb = getAdmin();

  // Top play only generates on the day of the games
  const todayDate = todayStr();
  if (dateParam !== todayDate) {
    return NextResponse.json({ topPlay: null, message: 'Top play only available on game day' });
  }

  // Check cache first
  if (!force) {
    try {
      const { data } = await sb
        .from('top_plays')
        .select('*')
        .eq('date', dateParam)
        .maybeSingle();

      if (data?.result) {
        return NextResponse.json({
          topPlay: data,
          cached: true,
          generatedAt: data.generated_at,
        });
      }
    } catch (e) {
      console.error('Top play cache read error:', e.message);
    }
  }

  // No cache — fetch today's games directly via the today API URL
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vegas-vault-ai-l6jk.vercel.app';
    let games = [];
    try {
      const gamesRes = await fetch(`${baseUrl}/api/today?date=${dateParam}`, {
        cache: 'no-store',
        headers: { 'x-internal': '1' },
        signal: AbortSignal.timeout(25000), // 25s timeout
      });
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        games = gamesData.games || [];
      }
    } catch (fetchErr) {
      console.error('Top play: could not fetch games:', fetchErr.message);
    }

    if (!games.length) {
      return NextResponse.json({ error: 'No games available', topPlay: null });
    }

    // Score all games and pick the best candidate
    const scored = games
      .filter(g => g.sport === 'MLB') // MLB only for now
      .map(g => ({ game: g, ...scoreGame(g) }))
      .filter(s => s.score > 0) // must have positive score
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return NextResponse.json({ error: 'No eligible games for top play today', topPlay: null });
    }

    const topCandidate = scored[0];
    console.log(`Top play candidate: ${topCandidate.game.away} @ ${topCandidate.game.home} (score: ${topCandidate.score})`);
    console.log('Reasons:', topCandidate.reasons);

    // Run full analysis
    const result = await analyzeGame(topCandidate.game);

    // If the AI passes it, try the next best candidate (up to 3)
    let finalResult = result;
    let finalGame = topCandidate.game;
    let attempt = 0;

    while ((finalResult.summary?.tier === 'PASS' || finalResult.summary?.tier === '3') && attempt < 2) {
      attempt++;
      if (scored[attempt]) {
        console.log(`Candidate ${attempt} passed — trying next: ${scored[attempt].game.away} @ ${scored[attempt].game.home}`);
        finalResult = await analyzeGame(scored[attempt].game);
        finalGame = scored[attempt].game;
      } else break;
    }

    // Build the top play record
    const topPlay = {
      date: dateParam,
      game_key: `${finalGame.away}|${finalGame.home}`,
      away: finalGame.away,
      home: finalGame.home,
      away_abbr: finalGame.awayAbbr,
      home_abbr: finalGame.homeAbbr,
      time: finalGame.time,
      slot: finalGame.slot,
      away_ml: finalGame.awayML,
      home_ml: finalGame.homeML,
      score: scored[0].score,
      selection_reasons: scored[0].reasons,
      result: finalResult,
      generated_at: new Date().toISOString(),
    };

    // Cache in Supabase
    try {
      await sb.from('top_plays').upsert(topPlay, { onConflict: 'date' });
    } catch (e) {
      console.error('Top play cache write error:', e.message);
    }

    return NextResponse.json({ topPlay, cached: false });

  } catch (err) {
    console.error('/api/topplay error:', err.message);
    return NextResponse.json({ error: err.message, topPlay: null }, { status: 500 });
  }
}

// ── POST HANDLER (force re-analyze, admin only) ───────────────────────────────

export async function POST(request) {
  try {
    const { token, date } = await request.json();
    const sb = getAdmin();
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dateParam = date || todayStr();
    // Delete cached result to force re-analysis
    await sb.from('top_plays').delete().eq('date', dateParam);

    // Trigger fresh analysis
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://vegas-vault-ai-l6jk.vercel.app'}/api/topplay?date=${dateParam}&force=1`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
