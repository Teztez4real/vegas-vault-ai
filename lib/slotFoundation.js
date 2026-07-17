/**
 * Slot "foundation" helpers for the auto-slot-pattern morning cron.
 * Kept separate from the route so the prompt and parser are unit-testable
 * without spinning up Next or touching Supabase.
 */

// Build the PUBLIC/VEGAS assignment prompt from the mentorship foundation.
// `games` must already be in the order the answer should follow (slate/time
// order — the same order assignSlotFromPattern applies the pattern in).
export function buildSlotPrompt(sportLabel, dateStr, dow, games) {
  const list = games.map((g, i) =>
    `${i + 1}. ${g.time || 'TBD'} — ${g.away} @ ${g.home}` +
    (g.spread && g.spread !== 'N/A' ? ` | spread ${g.spread}` : '') +
    (g.total && g.total !== 'N/A' ? ` | total ${g.total}` : '') +
    (g.awayML && g.awayML !== 'N/A' ? ` | ML ${g.awayML}/${g.homeML}` : '') +
    (g.awayRank || g.homeRank ? ` | ranks ${g.awayRank ? '#' + g.awayRank : 'unranked'} vs ${g.homeRank ? '#' + g.homeRank : 'unranked'}` : '')
  ).join('\n');

  return `You are setting today's PUBLIC/VEGAS "foundation" for ${sportLabel}, exactly the way a professional handicapper does it each morning before the games. Assign every game on the slate a slot: PUBLIC or VEGAS.

WHAT THE SLOTS MEAN:
- PUBLIC slot = a straightforward game. The better team is the better team; the line is roughly honest. You bet these more or less at face value (still watching for the occasional trap).
- VEGAS slot = a scam-hunting game. Treat the posted line as bait and look for where the book is misleading the public — a favorite priced to lose value, a total shaded against recent scoring, a name-brand team riding recency bias. The scam is a MISPRICING; it can even sit on the public side.

THE FOUNDATION — HOW TO BUILD THE PATTERN:
1. The day of week sets the day's base orientation. Rough baseline: Monday PUBLIC, Tuesday VEGAS, Wednesday PUBLIC, Thursday VEGAS, Friday PUBLIC, Saturday VEGAS, Sunday VEGAS. Today is ${dow}.
2. Seed the slate by STARTING with the OPPOSITE of the day's base orientation on the earliest game, then ALTERNATE down the time-ordered slate (matching times get matching slots, inverse times get inverse slots). This alternation is the backbone.
3. THEN refine with the actual matchups below: a game whose line looks clearly mispriced versus the real matchup (records, ranks, streaks, home/away, a suspiciously small spread on a clear favorite, a total that ignores recent scoring) is a strong VEGAS candidate regardless of the alternation. A clean, correctly-priced favorite is a PUBLIC game.
4. Keep it disciplined and roughly balanced — do not make the whole slate one slot unless the day genuinely calls for it.

TODAY IS ${dow}, ${dateStr}. SPORT: ${sportLabel}.
SLATE (already in the order your answer must follow):
${list}

Return ONLY a JSON object, no prose:
{"slots": [${games.map(() => '"PUBLIC" or "VEGAS"').join(', ')}]}
The "slots" array MUST have exactly ${games.length} entries, one per game, in the same order as listed above.`;
}

// Parse the model's raw text into a validated PUBLIC/VEGAS array of exactly
// `gameCount` entries. Returns null if no usable array is found. Any value that
// isn't exactly "VEGAS" (case-insensitive) becomes "PUBLIC" — a conservative
// default (PUBLIC is the non-scam, face-value slot). Pads/trims to gameCount so
// the positional mapping to the slate is always exact.
export function parseSlots(raw, gameCount) {
  if (!raw) return null;
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  let parsed;
  try { parsed = JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
  let slots = Array.isArray(parsed?.slots) ? parsed.slots : null;
  if (!slots) return null;
  slots = slots.map(x => (String(x).toUpperCase() === 'VEGAS' ? 'VEGAS' : 'PUBLIC'));
  if (slots.length < gameCount) {
    while (slots.length < gameCount) slots.push('PUBLIC');
  } else if (slots.length > gameCount) {
    slots = slots.slice(0, gameCount);
  }
  return slots;
}
