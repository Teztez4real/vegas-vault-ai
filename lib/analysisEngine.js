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
  return `Summarize this ${sport} game. No picks. Just facts. Return ONLY valid JSON.

${game.away} @ ${game.home} | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} | Home ${game.homeRecord || 'N/A'}
Form: Away L5 ${game.awayLast5 || 'N/A'} L10 ${game.awayLast10 || 'N/A'} streak ${game.awayStreak || 'N/A'}
Form: Home L5 ${game.homeLast5 || 'N/A'} L10 ${game.homeLast10 || 'N/A'} streak ${game.homeStreak || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | Last at home venue: ${game.h2hAtHome || 'N/A'}
Away Pitcher: ${game.awayPitcher || 'TBD'} | ${game.awayPitcherStats || 'N/A'}
Home Pitcher: ${game.homePitcher || 'TBD'} | ${game.homePitcherStats || 'N/A'}
Injuries: ${game.injuries || 'None reported'} | Weather: ${game.weather || 'N/A'} | Umpire: ${game.umpire || 'N/A'}
Opening ML: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'}
Current ML: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
Run Line: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice || '-110'} / Home ${game.spread || '-1.5'} ${game.homeSpreadPrice || '-110'}
Total: Over ${game.total || 'N/A'} ${game.overPrice || '-110'} / Under ${game.total || 'N/A'} ${game.underPrice || '-110'}
PRICING NOTE: Use exact prices — value is in the juice. Run line at -105 vs -125 matters.
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}
Series: ${game.seriesContext || 'N/A'}

Return ONLY this JSON with no extra text:
{"awayFacts":"3 key facts about away team form and strengths right now","homeFacts":"3 key facts about home team form and strengths right now","recentForm":"away team L5 and L10 trend AND home team L5 and L10 trend — who is hot who is cold","headToHead":"overall H2H record AND specifically last time at this home venue including result and margin — go to last season if needed","pitchingFacts":"both starters current ERA WHIP and recent form","situationalFacts":"series context and any relevant schedule factors","injuries":"all IL and day-to-day players both teams or none reported","weather":"temp wind direction and how it affects scoring","lineFacts":"line movement sharp signal and book gaps"}`;
}

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

GAME FACTS:
Away: ${stage1Data.awayFacts}
Home: ${stage1Data.homeFacts}
Recent Form: ${stage1Data.recentForm}
H2H + Home Venue: ${stage1Data.headToHead}
Pitching: ${stage1Data.pitchingFacts}
Hitter/Lineup: ${stage1Data.hitterLineup || 'N/A'}
Series Context: ${stage1Data.seriesContext || 'N/A'}
MANDATORY: Use your knowledge of the current MLB/NBA/NFL schedule to state the ACTUAL series context — what game number is this in the series, what is the series record (e.g. "Cubs lead 2-0", "Series tied 1-1"), who has momentum, and whether this is a series finale. Do NOT say "not specified" — look it up from your knowledge. This is one of the most important factors in the analysis.
Hitter/Lineup: ${stage1Data.hitterLineup || 'N/A'}
Injuries: ${stage1Data.injuries || 'None reported'}
Weather: ${stage1Data.weather || 'N/A'} | Umpire: ${stage1Data.umpire || 'N/A'}
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
VEGAS SLOT — THE SCAM CAN BE HIDING ANYWHERE. YOUR JOB IS TO FIND IT.

The scam is not always the public narrative. It can hide in ANY of these places — check every one:

PITCHING SCAM (most overlooked):
- The better pitcher on paper doesn't always win. The "ace" tag is often a trap.
- Is the ace running on reputation but showing declining velocity, elevated ERA, or poor recent starts?
- Does the opposing lineup specifically eat this pitcher's approach? A groundball pitcher vs a team that crushes groundballs is a scam regardless of ERA.
- Is the "weak" starter quietly pitching better than their numbers show in recent weeks?
- Public sees "Ace vs nobody" and hammers the favorite — check if the ace has actually won recently.

LINE SCAM:
- Is the favorite priced -160 for a team that's 4-6 in their last 10? That's reputation pricing, not current reality.
- Line moved against public direction = sharps already found the scam.
- Book disagreement = sharp money hit one side. Follow the gap.

FORM SCAM:
- Hot streak team in a regression spot (series finale, emotional letdown, tough travel after big win).
- Team LOOKS bad but has been losing close games on bad luck — they're live.
- Public overreacts to the last game's blowout score. Blowouts don't predict the next game.

SITUATIONAL SCAM:
- Series finale — public hammers series winner, line inflated, series loser plays with urgency.
- Revenge game — team got embarrassed last meeting and is hungry today.
- Letdown spot — team just had emotional big win, now facing a lesser opponent they're overlooking.
- Travel/fatigue edge the public ignores completely.

LINEUP/MATCHUP SCAM:
- A "weak" offense that specifically punishes this pitcher's style and arsenal.
- Park + weather factors the public never accounts for (wind blowing out, hitter park, cold weather).
- Platoon advantages hidden in the lineup data.

HOW TO FIND THE SCAM:
1. What is the public assuming about this game?
2. What does the raw data say when you remove the narrative?
3. The gap between public assumption and data reality IS the scam.
4. The scam can be on the favorite side too — sometimes the public is right on side but wrong on market (ML when the run line is the play).

