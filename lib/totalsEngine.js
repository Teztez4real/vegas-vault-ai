/**
 * Vegas Vault AI — Totals Projection Engine (Phase 1)
 *
 * An INDEPENDENT, purely-quantitative run-total projection that runs BEFORE
 * the psychology model. It produces: a projected game total, the gap vs the
 * Vegas total, and a confidence band scaled to the gap size. This number is
 * fed into Stage 2 as ONE MORE SIGNAL — it never overrides the psychology
 * model's pass discipline or scam detection.
 *
 * Pipeline (mirrors the proven approach):
 *   1-3. Pitching backbone: blend SIERA + FIP (DEFIP proxy) 60/40, regress
 *        small samples toward league average, apply K-rate suppression.
 *   4.   Bullpen: project pen innings and apply team bullpen rate.
 *   5-6. Offense: team wRC+ adjusts run expectation up/down from league avg.
 *   7.   Park factor multiplier.
 *   8.   Wind: speed + direction => +/- scoring.
 *   9.   ANTI-DOUBLE-COUNT: each team's projected runs = what the OPPOSING
 *        run-prevention projects to allow GIVEN that offense — not offense and
 *        defense summed separately. This is the key architectural rule.
 *   10.  Output projected total, gap vs Vegas, confidence band.
 *
 * Defensive by design: if the essential inputs (both starters' rate stats +
 * both teams' wRC+) aren't present, it returns { available:false } and the
 * model simply proceeds without it rather than guessing.
 */

const LEAGUE_AVG_RUNS_PER_TEAM = 4.5; // ~MLB average runs/team/game baseline
const LEAGUE_AVG_PITCHER_RATE  = 4.20; // league-average ERA/FIP baseline
const STARTER_INNINGS          = 5.4;  // typical modern starter length
const GAME_INNINGS             = 9.0;

// Blend SIERA + FIP 60/40 into a single "true talent" run-prevention rate.
// FIP stands in for DEFIP here (both are defense-independent ERA estimators).
function pitcherTrueRate(p) {
  const siera = num(p?.siera ?? p?.SIERA);
  const fip   = num(p?.fip   ?? p?.FIP);
  if (siera != null && fip != null) return 0.6 * siera + 0.4 * fip;
  if (siera != null) return siera;
  if (fip != null) return fip;
  const xfip = num(p?.xfip ?? p?.xFIP);
  if (xfip != null) return xfip;
  return null;
}

// Small-sample protection: if a pitcher has < 60 IP, regress his rate toward
// league average so we don't overreact to a hot/cold few starts.
function regressForSample(rate, inningsPitched) {
  if (rate == null) return null;
  const ip = num(inningsPitched);
  if (ip == null || ip >= 60) return rate;
  // Weight: at 0 IP fully league average, at 60 IP fully the pitcher's rate.
  const w = Math.max(0, Math.min(1, ip / 60));
  return w * rate + (1 - w) * LEAGUE_AVG_PITCHER_RATE;
}

// Strikeout suppression: high-K pitchers suppress offense beyond what their
// rate stat alone shows. Apply a small multiplier for elite K/9.
function strikeoutAdjust(rate, kPer9) {
  if (rate == null) return rate;
  const k = num(kPer9);
  if (k == null) return rate;
  // Above 10 K/9, shave run expectation slightly (up to ~6% at 13+ K/9).
  if (k <= 9) return rate;
  const adj = Math.min(0.06, (k - 9) * 0.015);
  return rate * (1 - adj);
}

// Convert a run-prevention rate (per 9) into expected runs allowed over a
// given number of innings.
function runsOver(rate, innings) {
  if (rate == null) return null;
  return rate * (innings / 9);
}

// Offense multiplier from wRC+ (100 = league avg). 120 wRC+ => 1.20x.
function wrcMultiplier(wrcPlus) {
  const w = num(wrcPlus);
  if (w == null) return 1;
  return w / 100;
}

// Park factor as a direct multiplier (1.0 neutral). Clamp to sane range.
function parkMultiplier(pf) {
  const p = num(pf);
  if (p == null) return 1;
  return Math.max(0.80, Math.min(1.35, p));
}

// Wind: translate a parsed weather string / fields into a scoring multiplier.
// Accepts either a structured {windSpeed, windDir} or the weather text.
function windMultiplier(game) {
  let speed = num(game?.windSpeed);
  let dir   = (game?.windDir || '').toString().toUpperCase();
  // Fall back to parsing the weather text the slate already produces.
  if (speed == null && typeof game?.weather === 'string') {
    const m = game.weather.match(/(\d+)\s*mph/i);
    if (m) speed = num(m[1]);
    if (/blowing out|OUT \d/i.test(game.weather)) dir = dir || 'OUT';
    if (/blowing in|IN \d/i.test(game.weather)) dir = dir || 'IN';
  }
  if (speed == null || speed < 8) return 1; // light wind = negligible
  const blowingOut = /OUT|S|SW|SE/.test(dir);
  const blowingIn  = /IN|N|NW|NE/.test(dir);
  // ~8% swing at 15 mph, scaled by speed, capped.
  const magnitude = Math.min(0.10, (speed / 15) * 0.08);
  if (blowingOut) return 1 + magnitude;
  if (blowingIn)  return 1 - magnitude;
  return 1; // crosswind / unknown direction
}

