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

  return `You are a professional MLB bettor. Analyze this game using the data provided.

GAME: ${game.away} @ ${game.home} | Slot: ${slot}
Opening ML: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'}
Current ML: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
Run Line: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice || '-110'} / Home ${game.spread || '-1.5'} ${game.homeSpreadPrice || '-110'}
Total: Over ${game.total || 'N/A'} ${game.overPrice || '-110'} / Under ${game.total || 'N/A'} ${game.underPrice || '-110'}

DATA:
Away: ${stage1Data.awayFacts}
Home: ${stage1Data.homeFacts}
Recent Form: ${stage1Data.recentForm}
H2H (including last time at this home venue — go back to past seasons if needed): ${stage1Data.headToHead}
Pitching: ${stage1Data.pitchingFacts}
Hitter/Lineup: ${stage1Data.hitterLineup || 'N/A'}
Series Context: ${stage1Data.seriesContext || 'N/A'}. MANDATORY: Use your knowledge to state the actual game number in this series and series record.
Injuries: ${stage1Data.injuries || 'None'}
Weather: ${stage1Data.weather || 'N/A'} | Umpire: ${stage1Data.umpire || 'N/A'}
Situation: ${stage1Data.situationalFacts}
Lines: ${stage1Data.lineFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLOT RULES — THIS IS BLACK AND WHITE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${isVegas ? `VEGAS SLOT — YOU ARE LOOKING FOR THE SCAM.
The scam is the OPPOSITE of what is supposed to happen. The public expects one outcome — your job is to find where that expectation is WRONG and bet against it.

The scam can be on the public side too — sometimes everyone fading the public IS the trap and the public is actually right. The scam is wherever the MISPRICING is.

WORK THROUGH EVERY LAYER IN ORDER:

1. PITCHING SCAM:
- In a Vegas slot, expect good pitchers to NOT perform as expected. The ace on the mound is often a trap — public hammers him, line inflates, real edge is on the other side.
- Is the ace overpriced based on reputation vs current form? Check his last 3-5 starts specifically.
- Does this lineup match up poorly against his style and approach? Pitcher style vs lineup tendencies matters more than ERA.
- Is the "weak" starter actually the right side? Has he dominated this lineup historically or been quietly throwing well?
- BUT: if the data genuinely supports the ace, that can be the scam too — everyone fading him when he's actually right.

2. ML SCAM: Is the ML a public trap? If everyone is on one side and the price is inflated, the scam is the other side.

3. RUN LINE SCAM: If ML is clearly the public side, is the scam on the run line? Underdog +1.5 at near-even money when public is hammering the favorite ML?

4. TOTAL SCAM: Is the over/under being driven by offensive reputation while pitching, weather, park, or umpire tells a different story?

5. FORM SCAM: Hot team in a regression spot. Cold team about to bounce. Blowout yesterday means nothing today.

6. PROPAGANDA SCAM: What is the media narrative? That narrative is inflating one side. The scam is the side everyone is ignoring.

7. SITUATIONAL SCAM: Series finale urgency, revenge game, letdown spot, travel/fatigue, bullpen fatigue.

FIND THE SCAM. BET IT.` : `PUBLIC SLOT — EXPECTED OUTCOME, BUT SCAMS EXIST HERE TOO.
The public slot leans toward the expected outcome — but do NOT be naive. Scams exist in public slots. The difference is you are not actively hunting for the opposite. You are letting the data lead you.

PUBLIC SLOT RULES:
- Start by identifying the expected outcome (better pitcher, better team, better form, home field etc.)
- Back the expected outcome IF all the data supports it AND the price is fair
- BUT: scan every factor carefully. A scam can hide in a public slot too.
  - Is the favorite overpriced relative to what the data actually shows?
  - Is the "weaker" team quietly better positioned for today specifically?
  - Is the public hammering one side so hard that the line has moved past fair value?
  - Does the pitching matchup, bullpen, injuries, weather, or H2H tell a different story than the headline says?
