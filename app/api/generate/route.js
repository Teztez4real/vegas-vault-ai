import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildStage1Prompt, buildStage2Prompt, buildStage3Prompt, buildStage4Prompt,
  buildNBAStage1Prompt, buildNBAStage2Prompt, buildNBAStage3Prompt, buildNBAStage4Prompt,
  buildNFLStage1Prompt, buildNFLStage2Prompt, buildNFLStage3Prompt, buildNFLStage4Prompt,
} from '@/lib/analysisEngine';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runStage(prompt, maxTokens = 800) {
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt + '\n\nRespond with a JSON object only. No markdown. No explanation.' }],
  });

  let raw = (msg.content?.[0]?.text || '').trim();

  // Remove markdown fences character by character approach
  if (raw.startsWith('`')) {
    const firstBrace = raw.indexOf('{');
    if (firstBrace > 0) raw = raw.slice(firstBrace);
  }
  if (raw.endsWith('`')) {
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > 0) raw = raw.slice(0, lastBrace + 1);
  }

  // Find JSON boundaries
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) {
    console.error('No JSON found in response:', raw.slice(0, 200));
    return null;
  }

  const jsonStr = raw.slice(s, e + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('JSON parse error:', err.message, '| str:', jsonStr.slice(0, 200));
    return null;
  }
}

function getStages(sport) {
  if (sport === 'NBA') return {
    s1: buildNBAStage1Prompt,
    s2: buildNBAStage2Prompt,
    s3: buildNBAStage3Prompt,
    s4: buildNBAStage4Prompt,
  };
  if (sport === 'NFL') return {
    s1: buildNFLStage1Prompt,
    s2: buildNFLStage2Prompt,
    s3: buildNFLStage3Prompt,
    s4: buildNFLStage4Prompt,
  };
  // MLB, Tennis, WNBA — use base engine
  return {
    s1: buildStage1Prompt,
    s2: buildStage2Prompt,
    s3: buildStage3Prompt,
    s4: buildStage4Prompt,
  };
}

function passResult(reason, slot) {
  return {
    summary: {
      tier: '3',
      tierLabel: 'PASS',
      pick: 'PASS',
      betType: 'N/A',
      confidence: 'LOW',
      slot: slot || 'PUBLIC',
      isScamPlay: false,
      verdict: reason || 'No clear edge — pass.',
      signalCount: '0 of 8',
      propagandaFade: false,
    },
    analysis: {
      priceVsDataAudit: 'No mispricing identified',
      matchupFoundation: 'Game too close to call',
      edgeStrength: 'No edge found',
    },
    finalVerdict: reason || 'No clear edge — pass.',
  };
}

