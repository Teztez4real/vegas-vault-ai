import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

function buildBaseballPrompt(gameData) {
  return `You are the Vegas Vault AI Model — a professional sports betting analysis system. Identify when market pricing misrepresents reality and find the edge.

GAME DATA:
- Matchup: ${gameData.away} @ ${gameData.home}
- Date: ${gameData.date}
- Time: ${gameData.time}
- Starting Pitchers: ${gameData.awayPitcher} (${gameData.away}) vs ${gameData.homePitcher} (${gameData.home})
- Series: Game ${gameData.seriesGame} of ${gameData.seriesLength}
- Slot: ${gameData.slot}

ODDS & LINE MOVEMENT:
- Current Line: ${gameData.away} ${gameData.awayML} / ${gameData.home} ${gameData.homeML}
- Opening Line: ${gameData.away} ${gameData.openingAwayML} / ${gameData.home} ${gameData.openingHomeML}
- Run Line: ${gameData.runLine}
- Line Movement: ${gameData.lineMovement}
- % of Bets: ${gameData.betPercentage}
- % of Money: ${gameData.moneyPercentage}

TEAM RECORDS:
${gameData.away}: ${gameData.awayRecord} overall | ${gameData.awayAwayRecord} away | Last 5: ${gameData.awayLast5} | Last 10: ${gameData.awayLast10} | Streak: ${gameData.awayStreak}
${gameData.home}: ${gameData.homeRecord} overall | ${gameData.homeHomeRecord} home | Last 5: ${gameData.homeLast5} | Last 10: ${gameData.homeLast10} | Streak: ${gameData.homeStreak}

PITCHING:
${gameData.awayPitcher}: ${gameData.awayPitcherStats}
${gameData.homePitcher}: ${gameData.homePitcherStats}
${gameData.away} Bullpen ERA: ${gameData.awayBullpenERA}
${gameData.home} Bullpen ERA: ${gameData.homeBullpenERA}

OFFENSE:
${gameData.away}: ${gameData.awayOffense}
${gameData.home}: ${gameData.homeOffense}

HEAD TO HEAD:
Last 5: ${gameData.h2hLast5}
At ${gameData.home} (home): ${gameData.h2hAtHome}

INJURIES:
${gameData.injuries}

CBS SPORTS PREVIEW:
${gameData.cbsPreview}

---

Run the FULL Vegas Vault AI Model in this EXACT order. Do not skip any step.

Return ONLY a valid JSON object with this exact structure — no preamble, no markdown, no explanation outside the JSON:

{
  "summary": {
    "pick": "TEAM NAME",
    "betType": "ML or +1.5 or -1.5",
    "tier": "1 or 2 or 3 or PASS",
    "tierLabel": "LOCK or Tier 2 or Tier 3 or PASS",
    "slot": "PUBLIC or VEGAS",
    "isScamPlay": true,
    "verdict": "One sentence final verdict.",
    "confidence": "HIGH or MEDIUM or LOW"
  },
  "analysis": {
    "matchupFoundation": "Matchup truth ignoring the line.",
    "records": "Record analysis including home/away splits, streaks, and last 5/10.",
    "recentForm": "Last 5 and last 10 analysis. Real vs fake form. Blowouts vs close games.",
    "headToHead": "H2H breakdown, who controls the series, margin of victory.",
    "hitterLineup": "Both lineups evaluated: depth, type of offense, hot/cold bats.",
    "pitching": "Both starters and bullpens evaluated.",
    "gameScript": "Classify as Close / Blowout / Controlled and explain what this means for bet type.",
    "seriesContext": "Game number context, urgency, regression flags.",
    "trellRule": "ACTIVE or INACTIVE. If active, explain which player and direction.",
    "pricingComprehension": "Does the line make sense? Opening vs current. Is this team appropriately priced?",
    "lineMovement": "What the movement from opening to current says. Where is sharp money going? What do bet % and money % tell us?",
    "vegasVsPublic": "Public slot or Vegas slot. Where is the public? Where is the trap? What does CBS Sports say vs what the data says?",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative, recent results, CBS Sports angle making it look bad.",
      "whyItsActuallyCorrect": "Matchup reality, pitching, pricing mismatch, line movement, series context."
    }
  },
  "finalVerdict": "2-3 sentence final breakdown explaining the pick, bet type, and why."
}`;
}