MANDATORY: State WHY IT LOOKS RIGHT TO THE PUBLIC and WHY THE DATA SAYS SOMETHING DIFFERENT.` : `
PUBLIC SLOT: Go with the trend unless data actively contradicts it. But still scan for hidden scams — check pitching matchup reality vs reputation, form trends, and situational factors even in public slots.`}

PROPAGANDA FADE: Media/ESPN/sports radio is selling one narrative. Is that narrative built on hype or reality? If hype → fade it. If reality → go with it.

TRELL RULE: 
- Star player's FIRST game out (any reason) → bet ON that team
- Star player's FIRST game back after absence → bet AGAINST that team
- Dual opposing triggers cancel each other

SHARP MONEY: One signal among many. If sharp money aligns with your read → adds confidence. If it contradicts → note it but don't flip automatically. Sharps are wrong too.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS CRITERIA — if ANY of these are true → PASS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS only when the game is a genuine coin flip with no meaningful edge anywhere — not because one counter-argument exists, not because the edge is modest, not because a data point is missing.
- A real but modest edge = Tier 2. TAKE IT.
- A competitive game with a pitching or situational edge = Tier 2. TAKE IT.
- Passes should be rare — 2-3 per full slate max, not half the games.
- Only pass when every single signal is truly neutral and you are clearly manufacturing reasons.

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
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'} (Opened: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'})
${isBaseball ? `RUN LINE: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'-1.5'} ${game.homeSpreadPrice||'-110'}` : `SPREAD: Away ${game.spread ? (parseFloat(game.spread)>0?'+':'')+(-parseFloat(game.spread||0)).toFixed(1) : 'N/A'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'N/A'} ${game.homeSpreadPrice||'-110'}`}
TOTAL: Over ${game.total||'N/A'} ${game.overPrice||'-110'} / Under ${game.total||'N/A'} ${game.underPrice||'-110'}
CRITICAL: These are the exact current prices. Value is in the juice — -105 vs -130 on the same bet is a massive difference. Factor the actual price when selecting the market.
PITCHING: ${stage1Data.pitchingFacts}
SITUATION: ${stage1Data.situationalFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATE ALL THREE MARKETS EQUALLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE — best when:
- Edge is clear on who wins but margin is uncertain AND the team is the FAVORITE
- Game projects competitive and close
- UNDERDOG ML: only take underdog ML when the edge is so strong you expect them to win outright. If the underdog has a real edge but winning outright is uncertain, +1.5/+ATS is the safer and smarter play. Default to the run line/spread for underdogs unless the outright win is clearly supported.

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
    "hitterLineup": "Both lineups — hot/cold bats, platoon advantages, key hitters vs this pitcher",
    "seriesContext": "Where are we in the series, who has momentum, series finale implications",
    "situational": "Psychology, urgency, letdown/revenge factors",
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


// ═════════════════════════════════════════════════════════════════════════════
// NBA ENGINE
// Basketball logic: pace, ratings, rest, playoff context, defensive schemes
// ═════════════════════════════════════════════════════════════════════════════

export function buildNBAStage1Prompt(game) {
  return `Summarize this NBA game. No picks. Just facts. Return ONLY valid JSON.