- If you find a scam in a public slot — BET IT. The slot type does not prevent a scam from existing.
- If the expected outcome is genuinely supported by ALL the information AND the price is fair → back it confidently.
- ALWAYS compare price to information. A good team at -200 might still be the wrong bet if the price is too high for what the data supports.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MLB KEY FACTORS — EVALUATE ALL OF THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PITCHER ANALYSIS (most important in MLB):
- Starting pitcher stats: ERA, WHIP, K/9, recent form (last 3-5 starts), season record
- Pitcher vs THIS opponent: recent matchups AND historical. How has he performed against this lineup specifically?
- Pitcher vs pitcher: who has the edge today — not on paper, but right now in current form?
- Pitch style vs lineup tendencies: fly-ball pitcher in a hitter's park? Groundball pitcher vs contact lineup?
- The better pitcher does NOT always win — especially in Vegas slots. Evaluate matchup over reputation.

BULLPEN:
- How well does each team's bullpen perform against this opponent?
- Was either bullpen taxed yesterday (3+ relievers used)?
- Which team can hold a late lead?

BATTERS & LINEUP:
- Key hitters in form vs this pitcher — check recent at-bats and historical splits
- Platoon advantages (LHP vs RHH, RHP vs LHH)
- Who is hot, who is cold, who is missing?

TEAM RECORDS (compare all three):
- Overall record
- Home/Away record specifically
- ATS (against the spread) record — does this team cover or fade?

RECENT FORM:
- Last 3-5 games: what happened specifically? Close losses or blowouts?
- Last 10 games: trend — is this team rising or falling?
- Win/loss streaks and run differential

H2H — HEAD TO HEAD:
- Last 5-10 matchups overall
- SPECIFICALLY: last time these teams played at THIS home venue — what was the outcome and what happened? Go back to past seasons if needed.
- Margin of victory in recent meetings

SITUATIONAL:
- Fatigue: back-to-back, travel, third game in four nights
- Series context: where are we in the series? Who has momentum?
- Series finale: public bets the series leader, scam is usually the desperate team
- Weather: wind direction and speed, temperature, precipitation
- Umpire: does this umpire favor pitchers or hitters? Strike zone tendency?
- Injuries: who is missing and does it matter for today specifically?

PRICE VS DATA:
- Compare the line to what you found. Is this price fair, overpriced, or underpriced?
- ALWAYS compare price to information before finalizing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE ALL THE INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL the information you collected matters — not just pitching, not just form, not just one thing. The play comes from the COMBINATION of everything:

- Pitching + bullpen + lineup + records + form + H2H + situational + weather + umpire + injuries + price = the full picture
- No single factor overrides everything else. A great pitcher still loses if his bullpen blows it, his team is fatigued, weather neutralizes his advantage, and the price is inflated.
- The PRICE is always the final filter. Even if everything points one way, if the price doesn't offer value — pass or find a better market expression.
- Consistency wins. Simple, well-supported plays beat complicated single-factor picks every time.
- If no clear edge exists after evaluating EVERYTHING → PASS. But if the data genuinely lines up — multiple factors pointing the same direction at a fair price — back it with the confidence the data supports. Don't talk yourself out of a play that's actually there.
- Keep it simple. Overanalyzing causes losing plays. The clearest edge, supported by multiple factors, at the right price = the play.

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "PITCHING" or "BULLPEN" or "LINEUP" or "FORM" or "H2H" or "SITUATIONAL" or "PRICE" or "WEATHER" or "UMPIRE" or "SCAM" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence stating exactly what the edge is",
  "counterArgument": "Strongest argument against this pick",
  "counterValid": true or false,
  "passReason": "If passing — exactly why no edge exists",
  "propagandaCheck": "What is the public narrative and is it supported by data?",
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (PITCHING/ML/RUN_LINE/TOTAL/FORM/PROPAGANDA/SITUATIONAL)' : 'N/A'}",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 reflecting your actual certainty in this edge — not tied to fixed brackets. Two HIGH-confidence plays can differ (e.g. 78 vs 95) based on how strong the signals actually are. Be honest and specific, not round numbers like 70/80/90 by default.
}`;
}


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
SAFER PLAY PRINCIPLE — APPLY BEFORE FINALIZING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before committing to any play, ask: is there a safer version of this bet that captures the same edge with less risk?

UNDERDOG PLAYS:
- Default to +1.5 run line / +ATS spread BEFORE taking ML
- Only take underdog ML if the edge is strong enough that you genuinely expect them to win outright
- +1.5 at -130 beats +ML at +140 if the team might lose by 1

FAVORITE PLAYS:
- If the favorite is -180 or higher, consider whether -1.5 at a lower price captures the same edge more efficiently
- A -180 ML and a -1.5 at -110 — if the data shows dominance, -1.5 is the better play
- Only take heavy ML favorites when the game script suggests a close competitive game where -1.5 is too risky

TOTALS:
- If the directional edge is strong but the side is unclear, the total is the safer play
- Don't force a side when the cleaner edge is over/under

GENERAL RULE:
- Clear edge + right market = take it confidently
- Marginal edge = take the safer market version every time
- Never take a riskier play (higher juice, ML over spread) unless the data clearly justifies it
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
    "confidencePercent": ${stage2Data.confidencePercent ?? 'null'},
    "scamLayer": ${stage2Data.scamLayer ? `"${stage2Data.scamLayer}"` : 'null'},
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
    "pitching": "Pitching matchup summary. The vs-opponent data provided is already aggregated across the pitcher's last 6 seasons (career-spanning, not season-only) — trust it. A genuine 0-start result is real (young pitcher, recent call-up, true first meeting) and should be stated plainly, not assumed to be missing data. Only flag it as possibly incomplete if something else suggests otherwise (e.g. a long-tenured veteran against a frequent divisional opponent).",
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

CRITICAL: If the playoff/series context above looks incomplete, contradictory, or shows invalid records (0-10, N/A), do not assume the data is correct by default — use your knowledge of the current NBA season and playoff bracket, and if you're not confident which round or series this is, say so rather than inventing a series record.

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

${isVegas ? `VEGAS SLOT — FIND WHERE THE SCAM IS HIDING. CHECK EVERY LAYER:

