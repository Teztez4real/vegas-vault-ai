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

// ── PUBLIC NARRATIVE vs PROPAGANDA — TWO DIFFERENT THINGS, NEVER CONFLATE ──────
// This is injected into every sport's Stage 2. The single most important rule
// here: these are NOT the same concept and must never be blended into one
// vague "what's the narrative" answer. They are analyzed separately because
// they mean different things and imply different actions.
const NARRATIVE_VS_PROPAGANDA = `
TWO SEPARATE CONCEPTS — DO NOT MIX THEM. Analyze each on its own:

━━ CONCEPT 1: PUBLIC NARRATIVE (context, NOT a signal by itself) ━━
This is simply what the general betting public broadly believes about this game —
which side is "obviously" better, who the popular/casual money is on, the common
take you'd hear from average fans. This is CONTEXT. It is NOT automatically a
reason to bet either direction. The public is often right on favorites. Do not
treat "the public likes Team A" as a fade signal on its own — that's a rookie
mistake. Public narrative only becomes actionable when combined with something
else (a price that's inflated BECAUSE of it, or actual propaganda — see below).
State the public narrative plainly, then set it aside unless it connects to a
real edge.

━━ CONCEPT 2: PROPAGANDA (a real, directional signal when present) ━━
Propaganda is a SPECIFIC, IDENTIFIABLE media/broadcast storyline where the
NARRATIVE OUTRUNS THE REALITY — the story is doing more work than the actual
evidence for THIS specific game supports. This is NOT the same as "what the
public thinks." It is a specific narrative artifact you can point to (a headline,
a broadcast talking point, a repeated stat framed to tell a story). When you find
real propaganda, it carries a directional betting implication. Propaganda comes
in TWO OPPOSITE POLARITIES — you must identify WHICH one you're looking at,
because they point in opposite directions:

  ▸ POLARITY A — IRRATIONAL HYPE (fade the hyped side):
    Media is OVERSELLING a team/player — glowing superlatives on a thin sample
    ("nearly flawless in two starts," "looks like his old self," hot-rookie
    "future star" framing, revenge-game hype, a small hot streak treated as
    proof). The story inflates one side beyond what the evidence supports.
    → ACTION: fade the hyped side. Back the OPPONENT. (~9/10 the opponent wins.)

  ▸ POLARITY B — IRRATIONAL PILE-ON (back the maligned side):
    Media is PILING NEGATIVITY onto a team/player unfairly — running a "look how
    bad they've been" storyline that outruns the real matchup. Classic form: a
    strong player/team on a rough stretch getting a relentless negative headline
    ("hasn't won as a starter since May 12," "0-6 in his last starts," "ice cold")
    while the UNDERLYING matchup edge for tonight is actually still in their favor.
    → ACTION: back the maligned side (the team getting the negative pile-on),
      NOT the opponent. The negativity is the propaganda; the maligned team's
      real edge is being obscured by the story. (~9/10 that maligned team wins.)

  CANONICAL POLARITY-B EXAMPLE (this is the pattern to internalize):
  Pirates vs Braves. Paul Skenes is on an unexpected personal losing streak
  (0-6 after starting 6-2), and the media is all over it — "Skenes hasn't won as
  a starter since May 12" is the headline everywhere. That is PROPAGANDA of the
  pile-on type: it's a negative story outrunning reality, because despite the
  win-loss noise, Skenes STILL holds the actual pitching-matchup advantage in
  this game. The correct read is to BACK SKENES' TEAM (Pirates), not fade them.
  Supporting alignment for that read in this example: Pirates on a 2-game win
  streak, Braves on a 2-game skid; Braves fatigued off an extra-innings loss
  while Pirates were rested; and last meeting at Pittsburgh the Pirates won even
  as underdogs — now they're favored. Everything pointed the same way once the
  negative Skenes story was correctly identified as propaganda rather than a
  real red flag. Correct play: PIRATES ML.

  THE KEY DISCIPLINE: when you see a negative story about a strong team/player,
  do NOT reflexively fade them along with the media. Ask: is the underlying
  matchup edge for THIS game still theirs despite the story? If yes, the story
  is pile-on propaganda and you back them. Only fade a side when the propaganda
  is HYPE inflating them beyond the evidence (Polarity A).

REQUIRED OUTPUT: address BOTH concepts separately and explicitly. First state
the public narrative (and whether it's just context or connects to a real edge).
Then, separately, state whether real propaganda exists — and if so, name the
specific storyline, classify it as Polarity A (hype→fade) or Polarity B
(pile-on→back the maligned side), and give the directional implication. If there
is no real propaganda, say so plainly — do NOT manufacture it, and do NOT relabel
ordinary public narrative as "propaganda." Most games have a public narrative;
only SOME games have real propaganda.
`;

// ── SHARED ALIGNMENT CHECK — inserted into EVERY sport's Stage 2 ──────────────
// This is non-negotiable and sport-agnostic. Some signals (park factor, bullpen)
// only apply to certain sports — the AI skips inapplicable ones but must run
// all relevant checks for the sport being analyzed.
const ALIGNMENT_CHECK = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY SIGNAL ALIGNMENT CHECK — EVERY SPORT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finalizing ANY pick, run this alignment check. For each signal, determine whether it SUPPORTS (✅), CONTRADICTS (🚩), or is NEUTRAL (➖) toward your proposed pick direction. Anything that doesn't align is a RED FLAG.

THIS IS NON-NEGOTIABLE: A pick with multiple red flags is either wrong or hiding a scam. Resolve every red flag before finalizing. If you can't, PASS or flip sides.

CHECK EACH SIGNAL AGAINST YOUR PICK DIRECTION:

1. LINE MOVEMENT — Does the DraftKings line movement confirm your pick?
   ✅ Line moved toward your pick (sharps agree with your read)
   🚩 RED FLAG: Line moved AWAY from your pick — sharps are on the other side. Explain why they're wrong or reconsider.
   🚩 RED FLAG: Steam or sharp signal pointing opposite to your pick.

2. PRICING — Is the price consistent with what the data actually shows?
   ✅ Price is fair or undervalued for the edge you've identified
   🚩 RED FLAG: Pick team is heavily juiced but your data only shows a moderate edge
   🚩 RED FLAG: Better value clearly exists on the other side at the current number

3. PUBLIC NARRATIVE / STORYLINE — Does the story match or contradict the data?
   ✅ Public is on the same side and data genuinely supports them
   ✅ Public is on the OTHER side but your data contradicts the narrative (scam setup)
   🚩 RED FLAG: You're picking WITH the public at inflated juice without clear data superiority
   🚩 RED FLAG: The storyline sounds compelling but the actual numbers don't back it up

4. RECENT FORM — Does current form (L5/L10) support the pick direction?
   ✅ Pick team trending up, opponent trending down
   🚩 RED FLAG: Pick team is cold, opponent is hot, and no clear reason to fade the trend
   🚩 RED FLAG: Pick team's recent wins came against weak opponents

5. HEAD-TO-HEAD — Does H2H history (especially at this venue) support the pick?
   ✅ Pick team has a demonstrated edge in this matchup historically
   🚩 RED FLAG: H2H consistently favors the OTHER team — that's real signal, not noise
   ➖ Small H2H sample with no clear pattern

6. MATCHUP / TALENT EDGE — Does the deeper matchup analysis support the pick?
   (For MLB: pitching, pitch mix, bullpen. For NBA: pace, defense, injury impact. For NFL: scheme, line play. For Tennis: surface, style matchup.)
   ✅ Pick team has a genuine matchup advantage for TODAY specifically
   🚩 RED FLAG: Matchup analysis actually favors the other team despite the surface narrative
   🚩 RED FLAG: Key advantage you're relying on is neutralized by injury, fatigue, or opponent adjustment

7. SITUATIONAL / MOTIVATION — Does the situational context support the pick?
   ✅ Pick team has clear motivation, urgency, or favorable scheduling
   🚩 RED FLAG: Pick team is in a letdown spot, fatigue situation, or faces a desperate opponent
   🚩 RED FLAG: Series finale regression, revenge game for opponent, or back-to-back disadvantage

8. INJURIES / AVAILABILITY — Do player availability facts support the pick?
   ✅ Key injuries favor your pick team's side
   🚩 RED FLAG: Star player is OUT for pick team and this isn't priced in (Trell Rule applies)
   🚩 RED FLAG: Trell Rule return game — first game back for star contradicts your pick direction

9. ENVIRONMENTAL FACTORS — Does the run environment / pace / conditions align? (sport-specific)
   For MLB: park factor, weather, umpire vs total pick
   For NBA/WNBA: pace of play, tempo matchup vs total pick
   For NFL: weather, dome/outdoor, grass/turf vs total
   For Tennis: surface, conditions vs style matchup pick
   🚩 RED FLAG: Environmental factors clearly lean opposite to your bet direction

10. PRICE VS INFORMATION AUDIT — Final check before committing.
    🚩 RED FLAG: You're taking -180 or heavier on a play where your own data shows only a moderate edge
    🚩 RED FLAG: The line has moved to a point where the value is gone even if your read is correct
    🚩 RED FLAG: A cheaper/safer market expression of the same edge exists that you're ignoring

WHAT TO DO WITH RED FLAGS:
- 0–1 red flags, 3+ green flags → proceed confidently
- 2 red flags → explain each. If resolved, proceed as Tier 2. If not, reconsider.
- 3+ red flags → pick is likely WRONG or a SCAM hides here. Investigate. If unresolved → PASS.
- 1 CRITICAL red flag (steam against pick, key injury, Trell Rule trigger) → treat as 3 automatically.

THE ALIGNMENT PRINCIPLE: The strongest plays have everything pointing the same direction. When signals conflict, the conflict IS the information — either the conflict reveals a scam, or it means the pick is wrong. Never ignore a red flag. Name it, explain it, or reverse the pick.

THE PRICE PRINCIPLE: The answer is in the line. The current price is the single most information-dense piece of evidence in front of you — the market has already synthesized public perception, sharp money, injuries, and situational context into one number. Your job is not to describe that number, it's to EXPLAIN it. Every analysis must answer three things, explicitly:
1. WHY is the price set at this exact number? What does the market believe about this matchup, and does the underlying data actually support that belief?
2. If the line has moved, WHY is money flowing toward one side and away from the other? What changed, and does that direction of movement actually make sense given everything else you know?
3. Does the price DOES or DOES NOT make sense for this specific matchup? Render an explicit verdict — fair, mispriced, or exactly right — don't just restate the number and move on.
If you can't articulate WHY a price is what it is, you don't actually understand the market yet. A pick without a real answer to "why is the line here" is not a finished analysis.
${NARRATIVE_VS_PROPAGANDA}
`;


// ── SHARED JSON FIELDS for Stage 2 alignment output ───────────────────────────
const ALIGNMENT_JSON_FIELDS = `  "redFlags": ["Every specific signal that contradicts the pick — e.g. 'Line moved 12pts away from pick team', 'xFIP 4.2 vs 2.8 ERA — regression risk', 'H2H at this venue 2-7 for pick team'"],
  "greenFlags": ["Every specific signal confirming the pick — e.g. 'Sharp money confirms direction (DK moved 14pts toward pick)', 'H2H 7-2 at this venue', 'Bullpen fresh vs opponent taxed'],
  "alignmentScore": "X/10 signals align — honest count, not optimistic. e.g. '7/10 align, 2 red flags (line movement against, park factor neutral-to-against) — red flags explained by public overreaction to yesterday's blowout'",`;

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1: DATA SUMMARY
// Just lay out the facts. No picks. No lean. No analysis.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage1Prompt(game) {
  const sport = game.sport || 'MLB';
  const isMLB = sport === 'MLB';

  // Build advanced pitcher lines for MLB
  const awayAdvanced = isMLB && (game.awayPitcherXFIP || game.awayPitcherSIERA) ? [
    game.awayPitcherXFIP  ? `xFIP ${game.awayPitcherXFIP}`   : '',
    game.awayPitcherSIERA ? `SIERA ${game.awayPitcherSIERA}` : '',
    game.awayPitcherFIP   ? `FIP ${game.awayPitcherFIP}`     : '',
    game.awayPitcherKPct  ? `K% ${game.awayPitcherKPct}`     : '',
    game.awayPitcherBBPct ? `BB% ${game.awayPitcherBBPct}`   : '',
    game.awayPitcherHRFB  ? `HR/FB ${game.awayPitcherHRFB}`  : '',
  ].filter(Boolean).join(' | ') : null;

  const homeAdvanced = isMLB && (game.homePitcherXFIP || game.homePitcherSIERA) ? [
    game.homePitcherXFIP  ? `xFIP ${game.homePitcherXFIP}`   : '',
    game.homePitcherSIERA ? `SIERA ${game.homePitcherSIERA}` : '',
    game.homePitcherFIP   ? `FIP ${game.homePitcherFIP}`     : '',
    game.homePitcherKPct  ? `K% ${game.homePitcherKPct}`     : '',
    game.homePitcherBBPct ? `BB% ${game.homePitcherBBPct}`   : '',
    game.homePitcherHRFB  ? `HR/FB ${game.homePitcherHRFB}`  : '',
  ].filter(Boolean).join(' | ') : null;

  return `Summarize this ${sport} game. No picks. Just facts. Return ONLY valid JSON.

${game.away} @ ${game.home} | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} | Home ${game.homeRecord || 'N/A'}
Form: Away L5 ${game.awayLast5 || 'N/A'} L10 ${game.awayLast10 || 'N/A'} streak ${game.awayStreak || 'N/A'}
Form: Home L5 ${game.homeLast5 || 'N/A'} L10 ${game.homeLast10 || 'N/A'} streak ${game.homeStreak || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'} | Last at home venue: ${game.h2hAtHome || 'N/A'}
Away Pitcher: ${game.awayPitcher || 'TBD'} | ${game.awayPitcherStats || 'N/A'}${awayAdvanced ? ` | Advanced: ${awayAdvanced}` : ''}
Away Pitcher vs ${game.home}: ${game.awayPitcherVsOpponent || 'N/A'}
Away Pitch Mix: ${game.awayPitchMix || 'N/A'}
Home Pitcher: ${game.homePitcher || 'TBD'} | ${game.homePitcherStats || 'N/A'}${homeAdvanced ? ` | Advanced: ${homeAdvanced}` : ''}
Home Pitcher vs ${game.away}: ${game.homePitcherVsOpponent || 'N/A'}
Home Pitch Mix: ${game.homePitchMix || 'N/A'}
Away Bullpen Usage (last 3 days): ${game.awayBullpenUsage || 'N/A'}
Home Bullpen Usage (last 3 days): ${game.homeBullpenUsage || 'N/A'}
Injuries: ${game.injuries || 'None reported'} | Weather: ${game.weather || 'N/A'} | Umpire: ${game.umpire || 'N/A'}
Park Factor: ${game.parkFactor || 1.0} — ${game.parkFactorNote || 'Neutral'}
Opening ML: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'}
Current ML: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
Run Line: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice || '-110'} / Home ${game.spread || '-1.5'} ${game.homeSpreadPrice || '-110'}
Total: Over ${game.total || 'N/A'} ${game.overPrice || '-110'} / Under ${game.total || 'N/A'} ${game.underPrice || '-110'}
${isMLB && game.f5Total ? `First 5 Innings: Away ${game.f5AwayML || 'N/A'} / Home ${game.f5HomeML || 'N/A'} | F5 Total: Over/Under ${game.f5Total} (Over ${game.f5OverPrice || 'N/A'} / Under ${game.f5UnderPrice || 'N/A'})` : ''}
PRICING NOTE: Use exact prices — value is in the juice. Run line at -105 vs -125 matters.
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}
Series: ${game.seriesContext || 'N/A'}