export async function POST(request) {
  try {
    const { game } = await request.json();
    const slot = game.slot || 'PUBLIC';
    const sport = game.sport || 'MLB';
    const stages = getStages(sport);

    // ── STAGE 1: Build data summary directly from game object (no AI call) ──
    const stage1 = {
      awayFacts: `${game.away}: ${game.awayRecord || 'N/A'} | L5: ${game.awayLast5 || 'N/A'} | L10: ${game.awayLast10 || 'N/A'} | Streak: ${game.awayStreak || 'N/A'} | Away record: ${game.awayAwayRecord || 'N/A'}`,
      homeFacts: `${game.home}: ${game.homeRecord || 'N/A'} | L5: ${game.homeLast5 || 'N/A'} | L10: ${game.homeLast10 || 'N/A'} | Streak: ${game.homeStreak || 'N/A'} | Home record: ${game.homeHomeRecord || 'N/A'}`,
      recentForm: `Away L5 ${game.awayLast5 || 'N/A'} L10 ${game.awayLast10 || 'N/A'} streak ${game.awayStreak || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'} L10 ${game.homeLast10 || 'N/A'} streak ${game.homeStreak || 'N/A'}`,
      headToHead: `Overall H2H: ${game.h2hLast5 || 'N/A'} | Last time at this home venue: ${game.h2hAtHome || 'N/A'}`,
      pitchingFacts: `Away starter: ${game.awayPitcher || 'TBD'} | ${game.awayPitcherStats || 'Stats N/A'} | Home starter: ${game.homePitcher || 'TBD'} | ${game.homePitcherStats || 'Stats N/A'} | Away bullpen: ${game.awayBullpen || 'N/A'} | Home bullpen: ${game.homeBullpen || 'N/A'}`,
      hitterLineup: `Away offense: ${game.awayOffense || game.awayLineup || 'N/A'} | Home offense: ${game.homeOffense || game.homeLineup || 'N/A'} | Away batter splits vs pitcher: ${game.awayBatterSplits || 'N/A'} | Home batter splits vs pitcher: ${game.homeBatterSplits || 'N/A'}`,
      seriesContext: `${game.seriesContext || game.gameNumber || 'N/A'} | Game type: ${game.gameType || 'Regular Season'} | Series record: ${game.seriesRecord || 'N/A'}`,
      matchupFacts: `Away PPG ${game.awayPPG || 'N/A'} OppPPG ${game.awayOppPPG || 'N/A'} OffRtg ${game.awayOffRating || 'N/A'} DefRtg ${game.awayDefRating || 'N/A'} | Home PPG ${game.homePPG || 'N/A'} OppPPG ${game.homeOppPPG || 'N/A'} OffRtg ${game.homeOffRating || 'N/A'} DefRtg ${game.homeDefRating || 'N/A'}`,
      situationalFacts: `Series: ${game.seriesContext || 'N/A'} | Week: ${game.week || 'N/A'} | Rest: Away ${game.awayRest || 'N/A'} Home ${game.homeRest || 'N/A'} | B2B: Away ${game.awayB2B ? 'YES' : 'No'} Home ${game.homeB2B ? 'YES' : 'No'}`,
      injuries: game.injuries || 'None reported',
      weather: game.weather || 'N/A',
      umpire: game.umpire || 'N/A',
      lineFacts: `ML Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'} | Run Line ${game.spread || 'N/A'} (Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}) | Total ${game.total || 'N/A'} (o${game.overPrice || '-110'} u${game.underPrice || '-110'}) | Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}`,
    };

    // ── STAGE 2: Edge Filter ───────────────────────────────────────────────
    const stage2 = await runStage(stages.s2(game, stage1), 1000);
    if (!stage2) return NextResponse.json(passResult('Edge analysis failed — please re-analyze.', slot));

    // No edge or weak edge → PASS immediately
    if (!stage2.edgeExists || stage2.edgeSide === 'PASS') {
      return NextResponse.json(passResult(
        stage2.passReason || stage2.edgeReason || 'No real edge found — pass.',
        slot
      ));
    }

    // Only pass if counter is valid AND confidence is LOW AND edge is weak
    // A valid counter on a MEDIUM confidence play just means Tier 2 — don't pass
    if (stage2.counterValid && stage2.confidence === 'LOW' && stage2.edgeType === 'NONE') {
      return NextResponse.json(passResult(
        `Edge is too weak to play: ${stage2.counterArgument}`,
        slot
      ));
    }

    // ── STAGE 3: Market Selection ──────────────────────────────────────────
    const stage3 = await runStage(stages.s3(game, stage1, stage2), 700);
    if (!stage3?.pick) return NextResponse.json(passResult('Market selection failed — pass.', slot));

    // ── STAGE 4: Final Verdict ─────────────────────────────────────────────
    const stage4 = await runStage(stages.s4(game, stage1, stage2, stage3), 2000);

    // Build complete result — use stage4 if available, fill gaps from earlier stages
    const analysis = stage4?.analysis || {};

    const result = {
      summary: stage4?.summary || {
        tier: stage2.confidence === 'HIGH' ? '1' : '2',
        tierLabel: stage2.confidence === 'HIGH' ? 'LOCK' : 'Tier 2',
        pick: stage3.pick,
        betType: stage3.betType,
        slot,
        confidence: stage2.confidence,
        isScamPlay: slot === 'VEGAS',
        verdict: `${stage3.pick} ${stage3.betType} — ${stage2.edgeReason}`,
        signalCount: 'N/A',
        propagandaFade: stage2.propagandaCheck?.toLowerCase().includes('hype') || false,
      },
      analysis: {
        // From Stage 4 AI output
        priceVsDataAudit: analysis.priceVsDataAudit || `Line: Away ${game.awayML} Home ${game.homeML}. Edge: ${stage2.edgeReason}`,
        matchupFoundation: analysis.matchupFoundation || `${stage1.awayFacts} | ${stage1.homeFacts}`,
        recentForm: analysis.recentForm || stage1.recentForm,
        headToHead: analysis.headToHead || stage1.headToHead,
        pitching: analysis.pitching || stage1.pitchingFacts,
        paceRatings: analysis.paceRatings || stage1.matchupFacts,
        qbMatchup: analysis.qbMatchup,
        injuries: analysis.injuries || stage1.injuries,
        weather: analysis.weather || stage1.weather,
        hitterLineup: analysis.hitterLineup || stage1.hitterLineup,
        seriesContext: analysis.seriesContext || stage1.seriesContext,
        situational: analysis.situational || stage1.situationalFacts,
        umpire: stage1.umpire !== 'N/A' ? stage1.umpire : null,
        trellRule: analysis.trellRule || 'Not triggered',
        sharpMoney: analysis.sharpMoney || stage1.lineFacts,
        propaganda: analysis.propaganda || stage2.propagandaCheck,
        scamPlay: analysis.scamPlay || (slot === 'VEGAS' ? stage2.edgeReason : null),
        gameScript: analysis.gameScript,
        marketLogic: analysis.marketLogic || stage3.marketReason,
        edgeStrength: analysis.edgeStrength || stage2.edgeReason,
      },
      finalVerdict: stage4?.finalVerdict || `${stage3.pick} ${stage3.betType} — ${stage2.edgeReason}`,
    };

    // Clean up null/undefined fields
    Object.keys(result.analysis).forEach(k => {
      if (!result.analysis[k] || result.analysis[k] === 'N/A' || result.analysis[k] === 'undefined') {
        delete result.analysis[k];
      }
    });

    result.summary.slot = slot;
    result.summary.isScamPlay = slot === 'VEGAS';

    return NextResponse.json(result);

  } catch (err) {
    console.error('Generate error:', err.message);
    return NextResponse.json({
      summary: {
        tier: '3', tierLabel: 'PASS', pick: 'Error',
        betType: 'N/A', confidence: 'LOW',
        verdict: `Analysis failed: ${err.message}. Please re-analyze.`,
        isScamPlay: false, slot: 'PUBLIC',
      },
      error: err.message,
    });
  }
}