1. ML SCAM: Is the ML a public trap? Big market team (Lakers, Celtics, Knicks) overpriced on brand? If ML is the obvious public side, skip it and look deeper.

2. SPREAD SCAM: If ML is public, is the scam on the spread? Favorite expected to win but not by the margin priced? Underdog +ATS at live number? If spread also looks public, check the total.

3. TOTAL SCAM: Is the over/under being driven by offensive reputation vs today's defensive matchup? Playoff intensity suppressing scoring the public ignores? Pace mismatch creating a scoring edge?

4. FATIGUE/REST SCAM: B2B team the public ignores. Star player with heavy minutes last game. Road team on 4th game in 6 nights. This is consistently underpriced by the public.

5. MATCHUP REALITY SCAM: Is the "better team" actually better TODAY in this specific matchup? Scheme mismatches, missing defenders, hot role players the public misses?

6. SERIES/DESPERATION SCAM: Desperate team down in series vs complacent leader. Elimination game intensity vs team already thinking about next round.

7. PROPAGANDA SCAM: Media narrative inflating one side. Last game's big performance driving money. Big name player coverage hiding a team that's actually struggling.

When you find the scam — BET IT. NOTE: sometimes the scam IS on the public side — the public is right but everyone thinks they're wrong. If the data supports the public side, take it confidently. The scam is the mispricing, not automatically the fade. State WHERE the scam is, whether it is WITH or AGAINST the public, and WHAT the bet is.` : `PUBLIC SLOT: Go with the better team. Still scan for fatigue, matchup, and narrative scams.`}

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
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/FORM/PROPAGANDA/SITUATIONAL/PLAYOFF_CONTEXT)' : 'N/A'}",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 reflecting your actual certainty in this edge — not tied to fixed brackets. Two HIGH-confidence plays can differ (e.g. 78 vs 95) based on how strong the signals actually are. Be honest and specific, not round numbers like 70/80/90 by default.
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

SAFER PLAY FIRST: Underdog → default to +ATS before ML. Heavy favorite → consider spread over ML. Unclear side → total may be safer. Clear edge = take it. Marginal edge = always take the safer market.

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
    "confidencePercent": ${stage2.confidencePercent ?? 'null'},
    "scamLayer": ${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},
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