Return ONLY this JSON with no extra text:
{"awayFacts":"3 key facts about away team form and strengths right now","homeFacts":"3 key facts about home team form and strengths right now","recentForm":"away team L5 and L10 trend AND home team L5 and L10 trend — who is hot who is cold","headToHead":"overall H2H record AND specifically last time at this home venue including result and margin — go to last season if needed","pitchingFacts":"both starters ERA WHIP K/9 — AND xFIP/SIERA if available (flag any gap between ERA and xFIP as regression risk or upside), recent form last 3 starts, career vs this opponent","pitchMixMatchup":"${isMLB ? 'how each pitcher\'s pitch mix matches up against tonight\'s lineup — fly ball pitcher in hitter park risk, GB pitcher vs contact lineup advantage, etc.' : 'N/A'}","bullpenAvailability":"${isMLB ? 'who is available tonight and who is unavailable based on last 3 days usage — this is critical for game script' : 'N/A'}","situationalFacts":"series context and any relevant schedule factors","injuries":"all IL and day-to-day players both teams or none reported","weather":"temp wind direction and how it affects scoring at this specific park","parkFactor":"${isMLB ? 'park factor rating and what it means for tonight — does it favor over/under, does it inflate or suppress HR, does it affect run line value' : 'N/A'}","lineFacts":"line movement sharp signal and book gaps","f5Lines":"${isMLB && game.f5Total ? `F5 ML: Away ${game.f5AwayML} Home ${game.f5HomeML} | F5 Total: ${game.f5Total}` : 'N/A'}"}`;
}

// STAGE 2: EDGE FILTER (THE GATEKEEPER)
// This is the most important stage. If no real edge exists → PASS. Full stop.
// ─────────────────────────────────────────────────────────────────────────────
export function buildStage2Prompt(game, stage1Data) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';
  const isMLB = (game.sport || 'MLB') === 'MLB';

  // Build advanced stats context for Stage 2
  const awayAdvLine = isMLB && (game.awayPitcherXFIP || game.awayPitcherSIERA)
    ? `${game.awayPitcher}: xFIP ${game.awayPitcherXFIP || '?'} | SIERA ${game.awayPitcherSIERA || '?'} | FIP ${game.awayPitcherFIP || '?'} (ERA from season stats — compare to xFIP for regression signal)`
    : null;
  const homeAdvLine = isMLB && (game.homePitcherXFIP || game.homePitcherSIERA)
    ? `${game.homePitcher}: xFIP ${game.homePitcherXFIP || '?'} | SIERA ${game.homePitcherSIERA || '?'} | FIP ${game.homePitcherFIP || '?'} (ERA from season stats — compare to xFIP for regression signal)`
    : null;

  return `You are a professional MLB bettor. Analyze this game using the data provided.

GAME: ${game.away} @ ${game.home} | Slot: ${slot}
Opening ML: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'}
Current ML: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
Run Line: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice || '-110'} / Home ${game.spread || '-1.5'} ${game.homeSpreadPrice || '-110'}
Total: Over ${game.total || 'N/A'} ${game.overPrice || '-110'} / Under ${game.total || 'N/A'} ${game.underPrice || '-110'}
${isMLB && game.f5Total ? `F5 ML: Away ${game.f5AwayML || 'N/A'} / Home ${game.f5HomeML || 'N/A'} | F5 Total: Over/Under ${game.f5Total} (Over ${game.f5OverPrice || 'N/A'} / Under ${game.f5UnderPrice || 'N/A'})` : ''}

DATA:
Away: ${stage1Data.awayFacts}
Home: ${stage1Data.homeFacts}
Recent Form: ${stage1Data.recentForm}
H2H (including last time at this home venue — go back to past seasons if needed): ${stage1Data.headToHead}
Pitching: ${stage1Data.pitchingFacts}
${awayAdvLine ? `Away Advanced Metrics: ${awayAdvLine}` : ''}
${homeAdvLine ? `Home Advanced Metrics: ${homeAdvLine}` : ''}
Pitch Mix Matchup: ${stage1Data.pitchMixMatchup || 'N/A'}
Bullpen Availability: ${stage1Data.bullpenAvailability || 'N/A'}
Hitter/Lineup: ${stage1Data.hitterLineup || 'N/A'}
Series Context: ${stage1Data.seriesContext || 'N/A'}. MANDATORY: Use your knowledge to state the actual game number in this series and series record.
Injuries: ${stage1Data.injuries || 'None'}
Weather: ${stage1Data.weather || 'N/A'} | Umpire: ${stage1Data.umpire || 'N/A'}
Park Factor: ${game.parkFactor || 1.0} — ${game.parkFactorNote || 'Neutral'} | ${stage1Data.parkFactor || 'N/A'}
Situation: ${stage1Data.situationalFacts}
Lines: ${stage1Data.lineFacts}
F5 Lines: ${stage1Data.f5Lines || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CHECK WHO IS ON THE MOUND (DO THIS FIRST):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before anything else, explicitly identify the two starting pitchers for THIS specific game tonight:
- AWAY starter: ${game.awayPitcher || 'TBD / NOT CONFIRMED'}
- HOME starter: ${game.homePitcher || 'TBD / NOT CONFIRMED'}
State both names in your reasoning and confirm they are today's actual probable starters. This is the single most important input in a baseball game — the entire analysis is built on who is actually pitching.
- If EITHER starter shows "TBD" or is not confirmed, say so explicitly and treat the pitching read as PROVISIONAL. A pick made before the starter is confirmed is a trap — flag it as lower confidence (cap at Tier 2) and note it should be re-checked once the starter is announced. Do NOT pretend to know a matchup you can't yet see.
- If a name looks like a bullpen game / opener situation, factor that in — an opener changes the whole run-projection and bullpen-usage picture.
- Use web search if needed to confirm tonight's probable starters and catch any late scratch or change that the data above may not reflect yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASELINE PRINCIPLE — PITCHING DRIVES THE FAVORITE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In baseball, the team with the BETTER STARTING PITCHER tonight is usually the one favored on the moneyline — starting pitching is the single biggest lever on who "should" win a given game, more than overall team record or offense alone. Use this as your baseline expectation before you do anything else:
- Compare tonight's two starters (ERA, xFIP/SIERA, recent form, K-rate) and ask: does the moneyline favorite match the pitching favorite? Normally, yes — that's the market correctly pricing pitching.
- If they DON'T match — the team with the worse starter tonight is somehow favored, or the team with the clearly better starter is a live underdog — that is a real signal worth investigating. It usually means the market is weighting something else heavily (offense gap, bullpen, park, home field, injuries) OR it's a mispricing / potential scam spot. Name which one it is.
- This is a baseline, not an absolute rule — offense, bullpen, park, and situational factors can legitimately override a pitching edge. But you should always be able to explain WHY the price does or doesn't match the pitching matchup, not just note the numbers separately.
- In a Vegas slot: if the pitching edge and the price are already aligned as expected, that alone is not a scam — you still need a real mispricing elsewhere. If they're misaligned, that misalignment is often exactly where the scam lives.
- In a Public slot: if the better-pitching team is favored as expected and nothing else contradicts it, that's confirmation, not a red flag — don't manufacture doubt just to find an angle.

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
- CRITICAL: Compare ERA to xFIP/SIERA. A pitcher with a good ERA but high xFIP is due for regression — his good numbers are a mirage. A pitcher with a bad ERA but low xFIP is better than he looks. This is where the public gets trapped.
- Does this lineup match up poorly against his pitch mix? A fastball-heavy pitcher against a lineup that crushes velocity is a scam setup. A breaking-ball-heavy pitcher against a lineup with low K% vs spin is a mismatch.
- Is the "weak" starter actually the right side? Has he dominated this lineup historically or been quietly throwing well?
- BUT: if the data genuinely supports the ace, that can be the scam too — everyone fading him when he's actually right.

2. ML SCAM: Is the ML a public trap? If everyone is on one side and the price is inflated, the scam is the other side.

2b. ⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT" (hard checkpoint):
- The money must match the movement. If the public money is heavy on a team, that team's price should get MORE expensive (shorter), not cheaper. When the money is on a team but the line moves the OTHER way (their price gets better/longer, or the opponent's price shortens), that is REVERSE LINE MOVEMENT — a red flag every time.
- Reverse line movement means sharp money is on the quiet side against the public. Example: all the money is on the home favorite yet they drift from -180 to -165 (getting cheaper while backed) — the sharps are on the other side. Fade the public, follow the sharp side.
- Run this check on every Vegas-slot game: does the line movement direction agree with where the public money is? If yes, that's normal. If NO (movement contradicts the money), that mismatch is often exactly where the scam is — name it and lean to the side the sharp movement points to.
- A favorite whose price gets CHEAPER despite public support, or an underdog whose price SHORTENS with little public money on them, are the two classic reverse-line-movement tells.

3. RUN LINE SCAM: If ML is clearly the public side, is the scam on the run line? Underdog +1.5 at near-even money when public is hammering the favorite ML?

4. TOTAL SCAM: Is the over/under being driven by offensive reputation while pitching, weather, park, or umpire tells a different story?
- Park factor above 1.10 = offense-friendly environment, public tends to over-bet unders here thinking "it'll normalize"
- Park factor below 0.92 = pitcher-friendly, public tends to over-bet overs thinking "scoring is normal"
- Umpire with tight zone + two strikeout pitchers + pitcher's park = massive under lean that public ignores

5. FORM SCAM: Hot team in a regression spot. Cold team about to bounce. Blowout yesterday means nothing today.

6. PROPAGANDA SCAM: What is the media narrative? That narrative is inflating one side. The scam is the side everyone is ignoring.