${game.away} @ ${game.home} | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} | Home ${game.homeRecord || 'N/A'}
Form: Away L5 ${game.awayLast5 || 'N/A'} L10 ${game.awayLast10 || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'} L10 ${game.homeLast10 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | Last at home arena: ${game.h2hAtHome || 'N/A'}
Away: PPG ${game.awayPPG || 'N/A'} OppPPG ${game.awayOppPPG || 'N/A'} OffRtg ${game.awayOffRating || 'N/A'} DefRtg ${game.awayDefRating || 'N/A'} Pace ${game.awayPace || 'N/A'}
Home: PPG ${game.homePPG || 'N/A'} OppPPG ${game.homeOppPPG || 'N/A'} OffRtg ${game.homeOffRating || 'N/A'} DefRtg ${game.homeDefRating || 'N/A'} Pace ${game.homePace || 'N/A'}
Rest: Away ${game.awayRest || 'N/A'} days B2B ${game.awayB2B ? 'YES' : 'No'} | Home ${game.homeRest || 'N/A'} days B2B ${game.homeB2B ? 'YES' : 'No'}
Injuries: ${game.injuries || 'None reported'}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Opening Line: Away ${game.openingAwayML || 'N/A'} Home ${game.openingHomeML || 'N/A'}
Current Line: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Line Movement: ${game.lineMovement || 'None'}
Sharp Signal: ${game.sharpSignal || 'None'}
Pricing Notes: ${game.pricingStr || 'N/A'}
Playoff: ${game.playoffContext || 'N/A'}

Return ONLY this JSON:
{"awayFacts":"3 key facts about away team now","homeFacts":"3 key facts about home team now","recentForm":"away L5 L10 trend AND home L5 L10 trend — who is hot who is cold","headToHead":"overall H2H AND last time at this home arena result and margin — go to last season if needed","matchupFacts":"pace matchup offensive vs defensive ratings stylistic edge","situationalFacts":"rest B2B playoff context injuries","lineFacts":"opening line vs current line, direction of movement, sharp signal, which side public is on, any book disagreement"}`;
}

export function buildNBAStage2Prompt(game, stage1) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';
  const isPlayoffs = game.isPlayoffs || game.playoffContext?.includes('Playoff') || game.playoffContext?.includes('Game');

  return `You are a professional basketball bettor. Answer ONE honest question: does a real betting edge exist in this game?

GAME: ${game.away} @ ${game.home} | NBA | Slot: ${slot}${isPlayoffs ? ' | PLAYOFFS' : ''}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
PLAYOFF/SERIES CONTEXT: ${game.playoffContext || game.seriesContext || 'N/A'}
MANDATORY: State the actual series context using your knowledge — game number, series record, who leads, momentum. Do NOT say "not specified."

CRITICAL: Today is June 5, 2026. This is the 2025-26 NBA season. The San Antonio Spurs ARE in the 2026 NBA Finals against the New York Knicks. The Spurs beat the OKC Thunder in 7 games in the Western Conference Finals. The Knicks swept the Cavaliers in the Eastern Conference Finals. Game 1 was won by the Knicks. This is a REAL game. If API data shows invalid records (0-10, N/A), ignore it completely and use your knowledge of both teams' 2025-26 season performance.

FACTS:
Away: ${stage1.awayFacts}
Home: ${stage1.homeFacts}
Recent Form: ${stage1.recentForm}
H2H + Home Arena: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Line Movement: ${game.lineMovement || stage1.lineFacts || 'None'}
Sharp Signal: ${game.sharpSignal || 'None'}
Opening vs Current: Away opened ${game.openingAwayML || 'N/A'} now ${game.awayML || 'N/A'} | Home opened ${game.openingHomeML || 'N/A'} now ${game.homeML || 'N/A'}
Spread: Away ${game.spread ? (parseFloat(game.spread)>0?'+':'')+(-parseFloat(game.spread||0)).toFixed(1) : 'N/A'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'N/A'} ${game.homeSpreadPrice||'-110'}
Total: Over ${game.total||'N/A'} ${game.overPrice||'-110'} / Under ${game.total||'N/A'} ${game.underPrice||'-110'}
CRITICAL: These are the exact current prices. Factor actual juice when picking market — -105 vs -130 is a huge value difference.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASKETBALL-SPECIFIC EDGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PACE/RATINGS MISMATCH: Does one team's offensive rating clearly exploit the other's defensive weakness? Elite offense vs bottom-10 defense = real edge. Similar ratings = no edge.

REST/FATIGUE EDGE: B2B is significant in basketball — a team on zero rest playing a rested opponent is genuinely disadvantaged. Second game of a back-to-back, especially on the road, is a real edge for the opponent.

INJURY IMPACT: Is a star player out or limited? In basketball, one star can change the entire game. Missing your best scorer or defender matters enormously. First game without a star (Trell Rule: bet ON that team). First game back (bet AGAINST — rust factor, overexcited public).

SERIES/PLAYOFF CONTEXT:
${isPlayoffs ? `- This is a PLAYOFF game — defense dominates, scoring drops, unders hit more
- What is the series situation? Team down in series plays with desperation
- SERIES FINALE RULE: Public hammers the series leader. The desperate team is live. Blowouts rarely repeat in a series.
- Elimination games bring out either redemption or collapse — know which team historically handles pressure` : '- Regular season: fatigue, motivation, and schedule matter more than playoffs'}

PSYCHOLOGICAL EDGE: Which team wants this more TODAY? A team fighting for playoff position vs a team with nothing to play for. Revenge game. Bounce-back after blowout loss. These are real basketball edges.

${isVegas ? `VEGAS SLOT — THE SCAM IS HIDING SOMEWHERE. FIND IT.
The scam can be in the matchup (better team on paper vs better team TODAY), the fatigue (B2B team the public ignores), the series context (desperate team vs complacent team), the total (both defenses elite but public bet the over on momentum), or the narrative (big market team overpriced on name alone).
Ask: what is the public assuming? What does the data actually say? The gap is the scam. State WHY IT LOOKS RIGHT TO THE PUBLIC and WHY THE DATA SAYS DIFFERENT.` : `PUBLIC SLOT: Go with the better team. But still check for hidden scams in fatigue, matchup reality vs reputation, and situational factors.`}

PROPAGANDA FADE: What is ESPN/media pushing? Is the narrative based on recent hot game (sample size trap) or genuine form? Fade the hype, trust the data.

SHARP MONEY & LINE MOVEMENT:
- Opening line vs current line: which direction did it move and by how much?
- If public is heavy on one side but line moved opposite = reverse line movement = sharp money on the other side
- Sharp signal flag: if present, treat as meaningful confirmation
- Book price gaps (FD vs DK) = sharp money already hit one book
- Sharp money is ONE signal — it adds confidence when it aligns, gets noted when it contradicts, never overrides the matchup alone

PASS only when it is a genuine coin flip with no meaningful edge.
- Modest edge = Tier 2. Take it.
- Competitive game with real situational or matchup edge = Tier 2. Take it.
- Only pass when every signal is truly neutral. Passes should be rare.

-200+ WARNING: Very high bar to bet a -200 or heavier favorite. Verify every reason holds up TODAY.

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence about why this edge exists",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "propagandaCheck": "What is the public narrative and is it hype or reality?",
  "playoffContext": "${isPlayoffs ? 'Analyze series situation and elimination implications' : 'Regular season context'}",
  "confidence": "HIGH" or "MEDIUM" or "LOW"
}`;
}

export function buildNBAStage3Prompt(game, stage1, stage2) {
  const isPlayoffs = game.isPlayoffs || game.playoffContext?.includes('Playoff');

  return `You identified a real edge. Now pick the best market.

