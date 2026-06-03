/**
 * Vegas Vault AI — Multi-Stage Analysis Engine
 * 
 * Stage 1: Data Summary — just facts, no analysis
 * Stage 2: Edge Filter — does a real edge exist? If no → PASS immediately
 * Stage 3: Market Selection — given the edge, which market captures it best
 * Stage 4: Final Verdict — one clean play with one clear reason
 * 
 * The AI cannot skip to a verdict without passing through the edge filter.
 * This is what prevents forced picks.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1: DATA SUMMARY
// Just lay out the facts. No picks. No lean. No analysis.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage1Prompt(game) {
  const sport = game.sport || 'MLB';
  return `You are a sports data analyst. Your ONLY job right now is to summarize the factual data for this game. Do NOT suggest a pick. Do NOT lean toward either side. Just state the facts clearly.

GAME: ${game.away} @ ${game.home} | ${sport} | ${game.time}
SLOT: ${game.slot || 'PUBLIC'}

DATA PROVIDED:
- Away Record: ${game.awayRecord || 'N/A'} | Home Record: ${game.homeRecord || 'N/A'}
- Away Last 5: ${game.awayLast5 || 'N/A'} | Home Last 5: ${game.homeLast5 || 'N/A'}
- Away Last 10: ${game.awayLast10 || 'N/A'} | Home Last 10: ${game.homeLast10 || 'N/A'}
- Away Streak: ${game.awayStreak || 'N/A'} | Home Streak: ${game.homeStreak || 'N/A'}
- H2H Last 5: ${game.h2hLast5 || 'N/A'}
- H2H At Home Venue: ${game.h2hAtHome || 'N/A'}
- Away Pitcher: ${game.awayPitcher || 'TBD'} — ${game.awayPitcherStats || 'N/A'}
- Home Pitcher: ${game.homePitcher || 'TBD'} — ${game.homePitcherStats || 'N/A'}
- Away Lineup: ${game.awayLineup || 'N/A'}
- Home Lineup: ${game.homeLineup || 'N/A'}
- Injuries: ${game.injuries || 'None reported'}
- Weather: ${game.weather || 'N/A'}
- Umpire: ${game.umpire || 'N/A'}
- Moneyline: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
- Run Line/Spread: ${game.spread || 'N/A'}
- Total: ${game.total || 'N/A'}
- Line Movement: ${game.lineMovement || 'N/A'}
- Sharp Signal: ${game.sharpSignal || 'N/A'}
- Series Context: ${game.seriesContext || 'N/A'}

Summarize ONLY the factual state of both teams in 4-6 bullet points. Facts only. No picks.

Return JSON:
{
  "awayFacts": "3-4 key facts about the away team right now",
  "homeFacts": "3-4 key facts about the home team right now",
  "pitchingFacts": "key pitching facts for both sides",
  "situationalFacts": "series context, weather, injuries, umpire — just facts",
  "lineFacts": "current prices, line movement, sharp signal — just facts"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2: EDGE FILTER (THE GATEKEEPER)
// This is the most important stage. If no real edge exists → PASS. Full stop.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage2Prompt(game, stage1Data) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `You are a professional sports bettor with 20 years experience. Your job is to answer ONE question honestly:

"Does a real, specific, concrete betting edge exist in this game?"

If the answer is no — the correct output is PASS. Most games should be PASS. That is how you win long-term.

GAME: ${game.away} @ ${game.home} | ${game.sport} | Slot: ${slot}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}

GAME FACTS (from data analysis):
Away: ${stage1Data.awayFacts}
Home: ${stage1Data.homeFacts}
Pitching: ${stage1Data.pitchingFacts}
Situation: ${stage1Data.situationalFacts}
Lines: ${stage1Data.lineFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT COUNTS AS A REAL EDGE (must be specific, not vague):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MATCHUP EDGE: One team is clearly better for THIS specific game — not in general, but today. Pitching mismatch that is current and real (not reputation). Lineup advantage that is specific and meaningful.

SITUATIONAL EDGE: A real situational factor the market hasn't priced in:
- Series finale: public hammering the series winner, line inflated → series loser is live
- Letdown spot: team just had a big emotional win, playing a lesser opponent, complacency risk
- Revenge game: team lost badly to this opponent recently and plays with extra urgency
- B2B or travel fatigue that is real and meaningful

PRICE EDGE: The line is demonstrably wrong:
- Team priced heavily but their data (form, pitching, H2H) does NOT support that price
- Public bet % is heavily one-sided but the line moved the other way (reverse line movement)
${isVegas ? `
VEGAS SLOT SCAM: This is a VEGAS slot — look harder for the scam play:
- What is the public betting heavily? Is the data actually supporting that side?
- Is the favorite overpriced due to name recognition, recent hot streak, or media narrative?
- Identify what looks wrong AND what is actually correct about the other side` : `
PUBLIC SLOT: Go WITH the trend unless the data actively contradicts the favorite.
High bar to fade the public side in a public slot.`}

PROPAGANDA FADE: Media/ESPN/sports radio is selling one narrative. Is that narrative built on hype or reality? If hype → fade it. If reality → go with it.

TRELL RULE: 
- Star player's FIRST game out (any reason) → bet ON that team
- Star player's FIRST game back after absence → bet AGAINST that team
- Dual opposing triggers cancel each other

SHARP MONEY: One signal among many. If sharp money aligns with your read → adds confidence. If it contradicts → note it but don't flip automatically. Sharps are wrong too.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS CRITERIA — if ANY of these are true → PASS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Both teams are reasonably matched and the line looks fair
- You cannot state ONE specific concrete reason the line is wrong
- The only reason to bet is "the public is on the other side" without matchup support
- The edge feels circumstantial or based on a single minor factor
- You are manufacturing reasons to play rather than finding them in the data
- The game is close to a coin flip (the juice makes coin flips losing plays)

-200+ ODDS WARNING (MLB): If a team is -200 or heavier, the bar to bet them is very high. Verify every reason holds up TODAY — not historically. Check if the line moved TO -200 (public trap) or opened there (genuine gap).

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence. Example: 'Cubs ace is 0-4 with 5.20 ERA in last 5 starts but priced like a lock at -160.' If NONE: explain exactly why there is no edge.",
  "counterArgument": "The strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, exactly why. If playing, null.",
  "propagandaCheck": "What is the public narrative on this game and is it based on hype or reality?",
  "confidence": "HIGH" or "MEDIUM" or "LOW"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 3: MARKET SELECTION
// Given the edge identified, which market captures it best?
// All three markets evaluated equally — no default, no hierarchy.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage3Prompt(game, stage1Data, stage2Data) {
  const sport = game.sport || 'MLB';
  const isBaseball = sport === 'MLB';

  return `You have identified a real betting edge in this game. Now determine which market best captures that edge.

GAME: ${game.away} @ ${game.home} | ${sport}
EDGE: ${stage2Data.edgeReason}
EDGE SIDE: ${stage2Data.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
${isBaseball ? `RUN LINE: ${game.spread || 'N/A'}` : `SPREAD: ${game.spread || 'N/A'}`}
TOTAL: ${game.total || 'N/A'}
PITCHING: ${stage1Data.pitchingFacts}
SITUATION: ${stage1Data.situationalFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATE ALL THREE MARKETS EQUALLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE — best when:
- Edge is clear on who wins but margin is uncertain
- Game projects competitive and close
- ${isBaseball ? 'Run line' : 'Spread'} price is too expensive relative to the dominance expected

${isBaseball ? `RUN LINE (-1.5 / +1.5) — best when:
- Favorite's data shows consistent large win margins (3+ runs avg in L10)
- Significant ace vs weak starter mismatch
- Favorite historically dominates this opponent by large margins
- Underdog's offense is weak and rarely keeps games within a run → take -1.5
- Underdog is competitive, likely to keep it close → take +1.5` : `SPREAD — best when:
- Dominant team averaging double-digit wins in last 10
- Significant talent/scheme/pace mismatch that should produce a blowout
- Underdog competitive enough to cover → take the points`}

TOTAL (OVER/UNDER) — best when:
${isBaseball ? `- Both starters' ERAs: both sharp → UNDER lean. Both struggling → OVER lean
- Park factor strongly favors one direction
- Wind 10mph+ blowing out → OVER. Blowing in → UNDER
- Temperature under 60°F → UNDER lean
- Both offenses hot (4+ runs/game L10) → OVER viable
- Both offenses cold (under 3 runs/game L10) → UNDER viable
- Umpire has strong over/under tendency` : `- Both teams' pace and defensive ratings point to scoring direction
- Playoff intensity suppressing offense → UNDER lean
- Both teams averaging the same direction last 5 (both over 115 or both under 105)`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKET SELECTION RULE:
Pick the market where the edge is CLEAREST and most specific.
Not the market you default to. The market the data actually points to.
A slate should have a natural mix of all three markets.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON:
{
  "selectedMarket": "ML" or "${isBaseball ? 'RUN_LINE' : 'SPREAD'}" or "TOTAL",
  "pick": "Full team name or OVER/UNDER",
  "betType": "Exact bet e.g. 'ML -125' or '+1.5 -115' or 'UNDER 8.5 -110'",
  "mlEvaluation": "One sentence on why ML does or doesn't capture this edge",
  "${isBaseball ? 'runLineEvaluation' : 'spreadEvaluation'}": "One sentence on why the ${isBaseball ? 'run line' : 'spread'} does or doesn't capture this edge",
  "totalEvaluation": "One sentence on why the total does or doesn't capture this edge",
  "marketReason": "One sentence: why THIS market is the best expression of the edge"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4: FINAL VERDICT
// One clean play. One clear reason. Simple enough for anyone to understand.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage4Prompt(game, stage1Data, stage2Data, stage3Data) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `You are finalizing a betting pick. You have the edge identified and the market selected. Now produce the final verdict in a format any bettor can read and act on immediately.

GAME: ${game.away} @ ${game.home} | ${game.sport} | Slot: ${slot}
EDGE: ${stage2Data.edgeReason}
COUNTER-ARGUMENT: ${stage2Data.counterArgument} — Valid? ${stage2Data.counterValid ? 'YES — account for it' : 'NO — edge stands'}
PICK: ${stage3Data.pick} ${stage3Data.betType}
MARKET REASON: ${stage3Data.marketReason}
PROPAGANDA CHECK: ${stage2Data.propagandaCheck}
CONFIDENCE: ${stage2Data.confidence}
${isVegas ? `SLOT: VEGAS — this is a scam play. State why the public is wrong and what the reality is.` : `SLOT: PUBLIC — go with the trend. The better team should win.`}

TIER ASSIGNMENT:
- Tier 1 LOCK: Edge is specific, strong, counter-argument doesn't hold, multiple factors confirm, confidence HIGH
- Tier 2: Edge is real but counter-argument has some validity, or confidence MEDIUM
- Tier 3 PASS: Should not reach here — was filtered in Stage 2

VERDICT RULES:
- One plain sentence maximum
- Must include: who, what bet, and the single strongest reason
- Example: "Tigers ML +127 — ace is 0-3 with 5.40 ERA in last 4 starts and the public is inflating this line off reputation alone"
- No jargon. No hedging. No "could" or "might". State it like you believe it.
- If VEGAS slot: mention why the public narrative is wrong in the verdict

Return JSON:
{
  "summary": {
    "pick": "${game.away} or ${game.home} or OVER or UNDER",
    "betType": "exact bet type and price",
    "tier": "1" or "2" or "3",
    "tierLabel": "LOCK" or "Tier 2" or "PASS",
    "slot": "${slot}",
    "confidence": "${stage2Data.confidence}",
    "isScamPlay": ${isVegas},
    "verdict": "ONE plain sentence. Pick + strongest reason. Simple enough for anyone.",
    "signalCount": "X of 8 signals pointing to this pick",
    "propagandaFade": true or false
  },
  "analysis": {
    "priceVsDataAudit": "Is the line justified by the data?",
    "matchupFoundation": "Who is better in this specific matchup today?",
    "recentForm": "Relevant form for both teams",
    "headToHead": "H2H edge including home venue",
    "pitching": "Pitching matchup summary",
    "situational": "Series context, psychology, urgency",
    "trellRule": "Active or inactive — explain",
    "sharpMoney": "What the sharp signal says and how much weight it carries here",
    "propaganda": "What the public narrative is and whether it reflects reality",
    "scamPlay": "${isVegas ? 'Why it looks wrong AND why it is actually correct' : 'N/A — public slot'}",
    "gameScript": "How this game is likely to play out",
    "marketLogic": "Why this specific market was chosen over the others",
    "edgeStrength": "How strong and specific is the edge?"
  },
  "finalVerdict": "Same as summary.verdict — one plain sentence."
}`;
}
