/**
 * Formats a pick + betType into a clean, non-duplicated display string.
 * Handles all known AI output duplication patterns:
 *
 *   "Tampa Bay Rays" + "Tampa Bay Rays ML"  → "Tampa Bay Rays ML"
 *   "St. Louis Cardinals" + "Cardinals ML"  → "St. Louis Cardinals ML"
 *   "Under" + "Under 9 -110"               → "Under 9 -110"
 *   "Over" + "Over 8.5"                    → "Over 8.5"
 *   "Tampa Bay Rays" + "ML -125"           → "Tampa Bay Rays ML -125"  (normal)
 *
 * Works in both browser and Node (no DOM deps).
 */
export function formatPickDisplay(pick, betType) {
  if (!pick && !betType) return '';
  if (!pick) return (betType || '').trim();
  if (!betType) return pick.trim();

  const p  = pick.trim();
  const bt = betType.trim();

  // 1. betType starts with the FULL pick string (most common)
  //    "Tampa Bay Rays" + "Tampa Bay Rays ML" → "Tampa Bay Rays ML"
  if (bt.toLowerCase().startsWith(p.toLowerCase())) {
    const rest = bt.slice(p.length).trim();
    return rest ? `${p} ${rest}` : p;
  }

  // 2. pick already contains the full betType — pick IS the complete string
  //    "Over 9 -110" + "Over" → "Over 9 -110"
  if (p.toLowerCase().includes(bt.toLowerCase())) return p;

  // 3. Trailing word(s) of pick overlap with leading word(s) of betType
  //    "St. Louis Cardinals" + "Cardinals ML"
  //    → trailing 1 word of pick ("Cardinals") === leading 1 word of betType
  //    → "St. Louis Cardinals ML"
  const pWords  = p.split(/\s+/);
  const btWords = bt.split(/\s+/);
  let overlap = 0;
  // Try from longest possible overlap down to 1 word
  for (let len = Math.min(pWords.length, btWords.length); len >= 1; len--) {
    const pTail  = pWords.slice(-len).join(' ').toLowerCase();
    const btHead = btWords.slice(0, len).join(' ').toLowerCase();
    if (pTail === btHead) {
      overlap = len;
      break;
    }
  }
  if (overlap > 0) {
    const rest = btWords.slice(overlap).join(' ').trim();
    return rest ? `${p} ${rest}` : p;
  }

  // 4. Normal case — no duplication detected, just combine cleanly
  return `${p} ${bt}`;
}