${isVegas ? `VEGAS SLOT — FIND WHERE THE SCAM IS HIDING. CHECK EVERY LAYER:

1. ML SCAM: Is the ML a public trap? Marquee team overpriced on brand or narrative? If ML is the obvious public side, look deeper.

2. SPREAD SCAM: If ML is public, is the scam on the spread? Underdog covering even in a loss? Key number positioning (-3, -7, -10)? Favorite priced to win big but scheme says otherwise?

3. TOTAL SCAM: Weather the public ignored (wind, cold, rain). Defensive scheme mismatch. Short week fatigue suppressing offense. Divisional game — these run lower than expected.

4. QB SCAM: QB reputation vs current form. Banged up QB still priced like elite. Backup QB the market overreacted to. Defense that specifically neutralizes this QB's strengths.

5. INJURY SCAM: Key injury the public glossed over in the report. O-line injuries that don't make headlines but destroy the run game. Top CB out making a wide receiver suddenly relevant.

6. SITUATIONAL SCAM: Letdown spot after emotional win. Divisional dog — they always keep it close. Short week disadvantage. Team with nothing to play for vs team desperate for playoff positioning.

7. PROPAGANDA SCAM: National TV narrative inflating one side. Last week's blowout driving money. "Hot team" label applied to a team that benefited from weak schedule.

When you find the scam — BET IT. NOTE: sometimes the scam IS on the public side — everyone fading the public creates value ON the public side when the data supports them. The scam is wherever the mispricing is. State WHERE the scam is, whether it is WITH or AGAINST the public, and WHAT the bet is.` : `PUBLIC SLOT: Go with the better team. Still scan for QB, injury, weather, and situational scams.`}

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
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/FORM/PROPAGANDA/SITUATIONAL/WEATHER)' : 'N/A'}",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 reflecting your actual certainty in this edge — not tied to fixed brackets. Two HIGH-confidence plays can differ (e.g. 78 vs 95) based on how strong the signals actually are. Be honest and specific, not round numbers like 70/80/90 by default.
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
    "confidencePercent": ${stage2.confidencePercent ?? 'null'},
    "scamLayer": ${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},
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

${isVegas ? `VEGAS SLOT — FIND THE SCAM AND BET IT. Hunt every layer: Higher-ranked player overpriced on reputation vs current form? BET the lower-ranked player. Favorite not expected to dominate? BET the spread. Surface edge the public missed? BET the player who owns this surface. Fatigue from long match yesterday? BET the rested player at value. Media favorite vs player quietly in better form? BET the overlooked one. When you find it — BET IT. Remember: sometimes the scam IS the public side — the data supports the public but everyone fading them creates value. Take whichever side the data supports. State WHERE the scam is and WHAT the bet is.` : `PUBLIC SLOT: Go with the better player on this surface unless data contradicts.`}

PASS if: rankings and form are similar, surface edge is unclear, line looks fair.

Return JSON:
{"edgeExists":true or false,"edgeType":"SURFACE" or "FATIGUE" or "FORM" or "MATCHUP" or "PRICE" or "MENTAL" or "NONE","edgeSide":"${game.player1 || game.away}" or "${game.player2 || game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest argument against","counterValid":true or false,"passReason":"if passing why","propagandaCheck":"public narrative vs reality","scamLayer":"${isVegas ? 'Which layer the scam was found in (SURFACE/FATIGUE/FORM/MATCHUP/PRICE/MENTAL)' : 'N/A'}","confidence":"HIGH" or "MEDIUM" or "LOW","confidencePercent":"A number 0-100 reflecting your actual certainty, not tied to fixed brackets - be honest and specific"}`;
}

export function buildTennisStage3Prompt(game, stage1, stage2) {
  return `Edge identified. Pick the best market for this tennis match.

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home}
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
ML: P1 ${game.awayML || 'N/A'} / P2 ${game.homeML || 'N/A'}
SPREAD (Games): ${game.spread || 'N/A'} P1 ${game.awaySpreadPrice || '-110'} / P2 ${game.homeSpreadPrice || '-110'}
TOTAL (Games): ${game.total || 'N/A'} o${game.overPrice || '-110'} / u${game.underPrice || '-110'}
CRITICAL: These are the exact current prices. Factor actual juice when picking market — -105 vs -130 on the same line is a meaningful value difference.

TENNIS MARKET LOGIC:
ML: Best when edge is clear on match winner. Good for outright dominance plays.
SPREAD (Game handicap): Best when one player should win decisively — take the favorite -games. Or take the underdog +games if they're competitive but unlikely to win outright.
TOTAL (Games): Best when match length is clearer than winner — two baseliners who play long rallies → OVER. A big server who ends points quickly → UNDER.