GAME: ${game.away} @ ${game.home} | NBA${isPlayoffs ? ' PLAYOFFS' : ''}
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
MATCHUP: ${stage1.matchupFacts}
SITUATION: ${stage1.situationalFacts}

BASKETBALL MARKET LOGIC:

MONEYLINE: Best when edge is clear on winner, margin is uncertain, AND the team is the favorite. For underdogs, ML is only the play when the edge is overwhelming.

UNDERDOG RULE — CRITICAL: If your pick is the underdog (+odds), DEFAULT to +ATS spread FIRST unless the edge is overwhelming (5+ clear signals) or the spread price is worse than -200.
Taking the underdog +ATS means you win even if they lose by less than the spread — almost always the safer play.

SPREAD: Best when one team is significantly better AND expected to win by a clear margin. Dominant team with clear talent gap, strong defensive matchup advantage, or blowout candidate. Also take +ATS when underdog is competitive and likely to keep it close. ${isPlayoffs ? 'Playoff spreads tighten — teams adjust. Be careful with large spreads in series.' : ''}

TOTAL: Best when scoring direction is clearer than side direction.
- ${isPlayoffs ? 'PLAYOFF UNDERS: Hit ~55% historically. Defensive intensity rises, pace slows, teams adjust. In close competitive playoff series → lean UNDER.' : 'Regular season: pace matchup drives the total.'}
- Slow pace + strong defenses on both sides → UNDER
- Fast pace + weak defenses on both sides → OVER
- Elite offense vs weak defense → lean OVER
- B2B fatigue suppresses scoring → UNDER lean
- Both teams averaging over 115 last 5 → OVER viable
- Both averaging under 105 last 5 → UNDER viable

Pick the market where the edge is CLEAREST. No defaults.

Return JSON:
{
  "selectedMarket": "ML" or "SPREAD" or "TOTAL",
  "pick": "Full team name or OVER/UNDER",
  "betType": "Exact bet e.g. 'ML -115' or '+6.5 -110' or 'UNDER 218.5 -108'",
  "mlEvaluation": "Why ML does or doesn't capture this edge",
  "spreadEvaluation": "Why the spread does or doesn't capture this edge",
  "totalEvaluation": "Why the total does or doesn't capture this edge",
  "marketReason": "Why THIS market is the best expression of the edge"
}`;
}

export function buildNBAStage4Prompt(game, stage1, stage2, stage3) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `Finalize the pick. One clean sentence any bettor can read and act on.

GAME: ${game.away} @ ${game.home} | NBA | Slot: ${slot}
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType}
WHY THIS MARKET: ${stage3.marketReason}
PROPAGANDA: ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence}

TIER: HIGH confidence + strong specific edge + counter doesn't hold = Tier 1 LOCK. MEDIUM or valid counter = Tier 2.

VERDICT: One sentence. Team + bet + strongest reason. Example: "Celtics -4.5 — they've covered by 8+ in 4 straight home games and the Knicks are on a B2B with their best defender questionable."

Return JSON:
{
  "summary": {
    "pick": "team name or OVER/UNDER",
    "betType": "exact bet and price",
    "tier": "1" or "2" or "3",
    "tierLabel": "LOCK" or "Tier 2" or "PASS",
    "slot": "${slot}",
    "confidence": "${stage2.confidence}",
    "isScamPlay": ${isVegas},
    "verdict": "ONE plain sentence — pick + strongest reason",
    "signalCount": "X of 8 signals pointing this way",
    "propagandaFade": true or false
  },
  "analysis": {
    "priceVsDataAudit": "Is the line justified?",
    "matchupFoundation": "Who is better in this specific matchup today?",
    "recentForm": "Relevant form",
    "headToHead": "H2H edge including home venue",
    "paceRatings": "Pace and rating matchup analysis",
    "situational": "Rest, B2B, injuries, playoff context",
    "trellRule": "Active or inactive",
    "sharpMoney": "Opening line vs current line direction, sharp signal, public vs sharp split, how it affects the pick",
    "lineMovement": "Which direction did the line move and what it signals — public trap or sharp action",
    "propaganda": "Public narrative vs reality",
    "scamPlay": "${isVegas ? 'WHERE is the scam hiding in this game — pitching reputation vs reality, form scam, situational scam, line scam, matchup scam? State what the public is wrong about and what the data actually shows.' : 'N/A'},"
    "gameScript": "How this game likely plays out",
    "marketLogic": "Why this market over the others",
    "edgeStrength": "How strong and specific is the edge?"
  },
  "finalVerdict": "Same as summary.verdict"
}`;
}


// ═════════════════════════════════════════════════════════════════════════════
// NFL ENGINE
// Football logic: QB play, O-line, weather, coaching, divisional context
// ═════════════════════════════════════════════════════════════════════════════

export function buildNFLStage1Prompt(game) {
  return `Summarize this NFL game. No picks. Just facts. Return ONLY valid JSON.

