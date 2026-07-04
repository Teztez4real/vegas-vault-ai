/**
 * Season boundaries differ by sport:
 *   - MLB, Tennis, WNBA: season starts and ends within the same calendar
 *     year (spring–fall), so the season anchor is just the calendar year.
 *   - NBA, NFL: season spans two calendar years (starts in fall, ends the
 *     following spring), so games from Aug/Jul onward belong to the season
 *     that CONCLUDES the following year.
 *
 * seasonAnchorYear() returns a single integer that uniquely identifies a
 * sport's season for a given date, so record-keeping can reset per sport
 * at the correct boundary rather than using a single fixed cutoff for
 * every sport.
 */
export function seasonAnchorYear(sport, dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12

  if (sport === 'NBA') {
    // NBA season (e.g. 2026-27) runs Oct 2026 → Jun 2027. Preseason/media
    // day activity can start in Aug, so treat Aug onward as the new season.
    return month >= 8 ? year + 1 : year;
  }
  if (sport === 'NFL') {
    // NFL season (e.g. 2026-27) runs Sep 2026 → Feb 2027 (Super Bowl).
    // Treat Jul onward (start of training camp) as the new season.
    return month >= 7 ? year + 1 : year;
  }
  // MLB, Tennis, WNBA, and anything else: season = calendar year.
  return year;
}

// True if the given (sport, date) row belongs to the CURRENT season for
// that sport, evaluated against "today" (also sport-aware).
export function isCurrentSeason(sport, dateStr, todayStr) {
  const rowAnchor = seasonAnchorYear(sport, dateStr);
  const currentAnchor = seasonAnchorYear(sport, todayStr);
  return rowAnchor != null && currentAnchor != null && rowAnchor === currentAnchor;
}
