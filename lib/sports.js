// ── CENTRAL SPORT REGISTRY — SINGLE SOURCE OF TRUTH ──────────────────────────
//
// WHY THIS EXISTS
// This app was originally built for MLB only, and each new sport was added by
// patching individual code paths. That left ~46 scattered sport-specific
// branches across 7 files, and — worse — a pattern of MLB-defaulting
// fall-throughs like:
//     sport === 'MLB' ? 'baseball/mlb' : sport === 'NBA' ? ... : 'baseball/mlb'
//     sportKeyMap[sport] || 'baseball_mlb'
// which silently made NON-MLB sports fetch MLB data. Real bugs this caused:
// WNBA games pulling MLB news for their storyline research, and WNBA line
// movement fetching baseball lines.
//
// THE RULE GOING FORWARD
// Every sport-specific fact lives HERE, once. Code asks the registry instead
// of branching on sport. Adding a future sport = add ONE entry below, and it
// inherits every feature automatically instead of needing a dozen patches.
//
// NEVER reintroduce `|| 'baseball_mlb'`-style defaults. If a sport isn't in
// this registry, the correct behavior is to return null and skip the feature
// cleanly — NOT to silently serve another sport's data as if it were real.

export const SPORTS = {
  MLB: {
    key: 'MLB',
    label: 'MLB',
    // ── external data source identifiers ──
    espnPath: 'baseball/mlb',        // site.api.espn.com/.../sports/{espnPath}/...
    espnLogoSport: 'mlb',            // a.espncdn.com/i/teamlogos/{espnLogoSport}/...
    oddsApiKey: 'baseball_mlb',      // the-odds-api.com/v4/sports/{oddsApiKey}/...
    slotPatternKey: 'mlb',           // slot_patterns table `sport` column value
    // ── sport characteristics (drive prompts, UI tabs, data fetching) ──
    isTeamSport: true,
    isOutdoor: true,                 // weather is relevant
    hasStartingPitchers: true,       // baseball-only concept
    hasMultiGameSeries: true,        // baseball-only concept
    hasUmpire: true,
    // ── product behavior ──
    hasSlotSystem: true,             // uses PUBLIC/VEGAS admin slot patterns
    slotWeekdaysOnly: false,         // if true, weekends require manual analyze
    inSeasonYearRound: false,
    enabled: true,
  },

  NBA: {
    key: 'NBA',
    label: 'NBA',
    espnPath: 'basketball/nba',
    espnLogoSport: 'nba',
    oddsApiKey: 'basketball_nba',
    slotPatternKey: 'nba',
    isTeamSport: true,
    isOutdoor: false,                // indoor — weather irrelevant
    hasStartingPitchers: false,
    hasMultiGameSeries: false,       // playoffs are series, but not the regular season model
    hasUmpire: false,
    hasSlotSystem: true,
    slotWeekdaysOnly: false,
    inSeasonYearRound: false,
    enabled: true,
  },

  WNBA: {
    key: 'WNBA',
    label: 'WNBA',
    espnPath: 'basketball/wnba',
    espnLogoSport: 'wnba',
    oddsApiKey: 'basketball_wnba',
    slotPatternKey: 'wnba',
    isTeamSport: true,
    isOutdoor: false,
    hasStartingPitchers: false,
    hasMultiGameSeries: false,
    hasUmpire: false,
    hasSlotSystem: true,
    // WNBA-specific product rule: auto-analyze Mon–Fri only (with a saved
    // pattern). Sat/Sun, clients press Analyze themselves.
    slotWeekdaysOnly: true,
    inSeasonYearRound: false,
    enabled: true,
  },

  NFL: {
    key: 'NFL',
    label: 'NFL',
    espnPath: 'football/nfl',
    espnLogoSport: 'nfl',
    oddsApiKey: 'americanfootball_nfl',
    slotPatternKey: 'nfl',
    isTeamSport: true,
    isOutdoor: true,                 // weather very relevant
    hasStartingPitchers: false,
    hasMultiGameSeries: false,
    hasUmpire: false,
    hasSlotSystem: true,
    slotWeekdaysOnly: false,
    inSeasonYearRound: false,
    enabled: true,
  },

  Tennis: {
    key: 'Tennis',
    label: 'Tennis',
    espnPath: 'tennis',
    espnLogoSport: null,             // individual sport — no team logos
    oddsApiKey: null,                // not currently wired to the odds API
    slotPatternKey: null,            // genuinely no slot system
    isTeamSport: false,
    isOutdoor: true,                 // surface/conditions matter
    hasStartingPitchers: false,
    hasMultiGameSeries: false,
    hasUmpire: false,
    hasSlotSystem: false,            // the only true no-slot sport
    slotWeekdaysOnly: false,
    inSeasonYearRound: true,
    // Prompts exist and the model supports Tennis, but the tab is currently
    // removed from the UI. Flip to true to re-enable everywhere at once.
    enabled: false,
  },
};

// ── ACCESSORS — use these instead of branching on sport ───────────────────────

/** Look up a sport's config. Returns null for unknown sports (never a default). */
export function getSport(sportKey) {
  if (!sportKey) return null;
  return SPORTS[sportKey] || null;
}

/** All sport keys, including disabled ones. */
export const ALL_SPORT_KEYS = Object.keys(SPORTS);

/** Sport keys currently enabled in the product. Use this for UI tab lists. */
export const ENABLED_SPORT_KEYS = ALL_SPORT_KEYS.filter(k => SPORTS[k].enabled);

/** Team sports that are enabled — the ones with slates, logos, slot patterns. */
export const ENABLED_TEAM_SPORT_KEYS = ENABLED_SPORT_KEYS.filter(k => SPORTS[k].isTeamSport);

/**
 * ESPN API path for a sport (e.g. 'basketball/wnba').
 * Returns null if unknown — callers MUST skip the fetch rather than
 * substituting another sport's path (that's the bug this registry prevents).
 */
export function espnPathFor(sportKey) {
  return getSport(sportKey)?.espnPath ?? null;
}

/** The Odds API sport key (e.g. 'basketball_wnba'). Null if not applicable. */
export function oddsApiKeyFor(sportKey) {
  return getSport(sportKey)?.oddsApiKey ?? null;
}

/** slot_patterns table key (e.g. 'wnba'). Null if the sport has no slot system. */
export function slotPatternKeyFor(sportKey) {
  return getSport(sportKey)?.slotPatternKey ?? null;
}

/** Whether weather data is meaningful for this sport. */
export function isOutdoorSport(sportKey) {
  return getSport(sportKey)?.isOutdoor === true;
}

/** Whether this sport uses the PUBLIC/VEGAS admin slot pattern system. */
export function hasSlotSystem(sportKey) {
  return getSport(sportKey)?.hasSlotSystem === true;
}

/** Whether this sport only auto-analyzes on weekdays (WNBA's rule). */
export function isWeekdayOnlySlotSport(sportKey) {
  return getSport(sportKey)?.slotWeekdaysOnly === true;
}

/** Baseball-only concepts — used to gate prompts/UI cleanly. */
export function hasStartingPitchers(sportKey) {
  return getSport(sportKey)?.hasStartingPitchers === true;
}
export function hasMultiGameSeries(sportKey) {
  return getSport(sportKey)?.hasMultiGameSeries === true;
}