${game.away} @ ${game.home} | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} | Home ${game.homeRecord || 'N/A'}
Form: Away L5 ${game.awayLast5 || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | Last at home stadium: ${game.h2hAtHome || 'N/A'}
Away Offense: ${game.awayOffense || 'N/A'} | Home Offense: ${game.homeOffense || 'N/A'}
Injuries: ${game.injuries || 'None reported'} | Weather: ${game.weather || 'N/A'}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}
Week: ${game.week || 'N/A'} | Type: ${game.gameType || 'Regular Season'}

Return ONLY this JSON:
{"awayFacts":"3 key facts about away team now — QB form injuries strengths","homeFacts":"3 key facts about home team now — QB form injuries strengths","recentForm":"away L5 trend AND home L5 trend — who is playing well right now","headToHead":"overall H2H AND last time at this home stadium result and margin — go to last season if needed","matchupFacts":"key schematic matchup how each teams strength exploits the others weakness","situationalFacts":"weather week context divisional game rest injuries","lineFacts":"movement sharp signal book gaps"}`;
}

export function buildNFLStage2Prompt(game, stage1) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `You are a professional football bettor. Answer ONE honest question: does a real betting edge exist in this game?

GAME: ${game.away} @ ${game.home} | NFL | Slot: ${slot}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}

FACTS:
Away: ${stage1.awayFacts}
Home: ${stage1.homeFacts}
Recent Form: ${stage1.recentForm}
H2H + Home Arena: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Line Movement: ${game.lineMovement || stage1.lineFacts || 'None'}
Sharp Signal: ${game.sharpSignal || 'None'}
Opening vs Current: Away opened ${game.openingAwayML || 'N/A'} now ${game.awayML || 'N/A'} | Home opened ${game.openingHomeML || 'N/A'} now ${game.homeML || 'N/A'}
Spread: Away ${game.spread ? (parseFloat(game.spread)>0?'+':'')+(-parseFloat(game.spread||0)).toFixed(1) : 'N/A'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'N/A'} ${game.homeSpreadPrice||'-110'}
Total: Over ${game.total||'N/A'} ${game.overPrice||'-110'} / Under ${game.total||'N/A'} ${game.underPrice||'-110'}
CRITICAL: These are the exact current prices. Factor actual juice when picking market — -105 vs -130 is a huge value difference.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOOTBALL-SPECIFIC EDGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QB MATCHUP: The most important position in football. Is one QB clearly better today — not historically, but based on current form? A struggling QB against a strong pass rush is a real edge. A hot QB against a weak secondary is a real edge.

INJURY IMPACT: In football, injuries accumulate. A team missing key O-linemen, their top WR, or a starting CB can completely change the game. A banged-up QB is the biggest edge in football. Check the full injury report, not just the headlines.

SCHEME MISMATCH: Does one team's offensive scheme specifically exploit the other's defensive weakness? Example: strong running team vs a defense that allows 140+ yards per game on the ground. These mismatches are consistent and exploitable.

WEATHER EDGE: Wind 15mph+ significantly suppresses passing games and totals. Cold weather and rain favor running teams and unders. Dome teams playing outside in cold weather are at a real disadvantage.

DIVISIONAL GAME: Division rivals know each other extremely well. Upsets happen more. Lines are less reliable. Respect the dog in divisional games — they almost always keep it close.

SITUATIONAL EDGE:
- Team on short week (Thursday game after Sunday): real fatigue disadvantage
- Team coming off emotional win vs lesser opponent: letdown spot
- Team with playoff implications vs team with nothing to play for: motivation edge
- Series finale: same rules as other sports — public hammers the winner, loser is live

TRELL RULE: Star player's first game out → bet ON that team. First game back → bet AGAINST.

${isVegas ? `VEGAS SLOT — THE SCAM IS HIDING SOMEWHERE. FIND IT.
Check: QB reputation vs current form (injured or slumping QB still priced like elite), injury report the public glossed over, divisional familiarity (dogs cover more in divisional games), weather impact on the total or a passing team, scheme matchup the public missed, or a team in a letdown spot after an emotional win. The scam can be on any side and any market. State WHY IT LOOKS RIGHT TO THE PUBLIC and WHY THE DATA SAYS DIFFERENT.` : `PUBLIC SLOT: Go with the better team. But still scan for hidden scams — QB form vs reputation, injuries, weather, divisional dynamics.`}

PROPAGANDA FADE: What are NFL analysts/ESPN pushing? Is it based on one big performance (sample size) or genuine form? Fade the hype.

SHARP MONEY: One signal. Confirms the read, doesn't create it.

PASS only when it is a genuine coin flip with no meaningful edge. Modest or situational edges = Tier 2, take them. Passes should be rare — 2-3 per slate max.

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "WEATHER" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "propagandaCheck": "Public narrative vs reality",
  "confidence": "HIGH" or "MEDIUM" or "LOW"
}`;
}

export function buildNFLStage3Prompt(game, stage1, stage2) {
  return `You identified a real edge. Now pick the best market.

GAME: ${game.away} @ ${game.home} | NFL
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
MATCHUP: ${stage1.matchupFacts}
WEATHER: ${stage1.situationalFacts}

FOOTBALL MARKET LOGIC:

MONEYLINE: For favorites in close games. For underdogs — DEFAULT to +ATS spread first. NFL underdogs win outright ~44% but cover ~52% — the spread is almost always the better play for dogs.