function buildTennisPrompt(gameData) {
  return `You are the Vegas Vault Tennis AI Model — a professional tennis betting analysis system. Identify when matchup reality and market price do not align.

MATCH DATA:
- Match: ${gameData.player1} vs ${gameData.player2}
- Surface: ${gameData.surface}
- Tournament: ${gameData.tournament}
- Round: ${gameData.round}
- Current Line: ${gameData.player1} ${gameData.player1ML} / ${gameData.player2} ${gameData.player2ML}
- Line Movement: ${gameData.lineMovement}
- % of Bets: ${gameData.betPercentage || 'N/A'}
- % of Money: ${gameData.moneyPercentage || 'N/A'}

PLAYER DATA:
${gameData.player1}: Ranking #${gameData.player1Ranking} | Last 5: ${gameData.player1Last5} | Surface record: ${gameData.player1SurfaceRecord}
${gameData.player2}: Ranking #${gameData.player2Ranking} | Last 5: ${gameData.player2Last5} | Surface record: ${gameData.player2SurfaceRecord}

HEAD TO HEAD: ${gameData.h2h}
SERVE STATS: ${gameData.player1}: ${gameData.player1ServeStats} | ${gameData.player2}: ${gameData.player2ServeStats}
FATIGUE: ${gameData.player1}: ${gameData.player1Fatigue} | ${gameData.player2}: ${gameData.player2Fatigue}
INJURIES: ${gameData.injuries}

CBS SPORTS PREVIEW:
${gameData.cbsPreview || 'Not available for tennis'}

---

Run the FULL Vegas Vault Tennis AI Model in EXACT order. Return ONLY valid JSON — no preamble, no markdown:

{
  "summary": {
    "pick": "PLAYER NAME",
    "betType": "ML or Game Spread or Set Spread or Over/Under or First Set",
    "tier": "1 or 2 or 3 or PASS",
    "tierLabel": "LOCK or Tier 2 or Tier 3 or PASS",
    "slot": "PUBLIC or VEGAS",
    "isScamPlay": true,
    "verdict": "One sentence final verdict.",
    "confidence": "HIGH or MEDIUM or LOW"
  },
  "analysis": {
    "matchupFoundation": "Matchup truth ignoring odds.",
    "rankingsTier": "Ranking analysis, trend, big-match experience.",
    "surfaceAnalysis": "Who benefits from this surface and why.",
    "recentForm": "Last 5 and 10 matches. Quality of opponents.",
    "tournamentContext": "Round, motivation, pressure.",
    "fatigueScheduling": "Time on court, consecutive matches, rest days.",
    "headToHead": "Overall and surface H2H. Stylistic edges.",
    "serveReturn": "Serve and return breakdown. Who controls service games.",
    "mentalPsychological": "Clutch performance, tiebreak record, meltdown risk.",
    "injuryCheck": "Any injuries, movement limitations.",
    "pricingIntelligence": "Opening vs current line. Bet % and money %. Is the favorite overpriced?",
    "gameScript": "Dominant / Grind / Underdog Live — which script is most likely.",
    "scamPlay": {
      "active": true,
      "whyItLooksWrong": "Public narrative making it look bad.",
      "whyItsActuallyCorrect": "Matchup reality, surface, fatigue, pricing mismatch."
    }
  },
  "finalVerdict": "2-3 sentence final breakdown explaining the pick, bet type, and why."
}`;
}

export async function POST(request) {
  try {
    const { game } = await request.json();

    const prompt = game.sport === 'Tennis'
      ? buildTennisPrompt(game)
      : buildBaseballPrompt(game);

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