Pick where the edge is CLEAREST.

SAFER PLAY FIRST: Before finalizing, ask if there is a safer version of this bet.
- Underdog: default to +ATS/+1.5 before ML unless outright win is clearly expected
- Favorite: if -180 or heavier, consider whether spread/-1.5 at better price captures same edge
- Unclear side: total may be the safer expression of the edge
- Clear edge = take it. Marginal edge = always take the safer market.

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
{"summary":{"pick":"player or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"${slot}","confidence":"${stage2.confidence}","confidencePercent":${stage2.confidencePercent ?? 'null'},"scamLayer":${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},"isScamPlay":${slot === 'VEGAS'},"verdict":"ONE plain sentence","signalCount":"X of 8","propagandaFade":false},"analysis":{"priceVsDataAudit":"line justified?","matchupFoundation":"who is better today","recentForm":"form for both","headToHead":"H2H and surface H2H","surfaceEdge":"who owns this surface","situational":"fatigue round motivation","trellRule":"N/A for tennis","sharpMoney":"sharp signal weight","propaganda":"public narrative vs reality","scamPlay":"${slot === 'VEGAS' ? 'where is the scam' : 'N/A'}","gameScript":"how this match plays out","marketLogic":"why this market","edgeStrength":"how strong is the edge"},"finalVerdict":"same as summary.verdict"}`;
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

${isVegas ? `VEGAS SLOT — FIND THE SCAM AND BET IT. Hunt every layer: ML inflated on reputation? BET the other side. Spread — underdog live to cover? BET the points. Total — pace or defense creating an edge? BET that direction. Roster injury the public missed? BET against the affected team. Fatigue — B2B team undervalued? BET the rested side. Star matchup edge? BET the team that benefits. When you find it — BET IT. Remember: sometimes the scam IS the public side — the public is right but everyone fading them creates value. Take whichever side the data supports. State WHERE the scam is and WHAT the bet is.` : `PUBLIC SLOT: Go with the better team unless data contradicts.`}

PASS if: both teams similar, no meaningful edge in matchup or situation.

Return JSON:
{"edgeExists":true or false,"edgeType":"MATCHUP" or "FATIGUE" or "ROSTER" or "STAR" or "TRELL" or "PRICE" or "SITUATIONAL" or "NONE","edgeSide":"${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest counter","counterValid":true or false,"passReason":"if passing why","propagandaCheck":"public narrative vs reality","scamLayer":"${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/ROSTER/PROPAGANDA/SITUATIONAL)' : 'N/A'}","confidence":"HIGH" or "MEDIUM" or "LOW","confidencePercent":"A number 0-100 reflecting your actual certainty, not tied to fixed brackets - be honest and specific"}`;
}

export function buildWNBAStage3Prompt(game, stage1, stage2) {
  return `Edge identified. Pick the best market.

GAME: ${game.away} @ ${game.home} | WNBA
EDGE: ${stage2.edgeReason} | SIDE: ${stage2.edgeSide}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} o${game.overPrice || '-110'} u${game.underPrice || '-110'}
CRITICAL: These are the exact current prices. Factor actual juice when picking market — -105 vs -130 on the same line is a meaningful value difference.

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
{"summary":{"pick":"team or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"${slot}","confidence":"${stage2.confidence}","confidencePercent":${stage2.confidencePercent ?? 'null'},"scamLayer":${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},"isScamPlay":${slot === 'VEGAS'},"verdict":"ONE plain sentence — pick and strongest reason","signalCount":"X of 8","propagandaFade":false},"analysis":{"priceVsDataAudit":"line justified?","matchupFoundation":"who is better today","recentForm":"both teams form","headToHead":"H2H and home venue","rosterDepth":"key roster and injury impact","situational":"rest fatigue home court","trellRule":"active or inactive","sharpMoney":"sharp signal weight","propaganda":"narrative vs reality","scamPlay":"${slot === 'VEGAS' ? 'where is the scam' : 'N/A'}","gameScript":"how game plays out","marketLogic":"why this market","edgeStrength":"edge strength"},"finalVerdict":"same as summary.verdict"}`;
}