UNDERDOG RULE — CRITICAL: If your pick is the underdog (+odds), take the points (+ATS) unless the edge is overwhelming. Getting extra points costs almost nothing in NFL and wins more long-term. Taking a +150 dog that wins 40% of the time is profitable. ML on heavy favorites is usually better expressed as the spread.

SPREAD: The primary NFL market. Most NFL edges are best expressed as spread plays because:
- Football games are scored in chunks (TD = 7, FG = 3)
- Key numbers matter: 3, 6, 7, 10, 14 — avoid laying or taking through these
- One team clearly better by a specific margin → spread
- Underdog competitive but unlikely to win outright → take the points

TOTAL: Best when weather or team quality strongly points to scoring direction.
- Wind 15mph+ → serious UNDER consideration
- Rain/cold → UNDER lean, especially for dome teams playing outside
- Two strong defenses → UNDER lean
- Two weak secondaries → OVER lean
- Divisional game → often lower scoring, defenses know each other
- Team without QB (injury) → UNDER lean

No defaults. Pick where edge is clearest.

Return JSON:
{
  "selectedMarket": "ML" or "SPREAD" or "TOTAL",
  "pick": "Full team name or OVER/UNDER",
  "betType": "Exact bet e.g. 'ML +145' or '-3.5 -110' or 'UNDER 44.5 -108'",
  "mlEvaluation": "Why ML does or doesn't capture this edge",
  "spreadEvaluation": "Why the spread does or doesn't capture this edge",
  "totalEvaluation": "Why the total does or doesn't capture this edge",
  "marketReason": "Why THIS market is the best expression"
}`;
}

export function buildNFLStage4Prompt(game, stage1, stage2, stage3) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `Finalize the pick. One clean sentence any bettor can read and act on immediately.

GAME: ${game.away} @ ${game.home} | NFL | Slot: ${slot}
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType}
WHY THIS MARKET: ${stage3.marketReason}
PROPAGANDA: ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence}

TIER: HIGH + strong specific edge + counter doesn't hold = Tier 1 LOCK. MEDIUM or valid counter = Tier 2.

VERDICT: One sentence. Team + bet + strongest reason. Example: "Bears +7 — their defense is top-5 against the run and the Packers are missing their top two receivers, making this a field goal game at most."

Return JSON:
{
  "summary": {
    "pick": "team name or OVER/UNDER",
    "betType": "exact bet and price",
    "tier": "1" or "2" or "3",
    "tierLabel": "LOCK" or "Tier 2" or "PASS",
    "slot": "${slot}",
    "confidence": "${stage2.confidence}",
    "isScamPlay": ${isVegas},
    "verdict": "ONE plain sentence — pick + strongest reason",
    "signalCount": "X of 8 signals",
    "propagandaFade": true or false
  },
  "analysis": {
    "priceVsDataAudit": "Is the line justified?",
    "matchupFoundation": "Key schematic matchup today",
    "recentForm": "Relevant recent form",
    "headToHead": "H2H and home venue history",
    "qbMatchup": "QB situation for both teams",
    "injuries": "Key injury impact",
    "weather": "Weather impact if relevant",
    "situational": "Week context, divisional, motivation",
    "trellRule": "Active or inactive",
    "sharpMoney": "Sharp signal weight",
    "propaganda": "Public narrative vs reality",
    "scamPlay": "${isVegas ? 'WHERE is the scam hiding in this game — pitching reputation vs reality, form scam, situational scam, line scam, matchup scam? State what the public is wrong about and what the data actually shows.' : 'N/A'},"
    "gameScript": "How this game likely plays out",
    "marketLogic": "Why this market",
    "edgeStrength": "How strong is the edge?"
  },
  "finalVerdict": "Same as summary.verdict"
}`;
}


// ═════════════════════════════════════════════════════════════════════════════
// TENNIS ENGINE
// Tennis logic: surface, serve/return, fatigue, mental strength, rankings
// ═════════════════════════════════════════════════════════════════════════════

export function buildTennisStage1Prompt(game) {
  return `Summarize this Tennis match. No picks. Just facts. Return ONLY valid JSON.

${game.player1 || game.away} vs ${game.player2 || game.home} | ${game.tournament || 'ATP/WTA'} | ${game.time}
Surface: ${game.surface || 'N/A'} | Round: ${game.round || 'N/A'}
Rankings: P1 #${game.player1Ranking || 'N/A'} | P2 #${game.player2Ranking || 'N/A'}
Form: P1 L5 ${game.awayLast5 || 'N/A'} | P2 L5 ${game.homeLast5 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | On this surface: ${game.h2hAtHome || 'N/A'}
P1 Surface Record: ${game.awaySurfaceRecord || 'N/A'} | P2 Surface Record: ${game.homeSurfaceRecord || 'N/A'}
Injuries: ${game.injuries || 'None reported'}
ML: P1 ${game.awayML || 'N/A'} / P2 ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} | Total: ${game.total || 'N/A'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}

