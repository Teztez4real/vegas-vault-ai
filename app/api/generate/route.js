import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildStage1Prompt,
  buildStage2Prompt,
  buildStage3Prompt,
  buildStage4Prompt,
} from '@/lib/analysisEngine';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runStage(prompt, maxTokens = 800, forceJson = true) {
  const messages = [{ role: 'user', content: prompt }];
  if (forceJson) messages.push({ role: 'assistant', content: '{' });

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages,
  });

  const raw = (forceJson ? '{' : '') + (msg.content?.[0]?.text || '');
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    // Try extracting JSON block
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
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

    // ── STAGE 1: Data Summary ──────────────────────────────────────────────
    const stage1 = await runStage(buildStage1Prompt(game), 600);
    if (!stage1) {
      return NextResponse.json(passResult('Data summary failed — pass.', slot));
    }

    // ── STAGE 2: Edge Filter (THE GATEKEEPER) ─────────────────────────────
    const stage2 = await runStage(buildStage2Prompt(game, stage1), 700);
    if (!stage2) {
      return NextResponse.json(passResult('Edge analysis failed — pass.', slot));
    }

    // If no edge → PASS immediately. Stages 3 and 4 never run.
    if (!stage2.edgeExists || stage2.edgeSide === 'PASS') {
      return NextResponse.json(passResult(
        stage2.passReason || stage2.edgeReason || 'No real edge found — pass.',
        slot
      ));
    }

    // Counter-argument kills the edge → PASS
    if (stage2.counterValid && stage2.confidence === 'LOW') {
      return NextResponse.json(passResult(
        `Edge exists but counter-argument is valid: ${stage2.counterArgument}`,
        slot
      ));
    }

    // ── STAGE 3: Market Selection ──────────────────────────────────────────
    const stage3 = await runStage(buildStage3Prompt(game, stage1, stage2), 500);
    if (!stage3?.pick) {
      return NextResponse.json(passResult('Market selection failed — pass.', slot));
    }

    // ── STAGE 4: Final Verdict ─────────────────────────────────────────────
    const stage4 = await runStage(buildStage4Prompt(game, stage1, stage2, stage3), 1000);
    if (!stage4?.summary) {
      // Build result from stages 2 and 3 if stage 4 fails
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
          matchupFoundation: stage1.awayFacts + ' vs ' + stage1.homeFacts,
          pitching: stage1.pitchingFacts,
          situational: stage1.situationalFacts,
          edgeStrength: stage2.edgeReason,
          marketLogic: stage3.marketReason,
        },
        finalVerdict: `${stage3.pick} ${stage3.betType} — ${stage2.edgeReason}`,
      });
    }

    // Merge stage4 with any missing fields
    const result = stage4;
    if (!result.analysis) result.analysis = {};
    if (!result.summary.slot) result.summary.slot = slot;
    if (!result.summary.isScamPlay) result.summary.isScamPlay = slot === 'VEGAS';

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