6b. ⚡ NARRATIVE-OUTRUNS-REALITY PROPAGANDA (a category with MANY forms — stay alert for all of them, not just one template): This is media/broadcast language that oversells a small or cherry-picked slice of reality as if it were the full picture. The injury-return case is just ONE example: "Woodruff (2-1, 2.59 ERA) has been nearly flawless in his first two outings since missing nearly two months with shoulder inflammation" — glowing superlatives ("nearly flawless," "dominant," "vintage form") built on only 1-3 recent appearances. But watch for OTHER forms of the same underlying pattern too, including:
   * A hot rookie or September call-up getting "future star" framing off a tiny sample.
   * A newly-acquired player "revitalizing" a team narrative after just a few games.
   * A team's "system change" / new manager bounce getting credited before there's real evidence it's sustainable.
   * "Revenge game" / "statement win" / "getting hot at the right time" storylines used to justify a price that the underlying data doesn't support.
   * Any case where the STORY (a few good games, a comeback, a milestone, a feel-good angle) is doing more work than the actual body of evidence.
   * ANOTHER FORM: absolute historical-streak framing — "this player has never won against this opponent," "this team has never lost to this team," "he's 0-6 lifetime vs this club," etc. Broadcasters and media repeat these constantly as if they're predictive on their own. Treat this with real skepticism: a streak like this is a fact about the PAST, not automatically a forecast for TONIGHT. Before letting it influence the pick, check whether today's specific conditions (who's actually starting, current form, injuries, home/away, matchup specifics) genuinely support the streak continuing. If the streak is being cited as the reason for a price/pick without real supporting evidence in tonight's specific matchup, that's the propaganda — investigate the actual matchup rather than defaulting to "the streak says X."
   * ANOTHER FORM: recent win/loss stretch framing — "hasn't won in 8 games," "hasn't lost in 2 weeks," "team has really struggled lately," "riding a 6-game win streak." Different from the historical-all-time case above — this is about a CURRENT stretch, good or bad, treated as predictive by itself. Always ask WHY the stretch happened: a losing skid against tough pitching, or a win streak built against weak teams, tells you nothing about tonight if the schedule strength or matchup context has changed. Don't accept "hasn't won/lost in X games" as meaningful on its own — check whether the underlying reason for the stretch (schedule difficulty, injuries, quality of opponents faced) actually applies to tonight's specific matchup.
   * A SPECIFIC HIGH-VALUE VARIANT: a losing streak that gets explained by ONE dominant individual pitching performance — e.g. "The Angels have lost five in a row after Saturday night's 8-1 thrashing at the hands of the Red Sox, as starter Sonny Gray held them to a run and four hits over six innings." Notice the article itself names the reason: an elite start by a specific pitcher, not the team playing badly across the board. This is a WEAKER signal than a genuine team-wide slump — the team just ran into a good arm. Tonight's game is against a DIFFERENT opponent and a different starter, so that specific reason for the loss no longer applies. Don't let "five-game losing streak" carry forward into tonight's read on its own — check tonight's actual starter matchup, which may look completely different and favor the "struggling" team.
   * The common thread across all forms: superlative/emotional language + a small or selectively-framed sample (or a historical/recent stat repeated out of context) + a narrative arc that's more compelling than it is statistically supported for THIS SPECIFIC game.
   * THE RULE: when you spot ANY version of this pattern, treat it as a high-value red flag against the hyped side (green flag for the opponent) — the market and public tend to overreact to the story, and the opponent wins far more often than the hype suggests. This is DIFFERENT from the general propaganda/pricing check above (which is about a narrative inflating a team's price broadly) — this is specifically about narrative outrunning the actual evidence.
   * Do not confuse this with a player/team with a genuinely long, well-supported track record — the tell is specifically a STORY built on a thin or cherry-picked sample.

7. SITUATIONAL SCAM: Series finale urgency, revenge game, letdown spot, travel/fatigue, bullpen fatigue.

8. BULLPEN SCAM: Public prices in a team's closer without knowing he pitched yesterday and the day before. If the key reliever is unavailable and the line doesn't reflect it, that's real edge.

9. SERIES FINALE SCAM: Public hammers the series leader to close out. The desperate team is almost always live. Must check: who pitched Games 1-2, is the leading team's starter/pen compromised, blowout regression from yesterday. This is one of the highest-percentage scam spots in MLB. Evaluate it on every series finale.

10. ⚡ 3-0 SWEEP COMPLETION PATTERN (4-GAME SERIES ONLY) — HIGH-CONVICTION OVERRIDE:
   In a 4-GAME series, if one team has WON THE FIRST 3 GAMES and is up 3-0 going into Game 4 (the finale), that team completes the sweep and wins Game 4 roughly 9 out of 10 times. This is a documented, high-percentage pattern.
   * The team up 3-0 has every edge that produced the first three wins still in effect — better form, the hot lineup, favorable matchups, and total psychological control. The swept team is demoralized, often resting regulars, and playing out a lost series.
   * THIS PATTERN OVERRIDES the normal "desperate team is live in a finale" scam logic. The standard finale scam (back the desperate underdog) does NOT apply when the deficit is 0-3 in a 4-game series — a team down 0-3 is not "desperate and dangerous," they are beaten. Do not flip to the swept team just because it's a finale.
   * BET ON the team that is up 3-0 to win Game 4 and complete the sweep. This is typically a Tier 1 or strong Tier 2 lean depending on pricing and pitching.
   * ONLY override this pattern if there is a concrete, specific reason the 3-0 team is compromised tonight (e.g., their scheduled starter is a clear downgrade / bullpen game with a taxed pen, or a key bat is confirmed out). A general "regression is due" feeling is NOT enough to fade a 3-0 sweep spot.
   * ⚠️ CRITICAL SCOPE: This pattern ONLY applies to a 4-GAME series where one team is up 3-0. It does NOT apply to:
     - A 3-game series where a team is up 2-0 (that is a 2-game lead in a shorter series — different situation entirely, no sweep pattern applies)
     - Any series shorter than 4 games
     - Any lead smaller than 3-0 in a 4-game series
   * ALWAYS confirm both the series LENGTH (must be 4 games) AND the record (must be 3-0) before applying. If either condition isn't met, this rule does not apply — treat the game normally.

11. ⚡ SERIES-ARC PRICE SCAM — "MOST EXPENSIVE AFTER A STREAK" (the rug pull):
   Track the price a team has carried across the whole series, not just tonight. The classic Vegas rug pull: a team wins the first games of a series (often with the line moving in their favor each day), and then in a later game — especially the finale — they are priced at their MOST EXPENSIVE point of the entire series. The public sees the win streak, sees the fat price, and piles onto that team's moneyline OR grabs the "free" run line (+1.5). That pile-on is exactly the trap.
   * The tell is NOT just "they won some games." The tell is: winning streak WITHIN this series + the team now sitting at its highest/most expensive price of the series. When those combine, the market is inviting the public in — and the contrarian side (the opponent, often the opponent's -1.5) is frequently the real play.
   * Concretely: if a team went, say, +150 → +130 → -120 across the series (getting more expensive as they won), and now sits at their priciest number yet while the public loves them, treat the OTHER side as the live scam candidate. Name the price progression across the series in your reasoning.
   * This is the general form of the finale scam — it's about the PRICE ARC over the series combined with the public's streak-chasing, not just "it's the last game."
   * NOTE: this is the counterpart to the 3-0 four-game sweep rule above. They can point opposite directions — the sweep rule says back the 3-0 team in a 4-game finale; this price-arc scam warns against chasing a streaking team at their most expensive price. Resolve the conflict with the specifics: a true 3-0-in-a-4-game-series sweep spot favors the leader; a streaking team getting an unusually inflated price with heavy public love (outside that exact sweep condition) favors the fade. State which situation you're in.

12. ⚡ CROSS-SERIES CARRYOVER TRAP — hot team into a bad matchup, still favored:
   When a team finishes a hot series and travels to a NEW opponent, check the new head-to-head. The trap: a team is riding a winning streak from the previous series, faces a new opponent that has historically OWNED them (especially at that opponent's home park), and yet is STILL priced as the favorite because of the streak hype. The public backs the hot team (or takes the home dog's free +1.5); the market is pricing in the streak ending.
   * The signal is the mismatch: recent hot streak + a specific opponent-and-venue the streaking team historically loses to + the streaking team still favored anyway. That inflated favorite price on a team walking into a bad matchup is the scam.
   * The live side is usually the home underdog that owns the matchup — back them (ML or +1.5 depending on how close the game projects). Cite the head-to-head history and who's home.
   * Do NOT trigger this on streak alone. It requires the historically-unfavorable matchup AND the streaking team being priced as favorite despite it.

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
- ⚠️ SERIES FINALE — MANDATORY CHECK IN PUBLIC SLOT TOO (Game 3 of 3, Game 4 of 4, Game 5 of 5):
  Series finales produce scams in BOTH slots — this is not Vegas-slot-only. The public slot default is to back the better team, but series finales routinely flip that logic:
  * The public backs the series leader in public slots the same way they do in Vegas slots. The line gets inflated regardless of slot assignment.
  * The desperate team's urgency, bullpen commitment, and lineup prioritization make them consistently dangerous as underdogs in finales.
  * Check who the series leader used in Games 1-2 — if their ace and closer are unavailable or limited tonight, the "better team" advantage disappears.
  * Blowout regression: a team that got blown out yesterday is NOT the same team tonight — they come back focused and desperate. Don't assume the pattern repeats.
  * This is one of the most consistent edge spots in MLB across the entire season. When you see it, evaluate it explicitly. Do not default to the series leader just because they're the better team overall.
  * ⚡ EXCEPTION — 3-0 SWEEP COMPLETION (4-GAME SERIES ONLY): The "back the desperate underdog" finale logic does NOT apply when a team is up 3-0 in a 4-game series. A team down 0-3 is beaten, not dangerous. The team up 3-0 completes the sweep and wins Game 4 ~9 out of 10 times — BET ON the 3-0 team to finish the sweep. Only fade them with a concrete reason they're compromised tonight (downgrade starter / taxed bullpen game / key bat confirmed out). "Regression is due" is not enough. ⚠️ THIS DOES NOT APPLY TO 3-GAME SERIES — a team up 2-0 in a 3-game series is a completely different situation and this pattern does not apply. Confirm series length is 4 games AND record is 3-0 before using this rule.
- If you find a scam in a public slot — BET IT. The slot type does not prevent a scam from existing.
- ⚡ REVERSE LINE MOVEMENT applies in public slots too: the money must match the movement. If a team is backed by the public money but their price gets CHEAPER (or the opponent's shortens), that reverse line movement is sharp money on the quiet side — a red flag against the public side even here.
- ⚡ SERIES-ARC PRICE SCAM: if a team has been winning within this series and now sits at their MOST EXPENSIVE price of the series while the public chases the streak (ML or the "free" +1.5), the contrarian side is often the real play. Name the price progression across the series. (Exception: a true 3-0 lead in a 4-game series still favors the leader per the sweep rule above.)
- ⚡ CROSS-SERIES CARRYOVER TRAP: a team coming off a hot series, now facing a NEW opponent that historically owns them (especially at that opponent's home), yet still priced as favorite — the live side is usually the home underdog that owns the matchup. Requires the unfavorable head-to-head AND the streaking team still favored.
- If the expected outcome is genuinely supported by ALL the information AND the price is fair → back it confidently.
- ALWAYS compare price to information. A good team at -200 might still be the wrong bet if the price is too high for what the data supports.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MLB KEY FACTORS — EVALUATE ALL OF THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PITCHER ANALYSIS (most important in MLB):
- Starting pitcher stats: ERA, WHIP, K/9, recent form (last 3-5 starts), season record
- ADVANCED METRICS (mandatory when available): Compare ERA to xFIP and SIERA.
  * ERA vs xFIP gap of 0.75+ = significant regression signal (good ERA with high xFIP = about to get worse; bad ERA with low xFIP = about to get better)
  * SIERA accounts for batted ball profile — more reliable than FIP for certain pitcher types
  * K% and BB% trend: rising K% with falling BB% = pitcher locked in; opposite = command issues emerging
  * HR/FB rate above 15% with high fly ball rate = HR risk elevated beyond what ERA shows
- Pitcher vs THIS opponent: career starts head to head AND historical. How has he performed against this lineup specifically?
- PITCH MIX VS LINEUP: This is one of the most underused edges in MLB betting.
  * Fastball-heavy pitcher (60%+) vs lineup that crushes hard stuff (high barrel rate) = danger
  * Breaking-ball-heavy pitcher vs lineup with low K% and good contact rate = mismatches avoided
  * Changeup-reliant pitcher vs lineup stacked with left-handed hitters = platoon advantage matters
  * If pitcher's whiff rate is falling on his primary pitch, that's a real warning sign
- Pitcher vs pitcher: who has the edge today — not on paper, but right now in current form?

BULLPEN — AVAILABILITY IS EVERYTHING:
- DO NOT evaluate bullpen ERA in isolation. Check who is ACTUALLY AVAILABLE tonight based on the last 3 days of usage.
- Pitcher who threw 30+ pitches yesterday = likely unavailable or limited tonight
- Closer who appeared in consecutive games = must-avoid leverage situation
- Team missing their primary setup man AND closer = their 7th/8th/9th inning is a disaster waiting to happen
- Bullpen ERA last 7 days vs season ERA: is this pen hot or melting down right now?
- How does each bullpen perform specifically against this opposing lineup type?

BATTERS & LINEUP:
- Key hitters in form vs this pitcher — check recent at-bats and historical splits
- Platoon advantages (LHP vs RHH, RHP vs LHH)
- Lineup depth 1-9: who is dangerous, who is automatic outs, where does the lineup fall off?
- RISP performance: does this lineup cash runners in or strand them? Matters for run line decisions.
- Who is hot, who is cold, who is missing?

UMPIRE & PARK ENVIRONMENT:
- Umpire strike zone tendency: tight zone = more baserunners + higher scoring; wide zone = pitcher's duel + unders
- Umpire + pitcher combination: a command pitcher with a wide-zone ump is a massive advantage; a power pitcher with a tight ump sees fewer strikeouts
- PARK FACTOR is a hard number, not a suggestion: ${game.parkFactor || 1.0} for ${game.home}'s park
  * Park factor above 1.10: environment actively inflates offense — be very cautious on unders, skeptical of run line favorites who need multiple runs
  * Park factor below 0.92: environment actively suppresses scoring — be cautious on overs, run line underdogs getting extra protection
  * This is especially critical for totals — the public rarely adjusts for park factor and books know it
- Coors Field specifically: altitude inflates all stats, ERA and xFIP are both understated here, unders are almost always traps

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
- ⚠️ SERIES FINALE — MANDATORY SCAM CHECK (Game 3 of 3, Game 4 of 4, Game 5 of 5):
  This is one of the most reliable scam spots in all of MLB. Run this check every time:
  * The PUBLIC hammers the series leader expecting the close-out. That inflated line is almost always a trap.
  * The DESPERATE team (facing series elimination) historically outperforms in finales — urgency sharpens their lineup decisions, bullpen commitment, and approach.
  * The LEADING team may have burned their ace and best relievers in Games 1-2. Check who they actually have available TONIGHT versus who pitched earlier.
  * Blowout the night before? Regression is real. Teams blown out in Game 2 rarely get blown out again in Game 3 — the pendulum swings hard.
  * Even if the series leader is the better team overall, ask: is the price right for TONIGHT specifically — with THIS starter and THIS bullpen?
  * The scam can go either direction. Sometimes the series leader IS correct (better starter tonight, desperate team's pen is exhausted). The point is: EXAMINE it. Never default. Never let the series lead blind you to tonight's actual matchup.
  * When identified as a series finale scam, it must be explicitly called out in the scamLayer field.
- Weather: wind direction and speed, temperature, precipitation — wind out to center at 15+ mph = significant over push; wind in from center = significant under push
- Umpire: does this umpire favor pitchers or hitters? Career K/9 and run environment?
- Injuries: who is missing and does it matter for today specifically?
- Day game after night game: batters underperform in day games following night games — relevant for totals

PRICE VS DATA:
- Compare the line to what you found. Is this price fair, overpriced, or underpriced?
- ALWAYS compare price to information before finalizing.

RUN LINE / TOTAL NUMBER MOVEMENT (distinct from price movement): The "Lines" data above includes whether the run line or total NUMBER itself has moved (e.g. -1.5 to -2.5, or 8.5 to 9) — not just the price on a fixed number. This is a different and often stronger signal than price-only movement: it usually means real money is significant enough to move the actual number, not just shop for a better price. If the run line or total has moved 1+ full point, treat that as meaningful confirmation (or contradiction) of your read — note which direction it moved and whether that supports or conflicts with your edge. A stable number with only price movement is a weaker signal than the number itself shifting.

⚡ WHY HAS THE LINE BEEN STAGNANT? (mandatory when opening vs current shows little/no movement): A line that hasn't moved from open is not "no information" — it IS information, and you must explain WHY. Compare the opening line to the current line (both are shown above) and consider:
- Is the market simply CONFIDENT this number is correct — sharp and public money agree, so there's no pressure to move it? That's a real signal the price is efficient and well-calibrated.
- Is it stagnant because the game hasn't attracted much betting volume yet (low-profile game, early in the day, star player news hasn't broken)? A stagnant line on a game nobody's touched yet means less information is baked in than a line that's been tested by real money.
- Is the book intentionally holding the number steady because moving it would expose a mismatch they don't want bet into (i.e., they're comfortable with the liability at this price)?
- Is stagnancy itself suspicious given the underlying data — if your matchup read suggests a clear edge but the price hasn't moved at all, ask whether the market knows something you don't (a legitimate reason for confidence in the current price) OR whether this is an inefficiency nobody has found yet (a real opportunity).
State explicitly which of these applies and why, don't just note "the line hasn't moved" and move on — a stagnant line always deserves an explanation, not silence.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY SIGNAL ALIGNMENT CHECK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finalizing ANY pick, you must run this alignment check. Go through every signal below and determine whether it SUPPORTS, CONTRADICTS, or is NEUTRAL toward your proposed pick direction. Anything that doesn't align is a RED FLAG.

THIS IS NON-NEGOTIABLE: A pick with multiple red flags is either wrong or hiding a scam. You must resolve every red flag before finalizing.

CHECK EACH SIGNAL AGAINST YOUR PICK DIRECTION:

1. LINE MOVEMENT — Does the DraftKings line movement support your pick?
   ✅ ALIGNS: Line moved toward your pick team (sharp money confirming your read)
   🚩 RED FLAG: Line moved AWAY from your pick team (sharps are on the other side — why?)
   🚩 RED FLAG: Significant steam or sharp signal on the opposite side of your pick
   ➖ NEUTRAL: Stable line with no meaningful movement

2. PRICING — Is the price consistent with what the data actually shows?
   ✅ ALIGNS: Price is fair or undervalued relative to your edge
   🚩 RED FLAG: Pick team is heavily juiced (-180 or worse) but your data only shows a moderate edge
   🚩 RED FLAG: The price implies a certainty the matchup data doesn't support
   🚩 RED FLAG: Better value clearly exists on the other side at the current price

3. PUBLIC NARRATIVE / STORYLINE — Does the public story match or contradict the data?
   ✅ ALIGNS: Public is on the same side and the data supports them (genuine favorite)
   ✅ ALIGNS: Public is on the OTHER side but you have real data contradicting the narrative (scam setup)
   🚩 RED FLAG: You're picking WITH the public at inflated juice without data superiority
   🚩 RED FLAG: The storyline sounds compelling but the actual stats don't back it up

4. PITCHING MATCHUP — Do the pitching numbers support the pick?
   ✅ ALIGNS: xFIP/SIERA, ERA, and recent form all point toward your pick team's starter being better tonight
   🚩 RED FLAG: ERA looks good but xFIP shows regression coming — the good ERA is a mirage
   🚩 RED FLAG: You're fading a pitcher whose numbers genuinely justify the price
   🚩 RED FLAG: Pitch mix creates a clear disadvantage for your pick team's starter vs this lineup

5. RECENT FORM — Does recent form (L5/L10) support the pick direction?
   ✅ ALIGNS: Pick team trending up, opponent trending down
   🚩 RED FLAG: Pick team is cold while opponent is hot, and no clear reason to fade the trend
   🚩 RED FLAG: Pick team's wins are against weak opponents while losses came vs comparable competition

6. HEAD-TO-HEAD — Does H2H history at this specific venue support the pick?
   ✅ ALIGNS: Pick team has demonstrated edge in this matchup historically
   🚩 RED FLAG: H2H consistently favors the OTHER team at this venue — that's real signal
   ➖ NEUTRAL: Small sample H2H with no clear pattern

7. PARK FACTOR / WEATHER / ENVIRONMENT — Does the run environment align with the bet?
   (For totals and run lines specifically)
   ✅ ALIGNS: Park factor and weather conditions support the over/under direction
   🚩 RED FLAG: Park is a hitter's park but you're on the under — what's overriding that?
   🚩 RED FLAG: Wind is blowing out but total is set low — or wind is blowing in but total is high
   🚩 RED FLAG: Park factor and umpire both lean one way but your total pick goes the other way

8. BULLPEN AVAILABILITY — Does bullpen strength/availability support the game script?
   ✅ ALIGNS: Pick team has fresh, available bullpen; opponent's key relievers are taxed
   🚩 RED FLAG: Pick team's closer/setup men are unavailable but price doesn't reflect it
   🚩 RED FLAG: You're projecting a blowout win but the pick team's bullpen is compromised

9. INJURIES / TRELL RULE — Do player availability facts support the pick?
   ✅ ALIGNS: Key injuries favor your pick team's side
   🚩 RED FLAG: Star player is OUT for pick team and this isn't priced in
   🚩 RED FLAG: Trell Rule applies (first game after star's absence/return) and contradicts your pick

10. SERIES / SITUATIONAL CONTEXT — Does the situational setup support the pick?
    ✅ ALIGNS: Series context, fatigue, motivation all favor your pick team
    🚩 RED FLAG: Pick team is in a letdown spot, series finale regression, or back-to-back fatigue
    🚩 RED FLAG: Desperate team has urgency that contradicts picking the series leader at inflated price

AFTER RUNNING THE ALIGNMENT CHECK:
- Count your ✅ GREEN FLAGS (signals that support the pick)
- Count your 🚩 RED FLAGS (signals that contradict or raise doubt)
- ➖ NEUTRAL signals don't count either way

WHAT TO DO WITH RED FLAGS:
- 0-1 red flags with 3+ green flags → solid pick, proceed with confidence
- 2 red flags → examine each one. Can you explain why it doesn't invalidate the pick? If yes, proceed cautiously (Tier 2 territory). If no, reconsider the pick direction.
- 3+ red flags → either the pick is WRONG (switch sides) or there's a SCAM hiding in the contradiction (go deeper). Do NOT proceed with a pick that has 3+ unexplained red flags. PASS instead.
- A single CRITICAL red flag (line moving hard against your pick, Trell Rule trigger, key injury not priced in) → treat as 3 red flags automatically

THE ALIGNMENT PRINCIPLE: The best plays have everything pointing the same direction — line movement, pricing, data, narrative, situational context. When everything aligns, bet with confidence. When signals conflict, the conflict IS the analysis. Either the conflicting signal reveals a scam (and you bet the scam), or it means your pick is wrong.

THE PRICE PRINCIPLE: The answer is in the line. The current price is the single most information-dense piece of evidence you have — the market has already synthesized public perception, sharp money, injuries, and situational context into one number. Your job is not to describe that number, it's to EXPLAIN it. Every analysis must answer three things, explicitly:
1. WHY is the price set at this exact number? What does the market believe about this matchup, and does the underlying data (pitching, form, H2H, everything in Stage 1) actually support that belief?
2. If the line has moved from open, WHY is money flowing toward one side and away from the other? What changed, and does that direction actually make sense given everything else you know?
3. Does the price DOES or DOES NOT make sense for this specific matchup? Render an explicit verdict — fair, mispriced, or exactly right — don't just restate the number and move on to the next section.
If you can't articulate WHY a price is what it is, you don't actually understand the market yet. A pick without a real answer to "why is the line here" is not a finished analysis.
${NARRATIVE_VS_PROPAGANDA}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE ALL THE INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL the information you collected matters — not just pitching, not just form, not just one thing. The play comes from the COMBINATION of everything:

- Pitching (ERA + xFIP/SIERA) + pitch mix matchup + bullpen availability + lineup + records + form + H2H + situational + weather + umpire + park factor + injuries + price = the full picture
- No single factor overrides everything else. A great pitcher still loses if his bullpen blows it, his team is fatigued, weather neutralizes his advantage, and the price is inflated.
- The PRICE is always the final filter. Even if everything points one way, if the price doesn't offer value — pass or find a better market expression.
- Consistency wins. Simple, well-supported plays beat complicated single-factor picks every time.
- If no clear edge exists after evaluating EVERYTHING → PASS. But if the data genuinely lines up — multiple factors pointing the same direction at a fair price — back it with the confidence the data supports.
- Keep it simple. Overanalyzing causes losing plays. The clearest edge, supported by multiple factors, at the right price = the play.

THE BAR FOR A REAL PICK (not PASS, not a vague lean):
- "edgeReason" must name the SPECIFIC factors driving the pick, not a vague feeling — if you can't point to 2+ concrete factors (a real stat, a real situational fact, a real price discrepancy) that combine into one clear case, it's not a real edge yet.
- Ask yourself: "what would have to be true for this pick to be wrong?" If the honest answer is "nothing unusual, this is basically a coin flip with a story attached," that's a PASS, not a Tier 2.
- Do NOT pass just because a game requires combining multiple smaller signals rather than having one obvious blowout factor — most real, profitable edges come from synthesis, not from one dominant signal. A genuine multi-factor case (form + matchup + price alignment, even without one knockout reason) is a legitimate pick, not an automatic pass. Reserve PASS for when the factors are genuinely mixed, contradictory, or there's truly nothing beyond a coin-flip with the data in front of you — not for every game that takes real thought to untangle.
- If you find yourself hedging in the edgeReason ("could go either way but leaning X", "slight edge, nothing major") — that's a signal to either dig deeper for the real combination of factors that justifies a clear pick, or to actually PASS rather than present a hedge as a pick.

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "PITCHING" or "BULLPEN" or "LINEUP" or "FORM" or "H2H" or "SITUATIONAL" or "PRICE" or "WEATHER" or "UMPIRE" or "PARK" or "PITCH_MIX" or "SCAM" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence stating exactly what the edge is",
  "counterArgument": "Strongest argument against this pick",
  "counterValid": true or false,
  "passReason": "If passing — exactly why no edge exists",
  "publicNarrative": "What does the general public broadly believe about this game (which side is popular, the common take)? This is CONTEXT — state it, then say whether it is just context or actually connects to a real edge (e.g. an inflated price). Do NOT treat public belief as a fade signal on its own.",
  "propagandaCheck": "SEPARATE from public narrative: does REAL propaganda exist — a specific media storyline where the narrative outruns the reality for THIS game? If yes, name the exact storyline and CLASSIFY its polarity: POLARITY A = irrational HYPE overselling a side (→ fade the hyped side, back the opponent) OR POLARITY B = irrational negative PILE-ON on a strong team/player whose real matchup edge tonight is still intact (→ back the maligned side, NOT the opponent — the Skenes/Pirates case). Give the directional implication. If there is NO real propaganda, say so plainly — do not relabel ordinary public narrative as propaganda.",
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (PITCHING/ML/RUN_LINE/TOTAL/FORM/PROPAGANDA/SITUATIONAL/BULLPEN/PARK/SERIES_FINALE)' : 'N/A'}",
  "redFlags": ["List every signal that contradicts or doesn't align with the pick — be specific e.g. 'Line moved 12pts AWAY from pick team', 'xFIP 4.2 contradicts 2.8 ERA — regression risk', 'Park factor 1.15 contradicts under pick'"],
  "greenFlags": ["List every signal that confirms and aligns with the pick — be specific e.g. 'Sharp money on pick team (DK moved 14pts toward)', 'H2H 7-2 at this venue', 'Bullpen fresh vs opponent taxed yesterday'"],
  "alignmentScore": "X/10 signals align — e.g. '7/10 signals align, 2 red flags (line movement against, park factor neutral-to-against)' — be honest, not optimistic",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 derived MECHANICALLY from the redFlags/greenFlags/alignmentScore you just produced in this same JSON — not a separate gut feeling. 0-1 red flags + 3+ green flags = 80-95. 2 explainable red flags = 55-75. 3+ red flags or an unresolved critical one = you should be passing, not assigning a confidence number. Two plays with similar flag counts should get similar numbers; do not vary it on vibes alone.
}`;
}


export function buildStage3Prompt(game, stage1Data, stage2Data) {
  const sport = game.sport || 'MLB';
  const isBaseball = sport === 'MLB';
  const hasF5 = isBaseball && (game.f5AwayML || game.f5Total);

  return `You have identified a real betting edge in this game. Now determine which market best captures that edge.

GAME: ${game.away} @ ${game.home} | ${sport}
EDGE: ${stage2Data.edgeReason}
EDGE SIDE: ${stage2Data.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'} (Opened: Away ${game.openingAwayML || 'N/A'} / Home ${game.openingHomeML || 'N/A'})
${isBaseball ? `RUN LINE: Away +${game.spread ? Math.abs(parseFloat(game.spread)).toFixed(1) : '1.5'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'-1.5'} ${game.homeSpreadPrice||'-110'}` : `SPREAD: Away ${game.spread ? (parseFloat(game.spread)>0?'+':'')+(-parseFloat(game.spread||0)).toFixed(1) : 'N/A'} ${game.awaySpreadPrice||'-110'} / Home ${game.spread||'N/A'} ${game.homeSpreadPrice||'-110'}`}
TOTAL: Over ${game.total||'N/A'} ${game.overPrice||'-110'} / Under ${game.total||'N/A'} ${game.underPrice||'-110'}
${hasF5 ? `FIRST 5 INNINGS (F5): Away ML ${game.f5AwayML||'N/A'} / Home ML ${game.f5HomeML||'N/A'} | F5 Total: Over/Under ${game.f5Total||'N/A'} (Over ${game.f5OverPrice||'N/A'} / Under ${game.f5UnderPrice||'N/A'})` : ''}
CRITICAL: These are the exact current prices. Value is in the juice — -105 vs -130 on the same bet is a massive difference. Factor the actual price when selecting the market.
PITCHING: ${stage1Data.pitchingFacts}
PITCH MIX: ${stage1Data.pitchMixMatchup || 'N/A'}
BULLPEN AVAILABILITY: ${stage1Data.bullpenAvailability || 'N/A'}
PARK FACTOR: ${game.parkFactor || 1.0} — ${game.parkFactorNote || 'Neutral'}
SITUATION: ${stage1Data.situationalFacts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATE ALL ${hasF5 ? 'FOUR' : 'THREE'} MARKETS EQUALLY — NO DEFAULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE — best when:
- Edge is on a FAVORITE and margin is uncertain — close game expected
- UNDERDOG ML: only when the edge is strong enough you genuinely expect them to WIN outright
- If underdog has edge but may lose by 1, default to +1.5. Never default to ML for underdogs.

${isBaseball ? `RUN LINE (-1.5 / +1.5) — best when:
- Favorite winning by multiple runs consistently (3+ run avg margin L10)
- Both starters strong AND both bullpens reliable — multiple run wins likely
- Blowout setup: superior pitcher + inferior offense + hitter-friendly park
- Underdog +1.5: the most undervalued bet in MLB — when underdog is live but not likely to win outright

TOTAL (OVER/UNDER) — best when:
- Park factor strongly skews one way (above 1.10 = over lean; below 0.92 = under lean)
- Wind 10+ mph out to center = significant over push; wind in from center = significant under push
- Umpire has a documented lean toward high or low run environments
- Both starters sharp → under lean; both struggling or short outings expected → over lean
- Bullpen mismatches where one team will chase early, other team will close it out late
- When run environment is the clearest signal — more obvious than who wins

${hasF5 ? `FIRST 5 INNINGS (F5) — use when the edge is specifically in the starters, not the full game:
✅ USE F5 ML WHEN:
- The edge is in one starter's dominance but the bullpen is compromised or unavailable
- Closer or key setup man pitched consecutive days — F5 removes that blown-save risk
- xFIP/SIERA shows a starter is better (or worse) than ERA suggests — first-time-through advantage
- Pitch mix creates a specific first-pass-through-order matchup advantage before lineup adjusts
- Full game ML juice is too high; F5 offers the same directional bet at better value

✅ USE F5 TOTAL WHEN:
- Both starters are rough and expected to be pulled early → early inning scoring is elevated
- Park factor + weather + umpire creates a specific early-inning run environment
- One or both starters have command issues that show up early before they settle in

❌ DO NOT USE F5 JUST BECAUSE IT EXISTS:
- Only choose F5 when the reason you like the bet is specifically starter-driven
- If the edge is in bullpen, lineup, or team strength, full game is the right market` : ''}` : `SPREAD — when dominant team and points for competitive underdog
TOTAL — when run environment (pace, defense) is clearer than the winner`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKET SELECTION RULE:
Pick the market where the edge is CLEAREST and most specific.
Not the market you default to. The market the data actually points to.
A slate should have a natural mix — ML, run line, total, and F5 when appropriate.

SAFER PLAY PRINCIPLE — APPLY BEFORE FINALIZING:
- Underdog? Default to +1.5 BEFORE ML. Only take ML if you expect outright win.
- Heavy favorite (-180+)? Consider -1.5 at lower price if data shows dominance.
- Starter-specific edge + bullpen concerns? F5 is always the cleaner expression.
- Side unclear? Total is the safer play when run environment is the clearest signal.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON:
{
  "selectedMarket": "ML" or "${isBaseball ? 'RUN_LINE' : 'SPREAD'}" or "TOTAL"${hasF5 ? ' or "F5_ML" or "F5_TOTAL"' : ''},
  "pick": "Team name ONLY (e.g. 'Tampa Bay Rays') — OR 'OVER' OR 'UNDER' for totals. NEVER include ML/spread/total in this field.",
  "betType": "Market + price ONLY — e.g. 'ML -125' or '+1.5 -115' or 'UNDER 8.5 -110'. NEVER repeat the team name here — just the market type and price.",
  "mlEvaluation": "One sentence on why ML does or doesn't capture this edge",
  "${isBaseball ? 'runLineEvaluation' : 'spreadEvaluation'}": "One sentence on why the ${isBaseball ? 'run line' : 'spread'} does or doesn't capture this edge",
  "totalEvaluation": "One sentence on why the total does or doesn't capture this edge",
  ${hasF5 ? `"f5Evaluation": "One sentence on whether F5 is the right expression of this edge and why — be specific",` : ''}
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
  const isMLB = (game.sport || 'MLB') === 'MLB';
  const isF5 = stage3Data.selectedMarket === 'F5_ML' || stage3Data.selectedMarket === 'F5_TOTAL';

  return `You are finalizing a betting pick. You have the edge identified and the market selected. Now produce the final verdict in a format any bettor can read and act on immediately.

GAME: ${game.away} @ ${game.home} | ${game.sport} | Slot: ${slot}
EDGE: ${stage2Data.edgeReason}
COUNTER-ARGUMENT: ${stage2Data.counterArgument} — Valid? ${stage2Data.counterValid ? 'YES — account for it' : 'NO — edge stands'}
PICK: ${stage3Data.pick} ${stage3Data.betType}
MARKET REASON: ${stage3Data.marketReason}
${isF5 ? `F5 REASONING: ${stage3Data.f5Evaluation || 'Starter-specific edge — F5 removes bullpen variance'}` : ''}
PUBLIC NARRATIVE: ${stage2Data.publicNarrative || 'N/A'}
PROPAGANDA CHECK (separate from public narrative): ${stage2Data.propagandaCheck}
CONFIDENCE: ${stage2Data.confidence} (${stage2Data.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2Data.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2Data.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2Data.redFlags || []).join(' | ') || 'None listed'}
${isMLB ? `PARK FACTOR: ${game.parkFactor || 1.0} — ${game.parkFactorNote || 'Neutral'}` : ''}
${isVegas ? `SLOT: VEGAS — this is a scam play. State why the public is wrong and what the reality is.` : `SLOT: PUBLIC — go with the trend. The better team should win.`}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
Tier and confidence are a direct readout of the counted RED FLAGS / GREEN FLAGS / ALIGNMENT above — not a separate gut call. Do not assign a tier or confidence number that isn't justified by what you just counted.
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95, scaled by how many green flags support it and how weak the counter is.
- Tier 2: 2 red flags you can each explain away, OR the counter-argument has real validity, OR fewer than 3 green flags. confidencePercent 55-75, scaled by how much doubt remains unresolved.
- Tier 3 / PASS: 3+ red flags, OR one unresolved CRITICAL red flag, OR the counter-argument is as strong as the case for the pick. Should mostly be filtered in Stage 2 — if the flags say PASS, say so here and drop to Tier 3 rather than forcing a pick.
- confidencePercent MUST match the ALIGNMENT score already listed above: a 9/10 alignment with 0 red flags cannot honestly produce 60% confidence, and a 4/10 alignment with 3 red flags cannot honestly produce 90%. If your instinct disagrees with the counted flags, trust the flags and recompute the number.

VERDICT RULES:
- One plain sentence maximum
- Must include: who, what bet, and the single strongest reason
- Example: "Tigers ML +127 — ace is 0-3 with 5.40 ERA in last 4 starts and the public is inflating this line off reputation alone"
- If F5 bet: mention the starter specifically and why F5 is cleaner than full game
- No jargon. No hedging. No "could" or "might". State it like you believe it.
- If VEGAS slot: mention why the public narrative is wrong in the verdict

Return JSON:
{
  "summary": {
    "pick": "Team name ONLY (${game.away} or ${game.home}) or OVER or UNDER. No ML/spread/total here.",
    "betType": "Market type + price ONLY — e.g. ML -125 or +1.5 -110 or UNDER 8.5 -108. Never repeat the team name.",
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
    "_INSTRUCTION": "CRITICAL — every field below must be REASONING, not a restated fact dump, AND it must be SUMMARIZED: maximum 2 sentences per field, lead with the conclusion, no filler or throat-clearing. The deep research already happened — this output is the distilled result, not the working notes. Connect at least two data points into one sharp inferential claim per field. If a field has nothing meaningful, one short sentence saying so — never pad.",
    "signalAlignment": "Compact alignment audit — the one field allowed structure: list green flags and red flags as SHORT PHRASES (5-8 words each, not sentences), then the alignment score, then one sentence on whether unresolved red flags change anything",
    "matchupFoundation": "Who is better in this specific matchup today, and WHY — connect the strongest 2-3 factors into one judgment",
    "recentForm": "What the recent form trend actually means for tonight's matchup specifically",
    "headToHead": "Whether the H2H history is actually predictive here or just noise — explain why",
    "pitching": "START by naming BOTH tonight's starting pitchers (away SP vs home SP) — who is on the mound. Then the pitching matchup including ERA vs xFIP/SIERA comparison if available — flag any regression risk (good ERA with high xFIP = about to decline; bad ERA with low xFIP = about to improve). If either starter is TBD/unconfirmed, say so and note the read is provisional. Connect to tonight's outcome.",
    "advancedMetrics": "${isMLB ? 'xFIP/SIERA gap analysis: is either pitcher masking true performance behind ERA? Pitch mix vs lineup type — does tonight\'s matchup favor or hurt either starter based on what they throw vs what this lineup handles? This is the edge the public never sees.' : 'N/A'}",
    "bullpenAvailability": "${isMLB ? 'Who is actually available in each bullpen tonight based on last 3 days usage? Does the starting pitcher edge survive into the late innings, or is the bullpen a threat to the pick? This is critical for full game vs F5 decision.' : 'N/A'}",
    "parkAndUmpire": "${isMLB ? 'How does the park factor (${game.parkFactor || 1.0}) and tonight\'s umpire combine to affect the run environment — specifically for this bet? Coors inflates all numbers. Pitcher parks deflate them. Tight zone umpires add baserunners. Wide zone umpires add strikeouts. Connect these to the specific pick.' : 'N/A'}",
    "hitterLineup": "Which specific lineup advantage actually matters for this game and why",
    "seriesContext": "How the series situation actually changes tonight's incentives/likely approach. MANDATORY: if this is a 4-game series with a team up 3-0, state whether the 3-0 sweep-completion pattern applies (the 3-0 team wins the finale ~9/10). This pattern does NOT apply to 3-game series or any other series length — confirm series is 4 games before applying.",
    "situational": "The single strongest psychological/situational factor and why it's likely to affect tonight's game",
    "trellRule": "Active or inactive — and if active, explain the actual reasoning for why it applies here",
    "sharpMoney": "What the sharp signal actually implies about who's right, and how much that should move your confidence",
    "publicNarrative": "What the public broadly believes — plain context; note whether it connects to a real edge or is just background noise. Not a fade signal on its own",
    "propaganda": "If real propaganda exists: name the storyline, its polarity (A=hype→fade / B=pile-on→back the maligned side), and how the pick reflects it. If it is just ordinary public narrative with no real propaganda, say that plainly and do NOT invent a fade. Keep public narrative and propaganda distinct",
    "scamPlay": "${isVegas ? 'Why it looks wrong AND why it is actually correct — full reasoning chain' : 'If this is a series finale, explain the scam regardless of slot. Otherwise N/A — public slot'}",
    "gameScript": "How this game is likely to play out and why that script favors this specific bet",
    "marketLogic": "Why this specific market (${stage3Data.selectedMarket}) beats the alternatives — ${isF5 ? 'specifically why F5 is cleaner than full game for this edge' : 'the actual comparison/reasoning'}",
    "edgeStrength": "How strong and specific is the edge, and why — what would have to be true for this to be wrong?"
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
Away: PPG ${game.awayPPG || 'N/A'} OppPPG ${game.awayOppPPG || 'N/A'} PtDiff ${game.awayPointDiff || 'N/A'} Pace(combined PPG) ${game.awayPaceProxy || 'N/A'}
Home: PPG ${game.homePPG || 'N/A'} OppPPG ${game.homeOppPPG || 'N/A'} PtDiff ${game.homePointDiff || 'N/A'} Pace(combined PPG) ${game.homePaceProxy || 'N/A'}
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
{"awayFacts":"3 key facts about away team now — ONLY from data provided above or that you can verify; if a stat shows N/A, do NOT invent a number for it","homeFacts":"3 key facts about home team now — same rule, no invented numbers","recentForm":"away L5 L10 trend AND home L5 L10 trend — who is hot who is cold, from the real form data above","headToHead":"overall H2H AND last time at this home arena result and margin — go to last season if needed","matchupFacts":"scoring matchup from the REAL stats provided: compare each team's PPG (offense), OppPPG (defense), point differential, and combined-PPG pace proxy. A high-pace team vs a low-pace team, or a strong offense vs a weak defense, is a real edge. Use the actual numbers above — do not invent OffRtg/DefRtg or possession-based pace figures that aren't provided","situationalFacts":"rest B2B playoff context injuries — only what's provided","lineFacts":"opening line vs current line, direction of movement, sharp signal, which side public is on, any book disagreement"}

CRITICAL: Every number in your output must come from the data above. If a field shows N/A, that stat is genuinely unavailable — reflect that honestly rather than inventing a plausible-sounding figure. The Pace figure provided is combined points-per-game (a real pace proxy), not possession-based pace — describe it accurately. Stage 2 has web search to fill real gaps; Stage 1 must not guess.`;
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

1b. ⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT" (hard checkpoint):
- The money must match the movement. If public money is heavy on a team, that team's price should get MORE expensive (shorter), not cheaper. When the money is on a team but the line moves the OTHER way, that is REVERSE LINE MOVEMENT — sharp money is on the quiet side against the public. Fade the public, follow the sharp side.
- Run this check on every Vegas-slot game: does line movement direction agree with where the public money is? If not, that mismatch is often exactly where the scam is.

2. SPREAD SCAM: If ML is public, is the scam on the spread? Favorite expected to win but not by the margin priced? Underdog +ATS at live number? If spread also looks public, check the total.

3. TOTAL SCAM: Is the over/under being driven by offensive reputation vs today's defensive matchup? Playoff intensity suppressing scoring the public ignores? Pace mismatch creating a scoring edge?

4. FATIGUE/REST SCAM: B2B team the public ignores. Star player with heavy minutes last game. Road team on 4th game in 6 nights. This is consistently underpriced by the public.

5. MATCHUP REALITY SCAM: Is the "better team" actually better TODAY in this specific matchup? Scheme mismatches, missing defenders, hot role players the public misses?

6. SERIES/DESPERATION SCAM: Desperate team down in series vs complacent leader. Elimination game intensity vs team already thinking about next round.

7. PROPAGANDA SCAM: Media narrative inflating one side. Last game's big performance driving money. Big name player coverage hiding a team that's actually struggling.

7b. ⚡ NARRATIVE-OUTRUNS-REALITY PROPAGANDA (a category with many forms, not one fixed template): Media language that oversells a small or cherry-picked slice of reality as the full picture — glowing superlatives like "looks like his old self," "explosive," "back to dominant form" based on only a handful of recent games, especially after an injury return. But watch for other forms too: a hot rookie getting star framing off a small sample, a new-coach "system bounce" before there's real evidence it's sustainable, "revenge game" or "getting hot at the right time" storylines outrunning the data, absolute historical-streak framing ("this team has never beaten this opponent," "he's never won here"), and recent win/loss stretch framing ("hasn't won in 8 games," "riding a 6-game skid") treated as predictive without checking WHY the stretch happened (schedule strength, injuries, quality of opponents faced) and whether that reason still applies tonight. THE RULE: whenever the story is doing more work than the actual evidence, treat it as a high-value red flag against the hyped side — the opponent wins roughly 9 times out of 10. Distinct from the general narrative/price-inflation check above.

When you find the scam — BET IT. NOTE: sometimes the scam IS on the public side — the public is right but everyone thinks they're wrong. If the data supports the public side, take it confidently. The scam is the mispricing, not automatically the fade. State WHERE the scam is, whether it is WITH or AGAINST the public, and WHAT the bet is.` : `PUBLIC SLOT: Go with the better team. Still scan for fatigue, matchup, and narrative scams.`}

PROPAGANDA FADE: What is ESPN/media pushing? Is the narrative based on recent hot game (sample size trap) or genuine form? Fade the hype, trust the data.

SHARP MONEY & LINE MOVEMENT:
- Opening line vs current line: which direction did it move and by how much?
- If public is heavy on one side but line moved opposite = reverse line movement = sharp money on the other side
- Sharp signal flag: if present, treat as meaningful confirmation
- Book price gaps (FD vs DK) = sharp money already hit one book
- Sharp money is ONE signal — it adds confidence when it aligns, gets noted when it contradicts, never overrides the matchup alone
- SPREAD/TOTAL NUMBER MOVEMENT (distinct from price movement): check whether the spread or total itself has moved (e.g. -4.5 to -6, or 218.5 to 222), not just the price on a fixed number. A real number move of 1+ points usually means significant money, not just price-shopping — treat it as a stronger signal than price-only movement, especially around key numbers.

PASS only when it is a genuine coin flip with no meaningful edge.
- Modest edge = Tier 2. Take it.
- Competitive game with real situational or matchup edge = Tier 2. Take it.
- Only pass when every signal is truly neutral. Passes should be rare.

THE BAR FOR A REAL PICK (not a vague lean dressed up as one): "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling. If you're hedging ("could go either way but leaning X", "slight edge, nothing major"), either dig into the real combination of factors that justifies a clear pick, or actually PASS rather than present a hedge as a pick. Ask: "what would have to be true for this to be wrong?" — if the honest answer is "nothing unusual, basically a coin flip with a story," that's a PASS.

-200+ WARNING: Very high bar to bet a -200 or heavier favorite. Verify every reason holds up TODAY.

${ALIGNMENT_CHECK}

Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence about why this edge exists",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "publicNarrative": "What does the general public broadly believe about this game (which side is popular, the common take)? This is CONTEXT — state it, then say whether it is just context or actually connects to a real edge (e.g. an inflated price). Do NOT treat public belief as a fade signal on its own.",
  "propagandaCheck": "SEPARATE from public narrative: does REAL propaganda exist — a specific media storyline where the narrative outruns the reality for THIS game? If yes, name the exact storyline and CLASSIFY its polarity: POLARITY A = irrational HYPE overselling a side (→ fade the hyped side, back the opponent) OR POLARITY B = irrational negative PILE-ON on a strong team/player whose real matchup edge tonight is still intact (→ back the maligned side, NOT the opponent — the Skenes/Pirates case). Give the directional implication. If there is NO real propaganda, say so plainly — do not relabel ordinary public narrative as propaganda.",
  "playoffContext": "${isPlayoffs ? 'Analyze series situation and elimination implications' : 'Regular season context'}",
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/FORM/PROPAGANDA/SITUATIONAL/PLAYOFF_CONTEXT)' : 'N/A'}",
  ${ALIGNMENT_JSON_FIELDS}
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 derived MECHANICALLY from the redFlags/greenFlags/alignmentScore you just produced in this same JSON — not a separate gut feeling. 0-1 red flags + 3+ green flags = 80-95. 2 explainable red flags = 55-75. 3+ red flags or an unresolved critical one = you should be passing, not assigning a confidence number. Two plays with similar flag counts should get similar numbers; do not vary it on vibes alone.
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
  "pick": "Team name ONLY or OVER or UNDER — never include the market type here.",
  "betType": "Market + price ONLY — e.g. ML -115 or +6.5 -110 or UNDER 218.5 -108. Never repeat the team name.",
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
PUBLIC NARRATIVE: ${stage2.publicNarrative || 'N/A'}
PROPAGANDA (separate from public narrative): ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence} (${stage2.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
Tier and confidence are a direct readout of the counted RED FLAGS / GREEN FLAGS / ALIGNMENT above — not a separate gut call.
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95, scaled by flag strength.
- Tier 2: 2 red flags you can explain away, OR the counter has real validity, OR fewer than 3 green flags. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, OR one unresolved CRITICAL red flag, OR the counter is as strong as the pick's case.
- confidencePercent MUST match the ALIGNMENT score above — don't assign a number the counted flags don't support.

VERDICT: One sentence. Team + bet + strongest reason. Example: "Celtics -4.5 — they've covered by 8+ in 4 straight home games and the Knicks are on a B2B with their best defender questionable."

Return JSON:
{
  "summary": {
    "pick": "Team name ONLY or OVER or UNDER — no market type.",
    "betType": "Market + price ONLY — e.g. ML -108, +4.5 -110, UNDER 218 -110. Never the team name.",
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
    "_INSTRUCTION": "CRITICAL — every field below must be REASONING, not a restated fact dump, AND it must be SUMMARIZED: maximum 2 sentences per field, lead with the conclusion, no filler or throat-clearing. The deep research already happened — this output is the distilled result, not the working notes. Connect at least two data points into one sharp inferential claim per field. If a field has nothing meaningful, one short sentence saying so — never pad.",
    "signalAlignment":"Compact alignment audit — the one field allowed structure: list green flags and red flags as SHORT PHRASES (5-8 words each, not sentences), then the alignment score, then one sentence on whether unresolved red flags change anything",
    "priceVsDataAudit": "THE PRICE PRINCIPLE — answer all three: (1) why is the price set at this exact number and does the data support that belief, (2) if it moved, why is money going toward one side and away from the other and does that make sense, (3) explicit verdict: does the price make sense for this matchup or not",
    "matchupFoundation": "Who is better in this specific matchup today, and WHY — connect the strongest 2-3 factors into one judgment",
    "recentForm": "What the recent form trend actually means for tonight's matchup specifically — not just the numbers restated",
    "headToHead": "Whether the H2H history is actually predictive here or just noise, and why",
    "paceRatings": "What the pace/rating mismatch actually means for how this game plays out — not just both numbers listed",
    "situational": "The single strongest situational factor (rest, B2B, injuries, playoff stakes) and why it's likely to actually affect tonight's game",
    "trellRule": "Active or inactive — if active, explain the actual reasoning for why it applies here",
    "sharpMoney": "What the sharp signal actually implies about who's right and how much that should move your confidence — not just restating the line move",
    "lineMovement": "What the line movement direction actually signals (public trap vs sharp action) and why that matters here",
    "publicNarrative": "What the public broadly believes — plain context; note whether it connects to a real edge or is just background noise. Not a fade signal on its own",
    "propaganda": "If real propaganda exists: name the storyline, its polarity (A=hype→fade / B=pile-on→back the maligned side), and how the pick reflects it. If it is just ordinary public narrative with no real propaganda, say that plainly and do NOT invent a fade. Keep public narrative and propaganda distinct",
    "scamPlay": "${isVegas ? 'WHERE is the scam hiding in this game — pitching reputation vs reality, form scam, situational scam, line scam, matchup scam? State what the public is wrong about and what the data actually shows, with the full reasoning chain.' : 'N/A'}",
    "gameScript": "How this game is likely to play out and why that script favors this specific bet",
    "marketLogic": "Why this specific market beats the alternatives — the actual comparison, not just the conclusion",
    "edgeStrength": "How strong and specific is the edge, and why — what would have to be true for this to be wrong?"
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

1b. ⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT" (hard checkpoint):
- The money must match the movement. If public money is heavy on a team, that team's price should get MORE expensive (shorter), not cheaper. When the money is on a team but the line moves the OTHER way, that is REVERSE LINE MOVEMENT — sharp money is on the quiet side against the public. Fade the public, follow the sharp side.
- Run this check on every Vegas-slot game: does line movement direction agree with where the public money is? If not, that mismatch is often exactly where the scam is.

2. SPREAD SCAM: If ML is public, is the scam on the spread? Underdog covering even in a loss? Key number positioning (-3, -7, -10)? Favorite priced to win big but scheme says otherwise?

3. TOTAL SCAM: Weather the public ignored (wind, cold, rain). Defensive scheme mismatch. Short week fatigue suppressing offense. Divisional game — these run lower than expected.

4. QB SCAM: QB reputation vs current form. Banged up QB still priced like elite. Backup QB the market overreacted to. Defense that specifically neutralizes this QB's strengths.

5. INJURY SCAM: Key injury the public glossed over in the report. O-line injuries that don't make headlines but destroy the run game. Top CB out making a wide receiver suddenly relevant.

6. SITUATIONAL SCAM: Letdown spot after emotional win. Divisional dog — they always keep it close. Short week disadvantage. Team with nothing to play for vs team desperate for playoff positioning.

7. PROPAGANDA SCAM: National TV narrative inflating one side. Last week's blowout driving money. "Hot team" label applied to a team that benefited from weak schedule.

7b. ⚡ NARRATIVE-OUTRUNS-REALITY PROPAGANDA (a category with many forms, not one fixed template): Media language that oversells a small or cherry-picked slice of reality as the full picture — glowing superlatives like "looks like his old self," "dominant," "fully healthy and explosive" describing a QB or star skill player based on only 1-2 recent games, especially after an injury return. But watch for other forms too: a backup QB "system bounce" getting overstated, a "revenge game" or "getting hot at the right time" storyline outrunning the data, a new coordinator's early results being extrapolated too far, absolute historical-streak framing ("this team has never beaten this opponent," "he's never won here"), and recent win/loss stretch framing ("hasn't won in 8 games," "riding a 6-game skid") treated as predictive without checking WHY the stretch happened (schedule strength, injuries, quality of opponents faced) and whether that reason still applies tonight. THE RULE: whenever the story is doing more work than the actual evidence, treat it as a high-value red flag against the hyped side — the opponent wins roughly 9 times out of 10. Distinct from the general narrative/price-inflation check above.

When you find the scam — BET IT. NOTE: sometimes the scam IS on the public side — everyone fading the public creates value ON the public side when the data supports them. The scam is wherever the mispricing is. State WHERE the scam is, whether it is WITH or AGAINST the public, and WHAT the bet is.` : `PUBLIC SLOT: Go with the better team. Still scan for QB, injury, weather, and situational scams.`}

PROPAGANDA FADE: What are NFL analysts/ESPN pushing? Is it based on one big performance (sample size) or genuine form? Fade the hype.

SHARP MONEY: One signal. Confirms the read, doesn't create it.

SPREAD/TOTAL NUMBER MOVEMENT (distinct from price movement): check whether the spread or total itself has moved (e.g. -3 to -4.5, crossing a key number, or 44.5 to 47), not just the price on a fixed number. Key numbers (3, 7) matter enormously in NFL — a spread crossing one of these is a much bigger signal than a half-point move elsewhere. A real number move usually means significant money, not just price-shopping.

PASS only when it is a genuine coin flip with no meaningful edge. Modest or situational edges = Tier 2, take them. Passes should be rare — 2-3 per slate max.

THE BAR FOR A REAL PICK (not a vague lean dressed up as one): "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling. If you're hedging ("could go either way but leaning X", "slight edge, nothing major"), either dig into the real combination of factors that justifies a clear pick, or actually PASS rather than present a hedge as a pick. Ask: "what would have to be true for this to be wrong?" — if the honest answer is "nothing unusual, basically a coin flip with a story," that's a PASS.


${ALIGNMENT_CHECK}
Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "WEATHER" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "publicNarrative": "What does the general public broadly believe about this game (which side is popular, the common take)? This is CONTEXT — state it, then say whether it is just context or actually connects to a real edge (e.g. an inflated price). Do NOT treat public belief as a fade signal on its own.",
  "propagandaCheck": "SEPARATE from public narrative: does REAL propaganda exist — a specific media storyline where the narrative outruns the reality for THIS game? If yes, name the exact storyline and CLASSIFY its polarity: POLARITY A = irrational HYPE overselling a side (→ fade the hyped side, back the opponent) OR POLARITY B = irrational negative PILE-ON on a strong team/player whose real matchup edge tonight is still intact (→ back the maligned side, NOT the opponent — the Skenes/Pirates case). Give the directional implication. If there is NO real propaganda, say so plainly — do not relabel ordinary public narrative as propaganda.",
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/FORM/PROPAGANDA/SITUATIONAL/WEATHER)' : 'N/A'}",
  ${ALIGNMENT_JSON_FIELDS}
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 derived MECHANICALLY from the redFlags/greenFlags/alignmentScore you just produced in this same JSON — not a separate gut feeling. 0-1 red flags + 3+ green flags = 80-95. 2 explainable red flags = 55-75. 3+ red flags or an unresolved critical one = you should be passing, not assigning a confidence number. Two plays with similar flag counts should get similar numbers; do not vary it on vibes alone.
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
  "pick": "Team name ONLY or OVER or UNDER — never include the market type here.",
  "betType": "Market + price ONLY — e.g. ML +145 or -3.5 -110 or UNDER 44.5 -108. Never the team name.",
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
PUBLIC NARRATIVE: ${stage2.publicNarrative || 'N/A'}
PROPAGANDA (separate from public narrative): ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence} (${stage2.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
Tier and confidence are a direct readout of the counted RED FLAGS / GREEN FLAGS / ALIGNMENT above — not a separate gut call.
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95, scaled by flag strength.
- Tier 2: 2 red flags you can explain away, OR the counter has real validity, OR fewer than 3 green flags. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, OR one unresolved CRITICAL red flag, OR the counter is as strong as the pick's case.
- confidencePercent MUST match the ALIGNMENT score above — don't assign a number the counted flags don't support.

VERDICT: One sentence. Team + bet + strongest reason. Example: "Bears +7 — their defense is top-5 against the run and the Packers are missing their top two receivers, making this a field goal game at most."

Return JSON:
{
  "summary": {
    "pick": "Team name ONLY or OVER or UNDER — no market type.",
    "betType": "Market + price ONLY — e.g. ML -108, +4.5 -110, UNDER 218 -110. Never the team name.",
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
    "_INSTRUCTION": "CRITICAL — every field below must be REASONING, not a restated fact dump, AND it must be SUMMARIZED: maximum 2 sentences per field, lead with the conclusion, no filler or throat-clearing. The deep research already happened — this output is the distilled result, not the working notes. Connect at least two data points into one sharp inferential claim per field. If a field has nothing meaningful, one short sentence saying so — never pad.",
    "signalAlignment":"Compact alignment audit — the one field allowed structure: list green flags and red flags as SHORT PHRASES (5-8 words each, not sentences), then the alignment score, then one sentence on whether unresolved red flags change anything",
    "priceVsDataAudit": "THE PRICE PRINCIPLE — answer all three: (1) why is the price set at this exact number and does the data support that belief, (2) if it moved, why is money going toward one side and away from the other and does that make sense, (3) explicit verdict: does the price make sense for this matchup or not",
    "matchupFoundation": "The key schematic matchup today, and WHY it favors one side — connect strength vs weakness into one judgment",
    "recentForm": "What the recent form trend actually means for this matchup specifically — not just the numbers restated",
    "headToHead": "Whether the H2H/venue history is actually predictive here or just noise, and why",
    "qbMatchup": "What the QB situation actually means for how this game plays out — not just both QBs' status listed",
    "injuries": "How the key injury actually changes the matchup, not just who's out",
    "weather": "How the weather actually changes the gameplan/total, if relevant — not just the forecast",
    "situational": "The single strongest situational factor (week context, divisional, motivation) and why it's likely to actually affect this game",
    "trellRule": "Active or inactive — if active, explain the actual reasoning for why it applies here",
    "sharpMoney": "What the sharp signal actually implies about who's right and how much that should move your confidence",
    "publicNarrative": "What the public broadly believes — plain context; note whether it connects to a real edge or is just background noise. Not a fade signal on its own",
    "propaganda": "If real propaganda exists: name the storyline, its polarity (A=hype→fade / B=pile-on→back the maligned side), and how the pick reflects it. If it is just ordinary public narrative with no real propaganda, say that plainly and do NOT invent a fade. Keep public narrative and propaganda distinct",
    "scamPlay": "${isVegas ? 'WHERE is the scam hiding in this game — reputation vs reality, form scam, situational scam, line scam, matchup scam? State what the public is wrong about and what the data actually shows, with the full reasoning chain.' : 'N/A'}",
    "gameScript": "How this game is likely to play out and why that script favors this specific bet",
    "marketLogic": "Why this specific market beats the alternatives — the actual comparison, not just the conclusion",
    "edgeStrength": "How strong and specific is the edge, and why — what would have to be true for this to be wrong?"
  },
  "finalVerdict": "Same as summary.verdict"
}`;
}


// ═════════════════════════════════════════════════════════════════════════════
// CFB ENGINE
// College football logic: AP rank as a first-class signal, rank/record/streak
// vs. price gap as the primary edge, slot-aware sensitivity (same PUBLIC/VEGAS
// admin pattern as NFL/NBA/MLB).
// ═════════════════════════════════════════════════════════════════════════════

export function buildCFBStage1Prompt(game) {
  return `Summarize this college football game. No picks. Just facts. Return ONLY valid JSON.

${game.away} (${game.awayRank ? `#${game.awayRank}` : 'unranked'}) @ ${game.home} (${game.homeRank ? `#${game.homeRank}` : 'unranked'}) | ${game.time} | Slot: ${game.slot || 'PUBLIC'}
Records: Away ${game.awayRecord || 'N/A'} (Road ${game.awayAwayRecord || 'N/A'}) | Home ${game.homeRecord || 'N/A'} (Home ${game.homeHomeRecord || 'N/A'})
Form: Away L5 ${game.awayLast5 || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'}
Injuries: ${game.injuries || 'None reported'} | Weather: ${game.weather || 'N/A'}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}
Week: ${game.week || 'N/A'}

Return ONLY this JSON:
{"awayFacts":"3 key facts about away team now — rank record injuries form","homeFacts":"3 key facts about home team now — rank record injuries form","rankGap":"both teams' rank (or unranked) and what the gap implies about the price","recentForm":"away L5 trend AND home L5 trend — who is playing well right now","headToHead":"H2H record and pattern, or 'no meaningful history' if these teams rarely meet","matchupFacts":"key schematic matchup — how each team's strength exploits the other's weakness","situationalFacts":"weather week context rivalry rest injuries","lineFacts":"movement sharp signal book gaps"}`;
}

export function buildCFBStage2Prompt(game, stage1) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `You are a professional college football bettor. Answer ONE honest question: does a real betting edge exist in this game?

GAME: ${game.away} (${game.awayRank ? `#${game.awayRank}` : 'unranked'}) @ ${game.home} (${game.homeRank ? `#${game.homeRank}` : 'unranked'}) | CFB | Slot: ${slot}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}

FACTS:
Away: ${stage1.awayFacts}
Home: ${stage1.homeFacts}
Rank Gap: ${stage1.rankGap}
Recent Form: ${stage1.recentForm}
H2H: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Line Movement: ${game.lineMovement || stage1.lineFacts || 'None'}
Sharp Signal: ${game.sharpSignal || 'None'}
Opening vs Current: Away opened ${game.openingAwayML || 'N/A'} now ${game.awayML || 'N/A'} | Home opened ${game.openingHomeML || 'N/A'} now ${game.homeML || 'N/A'}
CRITICAL: These are the exact current prices. Factor actual juice when picking market.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLLEGE FOOTBALL-SPECIFIC EDGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RANK IS A FIRST-CLASS SIGNAL: college football is driven by the AP Top 25 in a way pro sports aren't. Always state both teams' rank (or "unranked") explicitly. A large rank gap paired with a small line, or a small rank gap paired with a large line, is a direct signal on its own — name it.

THE PRIMARY EDGE RULE — GAP BETWEEN WHAT THE LINE SHOULD BE AND WHAT IT IS: work out what the spread/total SHOULD be from the fundamentals alone (rank, record, streak, recent scoring, home/away split) — ignore the posted line while doing this. Then compare to the ACTUAL posted line. A big gap between "what it should be" and "what it is" is the edge, regardless of direction. Example: an unranked team on a long losing streak, on the road, against a ranked home team — fundamentals alone suggest a 3+ touchdown spread. If the actual line is much tighter, that gap (not the underdog tag itself) is the signal.

EVENLY MATCHED IS A REAL OUTCOME: two ranked teams with similar records, similar recent scoring margins, and a line near pick'em are genuinely close — there is no edge to manufacture. The "obvious" side IS the public side here, and that's fine; don't force a scam narrative onto a fair line.

PUBLIC MONEY CROSS-CHECK: where bet%/money% data is available, treat 90%+ of the money on one side (consistent across books) as strong confirmation of which side IS the public side — the side a Vegas slot should be built to fade. Do not invent a number if the data is unavailable.

TOTAL SIGNAL: if both teams have been scoring heavily recently and the posted total looks low relative to that pace, the total itself may be the scam (the number gets shaded under where recent games actually landed). The reverse also applies — a total priced high off reputation alone, with an elite-defense or bad-weather context, is a fade-the-total spot too.

TRELL RULE: Star player's first game out → bet ON that team. First game back → bet AGAINST.

${isVegas ? `VEGAS SLOT — FIND WHERE THE SCAM IS HIDING. CHECK EVERY LAYER:

1. RANK SCAM: Is the market pricing the rank gap honestly, or is a lower-ranked/road/cold-streak team getting an artificially tight line that hides a real mismatch?

2. ML SCAM: Is the ML a public trap? A ranked/marquee team overpriced on brand or narrative?

1b. ⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT": if public money is heavy on a team, that team's price should shorten, not drift. When money is on one side but the line moves the other way, that's reverse line movement — sharp money is on the quiet side. Fade the public, follow the sharp side.

3. SPREAD SCAM: Is the spread hiding the true favorite to cap the payout — a team that "should" be favored by a lot instead priced as only a small favorite (or even a live underdog)?

4. TOTAL SCAM: Recent combined scoring pace vs. the posted total — is the number set to exploit which way the public leans?

5. INJURY SCAM: A real injury the public glossed over, or overreacted to.

6. SITUATIONAL SCAM: Rivalry game, letdown spot after an emotional win, short week, or a team the public has written off after one bad loss that the fundamentals don't actually support writing off.

7. PROPAGANDA SCAM: National TV narrative inflating one side off a small sample.

When you find the scam — BET IT. State WHERE the scam is, whether it is WITH or AGAINST the public, and WHAT the bet is.` : `PUBLIC SLOT: Go with the better/higher-ranked team as expected. Still scan for rank, injury, weather, and situational scams — only flag a public slot if the data actively contradicts the favorite.`}

PROPAGANDA FADE: What are CFB analysts pushing? Is it based on one big performance or genuine sustained form? Fade the hype.

SHARP MONEY: One signal. Confirms the read, doesn't create it.

PASS only when it is a genuine coin flip with no meaningful edge — two evenly matched ranked teams near pick'em is a legitimate PASS, not a game to force a scam narrative onto. Modest or situational edges = Tier 2, take them. Passes should be common on a 50+ game Saturday slate — most games are not worth a play.

THE BAR FOR A REAL PICK: "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling. Ask: "what would have to be true for this to be wrong?" — if the honest answer is "nothing unusual, basically a coin flip with a story," that's a PASS.

${ALIGNMENT_CHECK}
Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "RANK" or "MATCHUP" or "SITUATIONAL" or "PRICE" or "SCAM" or "PROPAGANDA" or "TRELL" or "WEATHER" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "publicNarrative": "What does the general public broadly believe about this game? This is CONTEXT — state it, then say whether it is just context or actually connects to a real edge. Do NOT treat public belief as a fade signal on its own.",
  "propagandaCheck": "SEPARATE from public narrative: does REAL propaganda exist? If yes, name the exact storyline and CLASSIFY its polarity: POLARITY A = irrational HYPE (→ fade the hyped side) OR POLARITY B = irrational negative PILE-ON on a strong team whose real matchup edge tonight is still intact (→ back the maligned side). If there is NO real propaganda, say so plainly.",
  "scamLayer": "${isVegas ? 'Which layer the scam was found in (RANK/ML/SPREAD/TOTAL/FORM/PROPAGANDA/SITUATIONAL/WEATHER)' : 'N/A'}",
  ${ALIGNMENT_JSON_FIELDS}
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 derived MECHANICALLY from the redFlags/greenFlags/alignmentScore you just produced in this same JSON — not a separate gut feeling. 0-1 red flags + 3+ green flags = 80-95. 2 explainable red flags = 55-75. 3+ red flags or an unresolved critical one = you should be passing, not assigning a confidence number.
}`;
}

export function buildCFBStage3Prompt(game, stage1, stage2) {
  return `You identified a real edge. Now pick the best market.

GAME: ${game.away} @ ${game.home} | CFB
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
MATCHUP: ${stage1.matchupFacts}

COLLEGE FOOTBALL MARKET LOGIC:

MONEYLINE: For favorites in close games. For underdogs — DEFAULT to +ATS spread first unless the edge is overwhelming; getting the points costs almost nothing and wins more long-term.

SPREAD: The primary CFB market. Take the favorite to cover when the rank/record/streak gap is real AND the price hasn't already absorbed the full mismatch (spread -7 or better = lower bar; -10+ = higher bar, the market may have already priced in the blowout). Take the underdog's points when the two teams are genuinely close on rank/record/recent scoring margin, or when the posted spread is clearly larger than the fundamentals support.

TOTAL: Best when recent scoring pace or matchup context (elite defense, bad weather, ball-control team) strongly points to a scoring direction the posted number doesn't reflect.

No defaults. Pick where the edge is clearest.

Return JSON:
{
  "selectedMarket": "ML" or "SPREAD" or "TOTAL",
  "pick": "Team name ONLY or OVER or UNDER — never include the market type here.",
  "betType": "Market + price ONLY — e.g. ML +145 or -3.5 -110 or UNDER 54.5 -108. Never the team name.",
  "mlEvaluation": "Why ML does or doesn't capture this edge",
  "spreadEvaluation": "Why the spread does or doesn't capture this edge",
  "totalEvaluation": "Why the total does or doesn't capture this edge",
  "marketReason": "Why THIS market is the best expression"
}`;
}

export function buildCFBStage4Prompt(game, stage1, stage2, stage3) {
  const slot = game.slot || 'PUBLIC';
  const isVegas = slot === 'VEGAS';

  return `Finalize the pick. One clean sentence any bettor can read and act on immediately.

GAME: ${game.away} @ ${game.home} | CFB | Slot: ${slot}
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType}
WHY THIS MARKET: ${stage3.marketReason}
PUBLIC NARRATIVE: ${stage2.publicNarrative || 'N/A'}
PROPAGANDA: ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence} (${stage2.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95.
- Tier 2: 2 red flags you can explain away, OR the counter has real validity, OR fewer than 3 green flags. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, OR one unresolved CRITICAL red flag, OR the counter is as strong as the pick's case.

VERDICT: One sentence. Team + bet + strongest reason.

Return JSON:
{
  "summary": {
    "pick": "Team name ONLY or OVER or UNDER — no market type.",
    "betType": "Market + price ONLY.",
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
    "_INSTRUCTION": "CRITICAL — every field below must be REASONING, not a restated fact dump, AND SUMMARIZED: maximum 2 sentences per field, lead with the conclusion, no filler.",
    "signalAlignment":"Compact alignment audit — green flags and red flags as SHORT PHRASES (5-8 words each), then the alignment score, then one sentence on whether unresolved red flags change anything",
    "priceVsDataAudit": "Why is the price set at this exact number, does the data support that belief, and does the price make sense for this matchup or not",
    "rankGap": "Both teams' rank and what the gap implies about the price",
    "matchupFoundation": "The key schematic matchup today, and WHY it favors one side",
    "recentForm": "What the recent form trend actually means for this matchup specifically",
    "headToHead": "Whether H2H is actually predictive here or just noise, and why",
    "injuries": "How the key injury actually changes the matchup, not just who's out",
    "weather": "How the weather actually changes the gameplan/total, if relevant",
    "situational": "The single strongest situational factor (rivalry, rest, motivation) and why it's likely to actually affect this game",
    "trellRule": "Active or inactive — if active, explain the actual reasoning",
    "sharpMoney": "What the sharp signal actually implies and how much that should move your confidence",
    "publicNarrative": "What the public broadly believes — plain context; note whether it connects to a real edge or is just background noise",
    "propaganda": "If real propaganda exists: name the storyline, its polarity, and how the pick reflects it. If not, say so plainly",
    "scamPlay": "${isVegas ? 'WHERE is the scam hiding — rank scam, form scam, situational scam, line scam? State what the public is wrong about.' : 'N/A'}",
    "gameScript": "How this game is likely to play out and why that script favors this specific bet",
    "marketLogic": "Why this specific market beats the alternatives",
    "edgeStrength": "How strong and specific is the edge — what would have to be true for this to be wrong?"
  },
  "finalVerdict": "Same as summary.verdict"
}`;
}


// ═════════════════════════════════════════════════════════════════════════════
// CBB ENGINE
// College basketball logic: NO admin slot system — ranked-vs-unranked status
// IS the orientation (mentorship source: "you're not necessarily in that
// slot... looking at volume, history, storylines"), decided inside Stage 2
// itself rather than externally assigned. Distinctive signals: the "Trojan
// horse" small-spread scam, full-history vs short-streak weighting, neutral
// site awareness, the sequential give-back pattern, and a mandatory money-
// confirmation gate before finalizing any pick.
// ═════════════════════════════════════════════════════════════════════════════

export function buildCBBStage1Prompt(game) {
  return `Summarize this college basketball game. No picks. Just facts. Return ONLY valid JSON.

${game.away} (${game.awayRank ? `#${game.awayRank}` : 'unranked'}) @ ${game.home} (${game.homeRank ? `#${game.homeRank}` : 'unranked'}) | ${game.time}${game.isNeutralSite ? ' | NEUTRAL SITE' : ''}
Records: Away ${game.awayRecord || 'N/A'} (Road ${game.awayAwayRecord || 'N/A'}) | Home ${game.homeRecord || 'N/A'} (Home ${game.homeHomeRecord || 'N/A'})
Form: Away L5 ${game.awayLast5 || 'N/A'} | Home L5 ${game.homeLast5 || 'N/A'}
H2H: ${game.h2hLast5 || 'N/A'}
Injuries: ${game.injuries || 'None reported'}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}
Bet %: ${game.betPercentage || 'N/A'} | Money %: ${game.moneyPercentage || 'N/A'}

Return ONLY this JSON:
{"awayFacts":"3 key facts about away team now — rank record injuries form","homeFacts":"3 key facts about home team now — rank record injuries form","rankGap":"both teams' rank (or unranked) and what the gap implies about the price","recentForm":"away L5 trend AND home L5 trend, AND full-history record — flag if a short streak conflicts with the larger sample","headToHead":"H2H record and pattern, or 'no meaningful history' if these teams rarely meet — a real rivalry pattern matters more here than in most sports","matchupFacts":"key schematic matchup — how each team's strength exploits the other's weakness","situationalFacts":"neutral site status, rest, any recent heavily-public-backed loss either team just took","lineFacts":"movement sharp signal book gaps"}`;
}

export function buildCBBStage2Prompt(game, stage1) {
  const isRanked = !!(game.awayRank || game.homeRank);

  return `You are a professional college basketball bettor. Does a real betting edge exist in this game? There is no admin-assigned slot for this sport — YOU decide the right level of scrutiny based on whether this game is ranked.

GAME: ${game.away} (${game.awayRank ? `#${game.awayRank}` : 'unranked'}) @ ${game.home} (${game.homeRank ? `#${game.homeRank}` : 'unranked'})${game.isNeutralSite ? ' | NEUTRAL SITE' : ''}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
BET %: ${game.betPercentage || 'N/A'} | MONEY %: ${game.moneyPercentage || 'N/A'}

FACTS:
Away: ${stage1.awayFacts}
Home: ${stage1.homeFacts}
Rank Gap: ${stage1.rankGap}
Recent Form: ${stage1.recentForm}
H2H: ${stage1.headToHead}
Matchup: ${stage1.matchupFacts}
Situation: ${stage1.situationalFacts}
Line Movement: ${game.lineMovement || stage1.lineFacts || 'None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — SET YOUR ORIENTATION FIRST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This game is currently: ${isRanked ? 'RANKED (at least one team in the Top 25)' : 'UNRANKED (both teams unranked)'}.
${isRanked
  ? 'Ranked games concentrate the media narrative and the scam potential — apply FULL scrutiny below. Work through every check before trusting the obvious side.'
  : 'Both teams are unranked — lean toward trusting the public/favorite read UNLESS the data actively contradicts it. Do not manufacture a scam where the fundamentals and the price already agree.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLLEGE BASKETBALL-SPECIFIC EDGES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FULL-HISTORY VS SHORT-STREAK: a 2-game winning streak or winning the last 2 head-to-head meetings can distract from a much stronger signal — a team that has historically dominated the series, or has a real home-court edge, shouldn't lose favorite status just because of a short recent blip in the other direction. Weigh the full sample, not just the most recent data point.

THE "TROJAN HORSE" SIGNAL — the single most important pattern in CBB: when a team that SHOULD be a big favorite by the fundamentals (higher rank, home, winning streak, health advantage) is instead priced as only a SMALL favorite or even a small underdog, that small line is not humility — it's the book hiding a big favorite to cap the payout. Conversely, a team getting all the attention (new star back, hot streak) priced as only a modest favorite despite the hype is itself suspicious — check whether the "boring" team on the other side actually has the stronger underlying case once you account for location, full H2H history, and the size of the line relative to what the story implies. When the "obvious" side is only lightly favored despite a story that implies a blowout, the other side is live.

NEUTRAL SITE CHECK: if isNeutralSite is true, there is NO home-court edge — treat both teams as road teams for that factor. Do not assume standard home-court advantage.

SEQUENTIAL "GIVE-BACK" PATTERN: check whether either team just suffered a bad loss as a heavy public favorite (lots of public money, lost outright or got blown out against a big spread). If so, the public gets burned and starts fading that team next time out — which sets up exactly the spot where the team bounces back and covers/wins, because less public money is on them this time. A team coming off one bad, heavily-bet loss is a real bounce-back candidate in their very next game, especially if the underlying team quality hasn't actually changed (same injuries, same rank tier) — don't let one ugly loss convince you the team is suddenly bad.

RIVALRY / H2H PATTERN: college rivalries run deep. A real head-to-head pattern is a meaningful signal; a thin or nonexistent H2H sample should NOT be leaned on.

TRELL RULE: Star player's first game out → bet ON that team. First game back → bet AGAINST.

${isRanked ? `RANKED GAME — FIND WHERE THE SCAM IS HIDING. CHECK EVERY LAYER:

1. RANK SCAM: Is the market pricing the rank gap honestly, or hiding a mismatch behind an artificially tight line (the Trojan horse signal above)?
2. TOTAL SCAM: Recent combined scoring pace vs. the posted total.
3. SITUATIONAL SCAM: The give-back pattern, a rivalry angle, or a letdown spot the public is ignoring.
4. PROPAGANDA SCAM: A headline-friendly story ("[Team] figures it out") papering over what's actually a continuation of a scam pattern, especially right after a sequential give-back game.

When you find the scam — BET IT. State WHERE the scam is and WHAT the bet is.` : `UNRANKED GAME: go with the better/favored team as expected. Still scan for a real Trojan-horse mispricing or give-back pattern — only flag if the data actively contradicts the favorite.`}

⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT": if public money is heavy on a team, that team's price should shorten, not drift. A mismatch is often exactly where the edge is.

MANDATORY MONEY CONFIRMATION — DO NOT SKIP: even when the story (rank/streak/line reasoning) points one way, check the actual bet%/money% split before finalizing. If the story says one side but the money clearly says the other, you do NOT have a lock — pass or downgrade confidence. Only finalize a strong tier when the story AND the money agree.

PASS often. Most games — especially unranked ones where the fundamentals and the price already agree — are not worth a play. The edge is concentrated in ranked games where a small line hides a real favorite, or where a team is bouncing back the game right after the public got burned trusting them.

THE BAR FOR A REAL PICK: "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling.

${ALIGNMENT_CHECK}
Return JSON:
{
  "edgeExists": true or false,
  "edgeType": "RANK" or "TROJAN_HORSE" or "GIVE_BACK" or "MATCHUP" or "SITUATIONAL" or "PRICE" or "PROPAGANDA" or "TRELL" or "NONE",
  "edgeSide": "${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS",
  "edgeReason": "One specific concrete sentence",
  "counterArgument": "Strongest argument against this edge",
  "counterValid": true or false,
  "passReason": "If passing, why. If playing, null.",
  "moneyConfirmation": "Does the bet%/money% split agree with the story? MANDATORY — if it disagrees, say so explicitly here and reflect that in confidence/tier.",
  "publicNarrative": "What does the general public broadly believe about this game? This is CONTEXT — state it, then say whether it connects to a real edge.",
  "propagandaCheck": "SEPARATE from public narrative: does REAL propaganda exist? If yes, name the exact storyline and CLASSIFY its polarity: POLARITY A = irrational HYPE (→ fade the hyped side) OR POLARITY B = irrational negative PILE-ON on a strong team whose real matchup edge tonight is still intact (→ back the maligned side). If none, say so plainly.",
  "scamLayer": "${isRanked ? 'Which layer the scam was found in (RANK/TOTAL/SITUATIONAL/PROPAGANDA) or NONE' : 'N/A'}",
  ${ALIGNMENT_JSON_FIELDS}
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "confidencePercent": A number 0-100 derived MECHANICALLY from the redFlags/greenFlags/alignmentScore you just produced — 0-1 red flags + 3+ green flags = 80-95. 2 explainable red flags = 55-75. 3+ red flags or an unresolved critical one (including a money-confirmation mismatch) = you should be passing, not assigning a confidence number.
}`;
}

export function buildCBBStage3Prompt(game, stage1, stage2) {
  return `You identified a real edge. Now pick the best market.

GAME: ${game.away} @ ${game.home} | CBB
EDGE: ${stage2.edgeReason}
EDGE SIDE: ${stage2.edgeSide}
MONEYLINE: Away ${game.awayML || 'N/A'} / Home ${game.homeML || 'N/A'}
SPREAD: ${game.spread || 'N/A'} | TOTAL: ${game.total || 'N/A'}
MATCHUP: ${stage1.matchupFacts}

COLLEGE BASKETBALL MARKET LOGIC:

SPREAD (favorite): take it when the full-history/rank/health picture is clear AND the price hasn't already absorbed the mismatch.
SPREAD/ML (underdog): take it when the Trojan-horse signal applies — a suspiciously small line on what should be a big favorite means the underdog on paper is live.
TOTAL: use recent scoring pace and pace-of-play context; don't force a total pick when the side is the clearer edge.

No defaults. Pick where the edge is clearest.

Return JSON:
{
  "selectedMarket": "ML" or "SPREAD" or "TOTAL",
  "pick": "Team name ONLY or OVER or UNDER — never include the market type here.",
  "betType": "Market + price ONLY — e.g. ML +145 or -3.5 -110 or UNDER 142.5 -108. Never the team name.",
  "mlEvaluation": "Why ML does or doesn't capture this edge",
  "spreadEvaluation": "Why the spread does or doesn't capture this edge",
  "totalEvaluation": "Why the total does or doesn't capture this edge",
  "marketReason": "Why THIS market is the best expression"
}`;
}

export function buildCBBStage4Prompt(game, stage1, stage2, stage3) {
  return `Finalize the pick. One clean sentence any bettor can read and act on immediately.

GAME: ${game.away} @ ${game.home} | CBB
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
MONEY CONFIRMATION: ${stage2.moneyConfirmation || 'N/A'}
PICK: ${stage3.pick} ${stage3.betType}
WHY THIS MARKET: ${stage3.marketReason}
PUBLIC NARRATIVE: ${stage2.publicNarrative || 'N/A'}
PROPAGANDA: ${stage2.propagandaCheck}
CONFIDENCE: ${stage2.confidence} (${stage2.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND money confirmation agrees AND the counter-argument does not hold. confidencePercent 80-95.
- Tier 2: 2 red flags you can explain away, OR money confirmation is mixed, OR the counter has real validity. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, money confirmation disagrees with the story, OR the counter is as strong as the pick's case.

VERDICT: One sentence. Team + bet + strongest reason.

Return JSON:
{
  "summary": {
    "pick": "Team name ONLY or OVER or UNDER — no market type.",
    "betType": "Market + price ONLY.",
    "tier": "1" or "2" or "3",
    "tierLabel": "LOCK" or "Tier 2" or "PASS",
    "slot": "CBB",
    "confidence": "${stage2.confidence}",
    "confidencePercent": ${stage2.confidencePercent ?? 'null'},
    "scamLayer": ${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},
    "isScamPlay": ${!!(game.awayRank || game.homeRank)},
    "verdict": "ONE plain sentence — pick + strongest reason",
    "signalCount": "X of 8 signals",
    "propagandaFade": true or false
  },
  "analysis": {
    "_INSTRUCTION": "CRITICAL — every field below must be REASONING, not a restated fact dump, AND SUMMARIZED: maximum 2 sentences per field, lead with the conclusion, no filler.",
    "signalAlignment": "Compact alignment audit — green flags and red flags as SHORT PHRASES (5-8 words each), then the alignment score, then one sentence on whether unresolved red flags change anything",
    "priceVsDataAudit": "Why is the price set at this exact number, does the data support that belief, and does the price make sense for this matchup or not",
    "rankGap": "Both teams' rank and what the gap implies about the price",
    "trojanHorseCheck": "Is a true favorite being hidden behind a suspiciously small line? State which side benefits, or say the line looks fair.",
    "matchupFoundation": "The key schematic matchup today, and WHY it favors one side",
    "recentForm": "What the recent form trend actually means, and full-history vs short-streak weighting",
    "headToHead": "Whether H2H is actually predictive here or just noise, and why",
    "neutralSite": "State whether this is a neutral site and how that changes the home-court read, or 'N/A — normal home/away game'",
    "sequentialGiveBack": "Did either team just take a heavily-public-backed bad loss? If so, is this their bounce-back spot?",
    "moneyConfirmation": "Does the public bet%/money% split agree with the story? If it disagrees, say so explicitly.",
    "trellRule": "Active or inactive — if active, explain the actual reasoning",
    "publicNarrative": "What the public broadly believes — plain context; note whether it connects to a real edge or is just background noise",
    "propaganda": "If real propaganda exists: name the storyline, its polarity, and how the pick reflects it. If not, say so plainly",
    "scamPlay": "${'WHERE is the scam hiding — rank scam, total scam, situational scam? State what the public is wrong about. N/A if a clean unranked pass-through pick.'}",
    "gameScript": "How this game is likely to play out and why that script favors this specific bet",
    "marketLogic": "Why this specific market beats the alternatives",
    "edgeStrength": "How strong and specific is the edge — what would have to be true for this to be wrong?"
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
  // Tennis has NO slot system — every match runs the full scam hunt on its own merits.
  return `You are a professional tennis bettor. Does a real betting edge exist in this match?

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home} | ${game.tournament || ''} | Surface: ${game.surface || 'N/A'} | Round: ${game.round || 'N/A'}
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY TENNIS DATA SEARCH (USE WEB SEARCH FIRST):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tennis matches come with pricing but NOT structured stats — you must pull the key data yourself via web search before judging the edge. Search for BOTH players (${game.player1 || game.away} and ${game.player2 || game.home}) and this specific match today:
- Current ATP/WTA ranking for each player (and recent ranking trend)
- The SURFACE this match is on and each player's record/win% on that surface this season
- Recent form: last 5-10 matches, straight-set wins vs 3-set battles, any retirements
- Head-to-head record overall AND on this surface specifically
- Fatigue: how long/how many matches each has played this week, days of rest, any medical timeouts or injury concerns
- Tournament round + what's at stake (seeding, ranking points, defending title, home crowd)
- Serve/return profile: big server vs strong returner, tiebreak record
State what you found for each. If search returns nothing on a player (qualifier, lower-tour), say so and weight the pricing + what little is known accordingly — a total unknown vs a ranked player is itself information.

TENNIS-SPECIFIC EDGES:
SURFACE EDGE: Most important factor in tennis. Hard/Clay/Grass each favor different styles. A player dominating their best surface vs one playing outside comfort is a real edge.
FATIGUE: Long 3-set matches take physical and mental toll. Check days of rest and recent match lengths. A tired favorite is a major trap.
SERVE/RETURN DOMINANCE: Ace rate, first serve %, break point conversion — which player controls points?
RANKING vs FORM: Rankings lag reality. A lower-ranked player in better current form is often mispriced.
MENTAL STRENGTH: Tiebreak record, comeback ability, pressure performance. Some players fold, others thrive.
MOTIVATION: Tournament context — defending champion, ranking protection, home country crowd.
H2H ON THIS SURFACE: Overall H2H means less than surface-specific H2H in tennis.

SCAM HUNT (every tennis match — no slot system): Hunt every layer for mispricing. Higher-ranked player overpriced on reputation vs current form? BET the lower-ranked player. Favorite not expected to dominate? BET the spread. Surface edge the public missed? BET the player who owns this surface. Fatigue from a long match yesterday? BET the rested player at value. Media favorite vs a player quietly in better form? BET the overlooked one. Sometimes the "scam" IS the public side — the data supports the favorite and everyone fading them creates value; take whichever side the data supports. If there is NO real edge and the price is efficient, PASS — do not force a play. State WHERE the edge/scam is and WHAT the bet is, or why it's a pass.

⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT" (hard checkpoint): the money must match the movement. If public money is heavy on a player, that player's price should get MORE expensive (shorter), not cheaper. When the money is on a player but the price moves the OTHER way, that is reverse line movement — sharp money is on the quiet side against the public. Check this on every match; a mismatch is often exactly where the edge is.

PASS only when rankings, form, and surface fit are genuinely a coin flip and the line looks fair with no mispricing. Do not pass just because the match requires combining multiple smaller signals (form + surface + H2H) rather than one obvious factor — most real edges come from that combination. Modest or situational edges are still real picks; passes should be rare.

THE BAR FOR A REAL PICK (not a vague lean dressed up as one): "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling. If you're hedging ("could go either way but leaning X", "slight edge, nothing major"), either dig into the real combination of factors that justifies a clear pick, or actually PASS rather than present a hedge as a pick. Ask: "what would have to be true for this to be wrong?" — if the honest answer is "nothing unusual, basically a coin flip with a story," that's a PASS.


${ALIGNMENT_CHECK}
Return JSON:
{"edgeExists":true or false,"edgeType":"SURFACE" or "FATIGUE" or "FORM" or "MATCHUP" or "PRICE" or "MENTAL" or "NONE","edgeSide":"${game.player1 || game.away}" or "${game.player2 || game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest argument against","counterValid":true or false,"passReason":"if passing why","publicNarrative":"what the public broadly believes — context only, note if it connects to a real edge or is just context","propagandaCheck":"SEPARATE concept: does real propaganda exist (narrative outrunning reality for THIS game)? If yes name the storyline and classify polarity — A=hype (fade hyped side) or B=negative pile-on on a strong side whose edge is still intact (back the maligned side, e.g. Skenes/Pirates). If none, say so — do not relabel public narrative as propaganda","scamLayer":"Which layer the edge/scam was found in (SURFACE/FATIGUE/FORM/MATCHUP/PRICE/MENTAL) or NONE if pass","redFlags":["every signal contradicting the pick — be specific"],"greenFlags":["every signal confirming the pick — be specific"],"alignmentScore":"X/10 signals align — honest count with explanation","confidence":"HIGH" or "MEDIUM" or "LOW","confidencePercent":"A number 0-100 derived MECHANICALLY from redFlags/greenFlags/alignmentScore above — 0-1 red + 3+ green = 80-95, 2 explainable red = 55-75, 3+ red = should be passing not scoring. Not a separate gut feeling."}`;
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
  // Tennis has NO slot system.
  return `Finalize the tennis pick. One clear sentence.

MATCH: ${game.player1 || game.away} vs ${game.player2 || game.home} | ${game.surface || ''} | ${game.round || ''}
EDGE: ${stage2.edgeReason}
COUNTER: ${stage2.counterArgument} — Valid? ${stage2.counterValid ? 'YES' : 'NO'}
PICK: ${stage3.pick} ${stage3.betType}
WHY: ${stage3.marketReason}
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
Tier and confidence are a direct readout of the counted RED FLAGS / GREEN FLAGS / ALIGNMENT above — not a separate gut call.
- Tier 1: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95, scaled by flag strength.
- Tier 2: 2 red flags you can explain away, OR the counter has real validity, OR fewer than 3 green flags. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, OR the counter is as strong as the pick's case.
- confidencePercent MUST match the ALIGNMENT score above — don't assign a number the counted flags don't support.
VERDICT example: "Alcaraz ML -140 — he's 8-1 on clay this season and Zverev has lost 4 of his last 5 on clay."

Return JSON:
{"summary":{"pick":"player or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"N/A","confidence":"${stage2.confidence}","confidencePercent":${stage2.confidencePercent ?? 'null'},"scamLayer":${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},"isScamPlay":${!!(stage2.scamLayer && stage2.scamLayer !== 'NONE' && stage2.scamLayer !== 'N/A')},"verdict":"ONE plain sentence","signalCount":"X of 8","propagandaFade":false},"analysis":{"_INSTRUCTION":"CRITICAL - every field must be REASONING connecting 2+ data points into one sharp inferential claim, not a fact dump — AND SUMMARIZED: max 2 sentences per field, lead with the conclusion, no filler. The deep research already happened; this is the distilled result. If nothing meaningful, one short sentence.","signalAlignment":"condensed alignment verdict — the score (X/10), the 1-2 decisive green flags, and any unresolved red flag with its impact","priceVsDataAudit":"THE PRICE PRINCIPLE — why is the price set here and does data support it, why is money moving the way it is if it moved, and an explicit verdict on whether the price makes sense for this matchup","matchupFoundation":"who is better today and WHY - connect the strongest factors into one judgment","recentForm":"what the form trend actually means for this match specifically","headToHead":"whether H2H/surface H2H is actually predictive here or just noise, and why","surfaceEdge":"who owns this surface and why that edge actually matters for this specific matchup style","situational":"the single strongest fatigue/round/motivation factor and why it affects this match","trellRule":"N/A for tennis","sharpMoney":"what the sharp signal implies about who's right and how much it should move confidence","publicNarrative":"what the public broadly believes — context only, note if it connects to a real edge","propaganda":"If real propaganda exists: name the storyline, its polarity (A=hype→fade / B=pile-on→back the maligned side), and how the pick reflects it. If it is just ordinary public narrative with no real propaganda, say that plainly and do NOT invent a fade. Keep public narrative and propaganda distinct","scamPlay":"where the scam/edge is hiding and the core reason why (or N/A if a clean pass)","gameScript":"how this match is likely to play out and why that favors this bet","marketLogic":"why this market beats the alternatives - the actual comparison","edgeStrength":"how strong is the edge and why - what would have to be true for this to be wrong"},"finalVerdict":"same as summary.verdict"}`;
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
Rest: Away ${game.awayRest || 'N/A'} days B2B ${game.awayB2B ? 'YES' : 'No'} | Home ${game.homeRest || 'N/A'} days B2B ${game.homeB2B ? 'YES' : 'No'}
Away Scoring: PPG ${game.awayPPG || 'N/A'} OppPPG ${game.awayOppPPG || 'N/A'} PtDiff ${game.awayPointDiff || 'N/A'} Pace(combined PPG) ${game.awayPaceProxy || 'N/A'}
Home Scoring: PPG ${game.homePPG || 'N/A'} OppPPG ${game.homeOppPPG || 'N/A'} PtDiff ${game.homePointDiff || 'N/A'} Pace(combined PPG) ${game.homePaceProxy || 'N/A'}
ML: Away ${game.awayML || 'N/A'} Home ${game.homeML || 'N/A'}
Spread: ${game.spread || 'N/A'} Away ${game.awaySpreadPrice || '-110'} Home ${game.homeSpreadPrice || '-110'}
Total: ${game.total || 'N/A'} Over ${game.overPrice || '-110'} Under ${game.underPrice || '-110'}
Movement: ${game.lineMovement || 'None'} | Sharp: ${game.sharpSignal || 'None'}

Return ONLY this JSON:
{"awayFacts":"3 key facts away team now — ONLY from data above, no invented numbers","homeFacts":"3 key facts home team now — same rule","recentForm":"away L5 L10 AND home L5 L10 who is hot, from the real form data above","headToHead":"overall H2H AND last at home venue","matchupFacts":"scoring matchup from the REAL stats provided (PPG offense, OppPPG defense, point differential, combined-PPG pace), plus roster depth and star matchup. High-pace vs low-pace or strong-offense vs weak-defense is a real edge. Use the actual numbers; if a stat is N/A do not fabricate it","situationalFacts":"rest fatigue travel home court injuries — only what's provided","lineFacts":"movement sharp pricing"}

CRITICAL: Every number must come from the data above. If a field shows N/A, reflect that honestly rather than inventing a figure. Stage 2 has web search for real gaps; Stage 1 must not guess.`;
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

${isVegas ? `VEGAS SLOT — FIND THE SCAM AND BET IT. Hunt every layer: ML inflated on reputation? BET the other side. Spread — underdog live to cover? BET the points. Total — pace or defense creating an edge? BET that direction. Roster injury the public missed? BET against the affected team. Fatigue — B2B team undervalued? BET the rested side. Star matchup edge? BET the team that benefits. When you find it — BET IT. Remember: sometimes the scam IS the public side — the public is right but everyone fading them creates value. Take whichever side the data supports. State WHERE the scam is and WHAT the bet is.

⚡ REVERSE LINE MOVEMENT — "MONEY MUST MATCH THE MOVEMENT": the money must match the movement. If public money is heavy on a team, that team's price should get MORE expensive, not cheaper. When the money is on a team but the line moves the OTHER way, that's reverse line movement — sharp money is on the quiet side. Check this every game; a mismatch is often exactly where the scam is.` : `PUBLIC SLOT: Go with the better team unless data contradicts.`}

PASS only when both teams are genuinely similar with no meaningful edge in matchup or situation. Do not pass just because the game requires combining multiple smaller signals (form + matchup + situational) rather than one obvious factor — most real edges come from that combination. Modest or situational edges are still real picks; passes should be rare.

THE BAR FOR A REAL PICK (not a vague lean dressed up as one): "edgeReason" must name 2+ specific concrete factors that combine into one clear case — not a feeling. If you're hedging ("could go either way but leaning X", "slight edge, nothing major"), either dig into the real combination of factors that justifies a clear pick, or actually PASS rather than present a hedge as a pick. Ask: "what would have to be true for this to be wrong?" — if the honest answer is "nothing unusual, basically a coin flip with a story," that's a PASS.


${ALIGNMENT_CHECK}
Return JSON:
{"edgeExists":true or false,"edgeType":"MATCHUP" or "FATIGUE" or "ROSTER" or "STAR" or "TRELL" or "PRICE" or "SITUATIONAL" or "NONE","edgeSide":"${game.away}" or "${game.home}" or "OVER" or "UNDER" or "PASS","edgeReason":"one specific concrete sentence","counterArgument":"strongest counter","counterValid":true or false,"passReason":"if passing why","publicNarrative":"what the public broadly believes — context only, note if it connects to a real edge or is just context","propagandaCheck":"SEPARATE concept: does real propaganda exist (narrative outrunning reality for THIS game)? If yes name the storyline and classify polarity — A=hype (fade hyped side) or B=negative pile-on on a strong side whose edge is still intact (back the maligned side, e.g. Skenes/Pirates). If none, say so — do not relabel public narrative as propaganda","scamLayer":"${isVegas ? 'Which layer the scam was found in (ML/SPREAD/TOTAL/ROSTER/PROPAGANDA/SITUATIONAL)' : 'N/A'}","redFlags":["every signal contradicting the pick — be specific"],"greenFlags":["every signal confirming the pick — be specific"],"alignmentScore":"X/10 signals align — honest count with explanation","confidence":"HIGH" or "MEDIUM" or "LOW","confidencePercent":"A number 0-100 derived MECHANICALLY from redFlags/greenFlags/alignmentScore above — 0-1 red + 3+ green = 80-95, 2 explainable red = 55-75, 3+ red = should be passing not scoring. Not a separate gut feeling."}`;
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
CONFIDENCE: ${stage2.confidence} (${stage2.confidencePercent ?? '?'}%)
ALIGNMENT: ${stage2.alignmentScore || 'Not scored'}
GREEN FLAGS: ${(stage2.greenFlags || []).join(' | ') || 'None listed'}
RED FLAGS: ${(stage2.redFlags || []).join(' | ') || 'None listed'}

TIER ASSIGNMENT — MECHANICAL, NOT A FEELING:
Tier and confidence are a direct readout of the counted RED FLAGS / GREEN FLAGS / ALIGNMENT above — not a separate gut call.
- Tier 1 LOCK: 0-1 red flags AND 3+ green flags AND the counter-argument does not hold. confidencePercent 80-95, scaled by flag strength.
- Tier 2: 2 red flags you can explain away, OR the counter has real validity, OR fewer than 3 green flags. confidencePercent 55-75.
- Tier 3 / PASS: 3+ red flags, OR one unresolved CRITICAL red flag, OR the counter is as strong as the pick's case.
- confidencePercent MUST match the ALIGNMENT score above — don't assign a number the counted flags don't support.

Return JSON:
{"summary":{"pick":"team or OVER/UNDER","betType":"exact bet","tier":"1" or "2" or "3","tierLabel":"LOCK" or "Tier 2" or "PASS","slot":"N/A","confidence":"${stage2.confidence}","confidencePercent":${stage2.confidencePercent ?? 'null'},"scamLayer":${stage2.scamLayer ? `"${stage2.scamLayer}"` : 'null'},"isScamPlay":${!!(stage2.scamLayer && stage2.scamLayer !== 'NONE' && stage2.scamLayer !== 'N/A')},"verdict":"ONE plain sentence — pick and strongest reason","signalCount":"X of 8","propagandaFade":false},"analysis":{"_INSTRUCTION":"CRITICAL - every field must be REASONING connecting 2+ data points into one sharp inferential claim, not a fact dump — AND SUMMARIZED: max 2 sentences per field, lead with the conclusion, no filler. The deep research already happened; this is the distilled result. If nothing meaningful, one short sentence.","signalAlignment":"condensed alignment verdict — the score (X/10), the 1-2 decisive green flags, and any unresolved red flag with its impact","priceVsDataAudit":"THE PRICE PRINCIPLE — why is the price set here and does data support it, why is money moving the way it is if it moved, and an explicit verdict on whether the price makes sense for this matchup","matchupFoundation":"who is better today and WHY - connect the strongest factors into one judgment","recentForm":"what the form trend actually means for this matchup specifically","headToHead":"whether H2H/home venue history is actually predictive here or just noise, and why","rosterDepth":"how the key roster/injury situation actually changes the matchup, not just who's available","situational":"the single strongest rest/fatigue/home-court factor and why it affects this game","trellRule":"active or inactive - if active, explain the actual reasoning for why it applies here","sharpMoney":"what the sharp signal implies about who's right and how much it should move confidence","publicNarrative":"what the public broadly believes — context only, note if it connects to a real edge","propaganda":"If real propaganda exists: name the storyline, its polarity (A=hype→fade / B=pile-on→back the maligned side), and how the pick reflects it. If it is just ordinary public narrative with no real propaganda, say that plainly and do NOT invent a fade. Keep public narrative and propaganda distinct","scamPlay":"where the scam/edge is hiding and the core reason why (or N/A if a clean pass)","gameScript":"how this game is likely to play out and why that favors this bet","marketLogic":"why this market beats the alternatives - the actual comparison","edgeStrength":"how strong is the edge and why - what would have to be true for this to be wrong"},"finalVerdict":"same as summary.verdict"}`;
}