Return ONLY this JSON:
{"awayFacts":"3 key facts about P1 current form surface record and serve","homeFacts":"3 key facts about P2 current form surface record and serve","recentForm":"P1 L5 trend and P2 L5 trend — who is hot","headToHead":"overall H2H AND surface-specific H2H — who owns this matchup","matchupFacts":"serve vs return matchup stylistic edge mental strength","situationalFacts":"fatigue tournament round motivation pressure injuries","lineFacts":"movement sharp signal pricing"}`;
}

export function buildTennisStage2Prompt(game, stage1) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';
  return `You are a professional tennis bettor. Does a real betting edge exist in this match?

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home} | ${game.tournament || ''} | Surface: ${game.surface || 'N/A'} | Round: ${game.round || 'N/A'} | Slot: ${slot}
ML: P1 ${game.awayML || 'N/A'} / P2 ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} (P1 ${game.awaySpreadPrice || '-110'} / P2 ${game.homeSpreadPrice || '-110'})
Total: ${game.total || 'N/A'} (o${game.overPrice || '-110'} / u${game.underPrice || '-110'})

FACTS:
P1: ${stage1.awayFacts}
P2: ${stage1.homeFacts}
Recent Form: ${stage1.recentForm}
H2H + Surface: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Lines: ${stage1.lineFacts}

TENNIS-SPECIFIC EDGES:
SURFACE EDGE: Most important factor in tennis. Hard/Clay/Grass each favor different styles. A player dominating their best surface vs one playing outside comfort is a real edge.
FATIGUE: Long 3-set matches take physical and mental toll. Check days of rest and recent match lengths.
SERVE/RETURN DOMINANCE: Ace rate, first serve %, break point conversion — which player controls points?
RANKING vs FORM: Rankings lag reality. A lower-ranked player in better current form is often mispriced.
MENTAL STRENGTH: Tiebreak record, comeback ability, pressure performance. Some players fold, others thrive.
MOTIVATION: Tournament context — defending champion, ranking protection, home country crowd.
H2H ON THIS SURFACE: Overall H2H means less than surface-specific H2H in tennis.

${isVegas ? `VEGAS SLOT — find the scam: is a higher-ranked player overpriced on reputation? Is fatigue being ignored? Does the surface strongly favor the underdog?` : `PUBLIC SLOT: Go with the better player on this surface unless data contradicts.`}

PASS if: rankings and form are similar, surface edge is unclear, line looks fair.

Return JSON:
{"edgeExists":true or false,"edgeType":"SURFACE" or "FATIGUE" or "FORM" or "MATCHUP" or "PRICE" or "MENTAL" or "NONE","edgeSide":"${game.player1 || game.away}" or "${game.player2 || game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest argument against","counterValid":true or false,"passReason":"if passing why","propagandaCheck":"public narrative vs reality","confidence":"HIGH" or "MEDIUM" or "LOW"}`;
}

export function buildTennisStage3Prompt(game, stage1, stage2) {
  return `Edge identified. Pick the best market for this tennis match.

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home}
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
ML: P1 ${game.awayML || 'N/A'} / P2 ${game.homeML || 'N/A'}
SPREAD (Games): ${game.spread || 'N/A'} P1 ${game.awaySpreadPrice || '-110'} / P2 ${game.homeSpreadPrice || '-110'}
TOTAL (Games): ${game.total || 'N/A'} o${game.overPrice || '-110'} / u${game.underPrice || '-110'}

TENNIS MARKET LOGIC:
ML: Best when edge is clear on match winner. Good for outright dominance plays.
SPREAD (Game handicap): Best when one player should win decisively — take the favorite -games. Or take the underdog +games if they're competitive but unlikely to win outright.
TOTAL (Games): Best when match length is clearer than winner — two baseliners who play long rallies → OVER. A big server who ends points quickly → UNDER.

Pick where the edge is CLEAREST.

Return JSON:
{"selectedMarket":"ML" or "SPREAD" or "TOTAL","pick":"player name or OVER/UNDER","betType":"exact bet e.g. ML -125 or +4.5 -110 or OVER 22.5 -108","mlEvaluation":"why ML does or doesnt capture edge","spreadEvaluation":"why spread does or doesnt capture edge","totalEvaluation":"why total does or doesnt capture edge","marketReason":"why THIS market"}`;
}

export function buildTennisStage4Prompt(game, stage1, stage2, stage3) {
  const slot = game.slot || 'PUBLIC';
  return `Finalize the tennis pick. One clear sentence.

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home} | ${game.surface || ''} | ${game.round || ''} | Slot: ${slot}
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType}
WHY: ${stage3.marketReason}

TIER: HIGH + specific edge + counter doesn't hold = Tier 1. MEDIUM = Tier 2.
VERDICT example: "Alcaraz ML -140 — he's 8-1 on clay this season and Zverev has lost 4 of his last 5 on clay."

