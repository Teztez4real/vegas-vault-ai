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
      { role: 'user', content: prompt + '\n\nIMPORTANT: Your entire response must be a single valid JSON object. Start your response with { and end with }. Do not include any text before or after the JSON.' },
    ],
  });

  const raw = (msg.content?.[0]?.text || '').trim();

  // Try 1: direct parse
  try { return JSON.parse(raw); } catch {}

  // Try 2: strip markdown fences
  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // Try 3: extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // Try 4: find JSON start
  const jsonStart = stripped.indexOf('{');
  const jsonEnd = stripped.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try { return JSON.parse(stripped.slice(jsonStart, jsonEnd + 1)); } catch {}
  }

  console.error('Stage parse failed. Raw:', raw.slice(0, 500));
  
  // Last resort: try to manually extract key-value pairs and build object
  try {
    const obj = {};
    const kvPattern = /"([^"]+)"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;
    let kv;
    while ((kv = kvPattern.exec(stripped)) !== null) {
      obj[kv[1]] = kv[2];
    }
    if (Object.keys(obj).length > 0) {
      console.log('Recovered via KV extraction:', Object.keys(obj).join(','));
      return obj;
    }
  } catch {}
  
  return null;
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

    // ── STAGE 1+2: Data Summary + Edge Filter ─────────────────────────────
    // Run Stage 1 first
    let stage1 = await runStage(stages.s1(game), 700);
    if (!stage1) stage1 = await runStage(stages.s1(game), 700); // retry once
    if (!stage1) return NextResponse.json(passResult('Data collection failed — please re-analyze.', slot));

    // Then Stage 2 using Stage 1 output
    const stage2 = await runStage(stages.s2(game, stage1), 800);
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
