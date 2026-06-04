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
    messages: [
      { role: 'user', content: prompt + '\n\nRespond with ONLY a valid JSON object. No preamble, no markdown, no explanation. Start with { and end with }.' },
    ],
  });

  const raw = msg.content?.[0]?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
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

    // ── STAGE 1: Data Summary ──────────────────────────────────────────────
    const stage1 = await runStage(stages.s1(game), 600);
    if (!stage1) return NextResponse.json(passResult('Data summary failed — pass.', slot));

    // ── STAGE 2: Edge Filter (GATEKEEPER) ─────────────────────────────────
    const stage2 = await runStage(stages.s2(game, stage1), 700);
    if (!stage2) return NextResponse.json(passResult('Edge analysis failed — pass.', slot));

    // No edge or weak edge → PASS immediately
    if (!stage2.edgeExists || stage2.edgeSide === 'PASS') {
      return NextResponse.json(passResult(
        stage2.passReason || stage2.edgeReason || 'No real edge found — pass.',
        slot
      ));
    }

    // Counter-argument kills a LOW confidence edge → PASS
    if (stage2.counterValid && stage2.confidence === 'LOW') {
      return NextResponse.json(passResult(
        `Edge exists but counter-argument is valid and confidence is low: ${stage2.counterArgument}`,
        slot
      ));
    }

    // ── STAGE 3: Market Selection ──────────────────────────────────────────
    const stage3 = await runStage(stages.s3(game, stage1, stage2), 500);
    if (!stage3?.pick) return NextResponse.json(passResult('Market selection failed — pass.', slot));

    // ── STAGE 4: Final Verdict ─────────────────────────────────────────────
    const stage4 = await runStage(stages.s4(game, stage1, stage2, stage3), 1000);

    if (!stage4?.summary) {
      // Fallback from stages 2+3 if stage 4 parse fails
      return NextResponse.json({
        summary: {
          tier: stage2.confidence === 'HIGH' ? '1' : '2',
          tierLabel: stage2.confidence === 'HIGH' ? 'LOCK' : 'Tier 2',
          pick: stage3.pick,
          betType: stage3.betType,
          slot,
          confidence: stage2.confidence,
          isScamPlay: slot === 'VEGAS',
          verdict: `${stage3.pick} ${stage3.betType} — ${stage2.edgeReason}`,
          signalCount: 'N/A',
          propagandaFade: false,
        },
        analysis: {
          matchupFoundation: `${stage1.awayFacts} vs ${stage1.homeFacts}`,
          pitching: stage1.pitchingFacts || stage1.matchupFacts || '',
          situational: stage1.situationalFacts,
          edgeStrength: stage2.edgeReason,
          marketLogic: stage3.marketReason,
        },
        finalVerdict: `${stage3.pick} ${stage3.betType} — ${stage2.edgeReason}`,
      });
    }

    // Ensure required fields
    if (!stage4.summary.slot) stage4.summary.slot = slot;
    if (!stage4.summary.isScamPlay) stage4.summary.isScamPlay = slot === 'VEGAS';
    if (!stage4.analysis) stage4.analysis = {};

    return NextResponse.json(stage4);

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