Return JSON:
{"summary":{"pick":"player or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"${slot}","confidence":"${stage2.confidence}","isScamPlay":${slot === 'VEGAS'},"verdict":"ONE plain sentence","signalCount":"X of 8","propagandaFade":false},"analysis":{"priceVsDataAudit":"line justified?","matchupFoundation":"who is better today","recentForm":"form for both","headToHead":"H2H and surface H2H","surfaceEdge":"who owns this surface","situational":"fatigue round motivation","trellRule":"N/A for tennis","sharpMoney":"sharp signal weight","propaganda":"public narrative vs reality","scamPlay":"${slot === 'VEGAS' ? 'where is the scam' : 'N/A'}","gameScript":"how this match plays out","marketLogic":"why this market","edgeStrength":"how strong is the edge"},"finalVerdict":"same as summary.verdict"}`;
}


// ═════════════════════════════════════════════════════════════════════════════
// WNBA ENGINE
// WNBA logic: shorter season, fatigue, roster depth, home court, pace
// ═════════════════════════════════════════════════════════════════════════════

export function buildWNBAStage1Prompt(game) {
  return `Summarize this WNBA game. No picks. Just facts. Return ONLY valid JSON.

${game.away} @ ${game.home} | WNBA | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} | Home ${game.homeRecord || 'N/A'}
Form: Away L5 ${game.awayLast5 || 'N/A'} L10 ${game.awayLast10 || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'} L10 ${game.homeLast10 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | Last at home: ${game.h2hAtHome || 'N/A'}
Injuries: ${game.injuries || 'None reported'}
Rest: Away ${game.awayRest || 'N/A'} days | Home ${game.homeRest || 'N/A'} days
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}

Return ONLY this JSON:
{"awayFacts":"3 key facts away team now","homeFacts":"3 key facts home team now","recentForm":"away L5 L10 AND home L5 L10 who is hot","headToHead":"overall H2H AND last at home venue","matchupFacts":"roster depth star player matchup pace","situationalFacts":"rest fatigue travel home court injuries","lineFacts":"movement sharp pricing"}`;
}

export function buildWNBAStage2Prompt(game, stage1) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';
  return `You are a professional WNBA bettor. Does a real edge exist?

GAME: ${game.away} @ ${game.home} | WNBA | Slot: ${slot}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} o${game.overPrice || '-110'} u${game.underPrice || '-110'}

FACTS:
Away: ${stage1.awayFacts}
Home: ${stage1.homeFacts}
Form: ${stage1.recentForm}
H2H: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Lines: ${stage1.lineFacts}

WNBA-SPECIFIC EDGES:
ROSTER DEPTH: WNBA rosters are small — one key injury significantly changes outcomes. Check who is out.
FATIGUE: Short season with frequent games. B2B or 3rd game in 4 nights is a real edge.
STAR PLAYER MATCHUP: Individual matchups matter more in WNBA than NBA. Does the star get a favorable matchup?
TRELL RULE: First game star OUT → bet ON that team. First game back → bet AGAINST.
HOME COURT: Home court advantage is strong in WNBA — crowd, familiarity, travel.
PACE: Fast-paced teams vs slow defensive teams create total edges.
LINE MOVEMENT: WNBA lines move sharply — sharp money here is very meaningful.

${isVegas ? `VEGAS SLOT — find the scam: roster gap the public ignores, fatigue, or star matchup the market mispriced.` : `PUBLIC SLOT: Go with the better team unless data contradicts.`}

PASS if: both teams similar, no meaningful edge in matchup or situation.

Return JSON:
{"edgeExists":true or false,"edgeType":"MATCHUP" or "FATIGUE" or "ROSTER" or "STAR" or "TRELL" or "PRICE" or "SITUATIONAL" or "NONE","edgeSide":"${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest counter","counterValid":true or false,"passReason":"if passing why","propagandaCheck":"public narrative vs reality","confidence":"HIGH" or "MEDIUM" or "LOW"}`;
}

export function buildWNBAStage3Prompt(game, stage1, stage2) {
  return `Edge identified. Pick the best market.

GAME: ${game.away} @ ${game.home} | WNBA
EDGE: ${stage2.edgeReason} | SIDE: ${stage2.edgeSide}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} o${game.overPrice || '-110'} u${game.underPrice || '-110'}

ML: Best for confident outright winner. Good for underdog plays when edge is strong.
SPREAD: Best when one team expected to dominate. Underdog +ATS when competitive but likely to lose close.
TOTAL: Best when pace and defensive matchup clearly points to scoring direction. WNBA unders hit well in defensive matchups.

Return JSON:
{"selectedMarket":"ML" or "SPREAD" or "TOTAL","pick":"team name or OVER/UNDER","betType":"exact bet","mlEvaluation":"why ML does or doesnt work","spreadEvaluation":"why spread does or doesnt work","totalEvaluation":"why total does or doesnt work","marketReason":"why THIS market"}`;
}

export function buildWNBAStage4Prompt(game, stage1, stage2, stage3) {
  const slot = game.slot || 'PUBLIC';
  return `Finalize the WNBA pick. One clear sentence.

GAME: ${game.away} @ ${game.home} | WNBA | Slot: ${slot}
EDGE: ${stage2.edgeReason} | COUNTER: ${stage2.counterArgument} Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType} | WHY: ${stage3.marketReason}

Return JSON:
{"summary":{"pick":"team or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"${slot}","confidence":"${stage2.confidence}","isScamPlay":${slot === 'VEGAS'},"verdict":"ONE plain sentence — pick and strongest reason","signalCount":"X of 8","propagandaFade":false},"analysis":{"priceVsDataAudit":"line justified?","matchupFoundation":"who is better today","recentForm":"both teams form","headToHead":"H2H and home venue","rosterDepth":"key roster and injury impact","situational":"rest fatigue home court","trellRule":"active or inactive","sharpMoney":"sharp signal weight","propaganda":"narrative vs reality","scamPlay":"${slot === 'VEGAS' ? 'where is the scam' : 'N/A'}","gameScript":"how game plays out","marketLogic":"why this market","edgeStrength":"edge strength"},"finalVerdict":"same as summary.verdict"}`;
}