function num(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Project the total for one game.
 * Returns:
 *   { available:false, reason } if essential inputs are missing, OR
 *   { available:true, projectedTotal, vegasTotal, gap, leaning, confidence,
 *     band, factors, detail }
 */
export function projectTotal(game) {
  // Gather inputs (defensive — many may be null)
  const awayP = {
    siera: game.awayPitcherSIERA, fip: game.awayPitcherFIP, xfip: game.awayPitcherXFIP,
    ip: game.awayPitcherIP, kPer9: game.awayPitcherK9,
  };
  const homeP = {
    siera: game.homePitcherSIERA, fip: game.homePitcherFIP, xfip: game.homePitcherXFIP,
    ip: game.homePitcherIP, kPer9: game.homePitcherK9,
  };

  const awayRate = strikeoutAdjust(regressForSample(pitcherTrueRate(awayP), awayP.ip), awayP.kPer9);
  const homeRate = strikeoutAdjust(regressForSample(pitcherTrueRate(homeP), homeP.ip), homeP.kPer9);

  const awayWRC = num(game.awayWRCPlus);
  const homeWRC = num(game.homeWRCPlus);

  const vegasTotal = num(game.total);

  // ESSENTIAL INPUTS GATE — need both starters' rates and both offenses.
  if (awayRate == null || homeRate == null || awayWRC == null || homeWRC == null) {
    return {
      available: false,
      reason: `Insufficient data for projection (${awayRate==null?'away SP rate, ':''}${homeRate==null?'home SP rate, ':''}${awayWRC==null?'away wRC+, ':''}${homeWRC==null?'home wRC+':''})`.replace(/, $/, ''),
    };
  }

  // Bullpen rates (fall back to league average if missing — non-essential)
  const awayPenRate = num(game.awayBullpenERA) ?? LEAGUE_AVG_PITCHER_RATE;
  const homePenRate = num(game.homeBullpenERA) ?? LEAGUE_AVG_PITCHER_RATE;

  // ── ANTI-DOUBLE-COUNT CORE (Step 9) ──────────────────────────────────────
  // The away team scores what the HOME run-prevention projects to allow them,
  // scaled by the away offense's quality. Same for the home team vs away SP.
  // We do NOT also add the away offense's own run expectation separately.
  const penInnings = GAME_INNINGS - STARTER_INNINGS;

  // Home pitching staff projected runs allowed (starter portion + pen portion)
  const homeStaffRate =
    (runsOver(homeRate, STARTER_INNINGS) + runsOver(homePenRate, penInnings)); // runs over 9 IP equiv
  const awayStaffRate =
    (runsOver(awayRate, STARTER_INNINGS) + runsOver(awayPenRate, penInnings));

  // Away team runs = home staff's expected runs allowed, adjusted by away offense quality
  let awayRuns = homeStaffRate * wrcMultiplier(awayWRC);
  // Home team runs = away staff's expected runs allowed, adjusted by home offense quality
  let homeRuns = awayStaffRate * wrcMultiplier(homeWRC);

  // ── ENVIRONMENT (Steps 7-8) — applied to the COMBINED total ──────────────
  const park = parkMultiplier(game.parkFactor);
  const wind = windMultiplier(game);
  let projectedTotal = (awayRuns + homeRuns) * park * wind;

  // Sanity clamp — keep projections in a realistic MLB band
  projectedTotal = Math.max(5.5, Math.min(14.5, projectedTotal));
  const projRounded = Math.round(projectedTotal * 10) / 10;

  // ── GAP + CONFIDENCE (Step 10) ───────────────────────────────────────────
  let gap = null, leaning = 'NONE', band = 'PASS', confidence = 0;
  if (vegasTotal != null) {
    gap = projRounded - vegasTotal;
    const absGap = Math.abs(gap);
    leaning = gap > 0 ? 'OVER' : gap < 0 ? 'UNDER' : 'NONE';
    // Confidence band scaled to gap. NOTE: these are guidance bands, not
    // win-rate guarantees — they raise/lower confidence, the psychology model
    // still governs the final call.
    if (absGap >= 2.0)      { band = 'STRONG';        confidence = 80; }
    else if (absGap >= 1.5) { band = 'MODERATE';      confidence = 65; }
    else if (absGap >= 1.0) { band = 'LEAN';          confidence = 55; }
    else                    { band = 'PASS';          confidence = 0; leaning = 'NONE'; }
  }

  return {
    available: true,
    projectedTotal: projRounded,
    vegasTotal,
    gap: gap == null ? null : Math.round(gap * 10) / 10,
    leaning,
    band,
    confidence,
    factors: {
      awayRuns: Math.round(awayRuns * 10) / 10,
      homeRuns: Math.round(homeRuns * 10) / 10,
      awaySPrate: awayRate == null ? null : Math.round(awayRate * 100) / 100,
      homeSPrate: homeRate == null ? null : Math.round(homeRate * 100) / 100,
      awayWRC, homeWRC,
      park: Math.round(park * 100) / 100,
      wind: Math.round(wind * 100) / 100,
    },
    detail: vegasTotal != null
      ? `Model projects ${projRounded} vs Vegas ${vegasTotal} — ${Math.abs(gap).toFixed(1)}-run gap leaning ${leaning} (${band}).`
      : `Model projects ${projRounded} (no Vegas total to compare).`,
  };
}
