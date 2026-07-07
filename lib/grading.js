// Shared grading logic — used by BOTH the 30-min auto-analyze cron and the
// 2-min live-score-push cron. Extracted into its own module so a finished
// game gets graded within ~2 minutes of going final, not up to 30 minutes
// later — that gap was exactly why a just-finished game's CASHED/LOSS stamp
// wasn't showing up yet on the share card even though the final score was
// already visible (final score comes from live scoreboard data, which
// updates instantly; the WIN/LOSS grade is a separate process that now runs
// far more often).

// Grades a single pick against the final score.
export function gradePick(pick, away, home, awayScore, homeScore) {
  const pickTeam = pick.pick;
  const betType = (pick.betType || 'ML').trim();
  const awayWon = awayScore > homeScore;
  const homeWon = homeScore > awayScore;
  const marginHome = homeScore - awayScore; // positive => home won by this much
  const pickIsAway = pickTeam === away || away?.includes(pickTeam) || pickTeam?.includes((away || '').split(' ').pop());
  const pickIsHome = !pickIsAway;

  const bt = betType.toUpperCase();
  const totalRuns = awayScore + homeScore;

  // TOTALS — extract ONLY the number immediately following OVER/UNDER, not
  // every digit in the string. The old code stripped all non-digit chars
  // from the whole betType string (e.g. "OVER 10 -102"), which strips the
  // minus sign but keeps every digit, MERGING the total with the price into
  // "10102" instead of 10 — making a real win (23 total runs) register as a
  // loss because 23 is not > 10102. This is exactly that bug, fixed.
  if (bt.includes('OVER')) {
    const m = bt.match(/OVER\s+(\d+\.?\d*)/);
    const total = m ? parseFloat(m[1]) : NaN;
    if (!isNaN(total)) return totalRuns > total ? 'win' : 'loss';
  }
  if (bt.includes('UNDER')) {
    const m = bt.match(/UNDER\s+(\d+\.?\d*)/);
    const total = m ? parseFloat(m[1]) : NaN;
    if (!isNaN(total)) return totalRuns < total ? 'win' : 'loss';
  }

  // MONEYLINE — explicit "ML" marker (format is always "ML <price>", e.g. "ML -125")
  if (/^ML\b/.test(bt)) {
    return (pickIsAway && awayWon) || (pickIsHome && homeWon) ? 'win' : 'loss';
  }

  // SPREAD / RUN LINE — generic, ANY value, not hardcoded to ±1.5. The old
  // code only recognized the literal strings "-1.5"/"+1.5", so any other
  // spread (-2.5, +3.5, -6.5 for NBA/NFL, or MLB alternate run lines) fell
  // through to the ML default — silently grading a covered spread bet as if
  // it were a straight-up moneyline pick, which is wrong. Format is always
  // "<signed spread number> <price>", e.g. "+1.5 -115" or "-3.5 -110" — parse
  // the actual number and check the real margin against it, for any value.
  const spreadMatch = bt.match(/^([+-]\d+\.?\d*)/);
  if (spreadMatch) {
    const spreadNum = parseFloat(spreadMatch[1]);
    // How much the PICKED team actually won/lost by (positive = won by that much)
    const pickMargin = pickIsAway ? -marginHome : marginHome;
    return (pickMargin + spreadNum) > 0 ? 'win' : 'loss';
  }

  // ML default (no explicit market marker found — straight-up winner)
  return (pickIsAway && awayWon) || (pickIsHome && homeWon) ? 'win' : 'loss';
}

// Grades every completed-but-ungraded game across a short lookback window
// (today + prior 3 days, to survive postponements/delays/a missed cycle).
// Safe to call frequently — already-graded rows are skipped instantly via
// the `graded` flag, so running this every 2 minutes costs almost nothing
// extra beyond the /api/today fetch.
export async function gradeCompletedGames(sb, date, base) {
  try {
    const [y, m, d0] = date.split('-').map(Number);
    const dateWindows = [date];
    for (let back = 1; back <= 3; back++) {
      const dObj = new Date(Date.UTC(y, m - 1, d0));
      dObj.setUTCDate(dObj.getUTCDate() - back);
      dateWindows.push(`${dObj.getUTCFullYear()}-${String(dObj.getUTCMonth()+1).padStart(2,'0')}-${String(dObj.getUTCDate()).padStart(2,'0')}`);
    }

    let gradedCount = 0;

    for (const dd of dateWindows) {
      const { data: rows } = await sb.from('game_analyses').select('game_key, game_id, away, home, sport, result, date').eq('date', dd);
      if (!rows?.length) continue;

      const gRes = await fetch(`${base}/api/today?date=${dd}`, { cache: 'no-store' });
      if (!gRes.ok) continue;
      const { games: liveGames } = await gRes.json();

      for (const row of rows) {
        let parsed; try { parsed = JSON.parse(row.result); } catch { continue; }

        // Match by the UNIQUE game ID first — team names alone are ambiguous
        // for doubleheaders (same two teams playing twice in one day would
        // otherwise match the first game found, which could incorrectly
        // grade the second game's still-in-progress or not-yet-started
        // analysis using the FIRST game's final score). Only fall back to
        // name matching if the ID isn't available for some reason.
        const g = (row.game_id != null && (liveGames || []).find(x => String(x.id) === String(row.game_id)))
          || (liveGames || []).find(x =>
            (x.away === row.away && x.home === row.home) ||
            (x.sport === row.sport && x.away === row.away && x.home === row.home)
          );
        const hasStarted = g?.rawTime ? new Date(g.rawTime) <= new Date() : false; // SAFE DEFAULT: if we can't confirm the game has started (no match found, or missing start time), assume it has NOT — never risk grading a game we can't verify

        // SELF-HEALING: if this row was already (mis)graded — e.g. by the
        // doubleheader mismatch bug this fix resolves — but the actual game
        // genuinely hasn't started yet, revert the bad grade so it can be
        // graded correctly once the real game finishes. This automatically
        // repairs any already-corrupted rows on the very next cron run,
        // without needing a manual database cleanup.
        if (parsed?.graded && !hasStarted) {
          const { graded, gradedResult, gradedScore, gradedAt, ...rest } = parsed;
          await sb.from('game_analyses').update({ result: JSON.stringify(rest) }).eq('game_key', row.game_key);
          try { await sb.from('ai_track_record').delete().eq('game_key', row.game_key); } catch {}
          continue;
        }

        if (parsed?.graded) continue; // already correctly graded, skip
        const s = parsed?.summary;
        if (!s?.pick || s.tier === 'PASS' || s.tier === '3') continue;

        const isFinal = g?.isFinal === true;
        const awayScore = g?.awayScore;
        const homeScore = g?.homeScore;
        // Safety net: never grade a game as final if its own scheduled start
        // time hasn't passed yet — this is what actually caught the bug (a
        // game showing a LOSS before it started). No matter how the game got
        // matched, a truly not-started game can never legitimately be final.
        if (!isFinal || !hasStarted || awayScore == null || homeScore == null) continue;

        const result = gradePick(s, row.away, row.home, awayScore, homeScore);
        const updatedResult = { ...parsed, graded: true, gradedResult: result, gradedScore: `${row.away} ${awayScore} - ${homeScore} ${row.home}`, gradedAt: new Date().toISOString() };
        await sb.from('game_analyses').update({ result: JSON.stringify(updatedResult) }).eq('game_key', row.game_key);
        gradedCount++;

        // IMPORTANT: this write was previously wrapped in a silent try/catch
        // that swallowed any error, including "table does not exist" — which
        // would make the ENTIRE shared track-record system fail invisibly if
        // the required SQL migration was never run in Supabase, with every
        // part of the app silently falling back to the personal/watchlist
        // pickHistory data instead (looking, from the outside, exactly like
        // "it's only tracking my watchlist"). Now logged loudly so this is
        // diagnosable instead of silent.
        const { error: trErr } = await sb.from('ai_track_record').upsert({
          game_key: row.game_key, date: dd, sport: row.sport,
          away: row.away, home: row.home,
          pick: s.pick, bet_type: s.betType, tier: s.tier,
          result, score: `${row.away} ${awayScore} - ${homeScore} ${row.home}`,
          graded_at: new Date().toISOString(),
        }, { onConflict: 'game_key' });
        if (trErr) console.error('[grading] ai_track_record write FAILED — the table likely does not exist yet. Run supabase/migrations/ai_track_record.sql. Error:', trErr.message);
      }
    }
    return gradedCount;
  } catch {
    return 0;
  }
}

// ── RE-VERIFY ALL HISTORICALLY GRADED PICKS ───────────────────────────────────
// The OVER/UNDER number-parsing bug and the hardcoded-to-±1.5 spread bug (see
// gradePick above) caused real, already-graded picks to be stored with the
// WRONG result — e.g. a 23-run total correctly beating an OVER 10 line got
// stored as a loss because "OVER 10 -102" parsed to 10102 instead of 10.
// Those bad results don't fix themselves just because gradePick is now
// correct — they're already sitting in the database. This re-checks EVERY
// already-graded pick using the stored final score (gradedScore string,
// format "{away} {awayScore} - {homeScore} {home}"), so it needs no live API
// calls at all — cheap enough to run every cycle — and corrects any pick
// whose result doesn't match what the fixed logic actually says.
export async function regradeHistoricalPicks(sb) {
  try {
    const { data: rows } = await sb.from('game_analyses').select('game_key, away, home, sport, result');
    if (!rows?.length) return 0;

    let correctedCount = 0;
    for (const row of rows) {
      let parsed; try { parsed = JSON.parse(row.result); } catch { continue; }
      if (!parsed?.graded || !parsed.gradedScore) continue;
      const s = parsed.summary;
      if (!s?.pick) continue;

      // gradedScore format: "{away} {awayScore} - {homeScore} {home}"
      const m = parsed.gradedScore.match(/(-?\d+)\s*-\s*(-?\d+)/);
      if (!m) continue;
      const awayScore = parseInt(m[1], 10);
      const homeScore = parseInt(m[2], 10);
      if (isNaN(awayScore) || isNaN(homeScore)) continue;

      const correctResult = gradePick(s, row.away, row.home, awayScore, homeScore);
      if (correctResult === parsed.gradedResult) continue; // already correct

      const updatedResult = { ...parsed, gradedResult: correctResult };
      await sb.from('game_analyses').update({ result: JSON.stringify(updatedResult) }).eq('game_key', row.game_key);
      try {
        await sb.from('ai_track_record').update({ result: correctResult }).eq('game_key', row.game_key);
      } catch {}
      correctedCount++;
    }
    return correctedCount;
  } catch {
    return 0;
  }
}


// Re-verifies every user's already-graded alternate picks against the fixed
// gradePick logic, same correction as regradeHistoricalPicks above but for
// the per-user alt_picks store instead of the shared game_analyses table.
export async function regradeHistoricalAltPicks(sb) {
  try {
    const { data: userRows } = await sb.from('user_data').select('user_id, value').eq('key', 'alt_picks');
    if (!userRows?.length) return 0;

    let correctedCount = 0;
    for (const row of userRows) {
      let altPicks; try { altPicks = JSON.parse(row.value); } catch { continue; }
      if (!altPicks || typeof altPicks !== 'object') continue;

      let changed = false;
      for (const [gameKey, alt] of Object.entries(altPicks)) {
        if (!alt?.result || !alt.score) continue;
        const m = alt.score.match(/(-?\d+)\s*-\s*(-?\d+)/);
        if (!m) continue;
        const awayScore = parseInt(m[1], 10);
        const homeScore = parseInt(m[2], 10);
        if (isNaN(awayScore) || isNaN(homeScore)) continue;

        // score string is "{away} {awayScore} - {homeScore} {home}" — need
        // the actual away/home team names for gradePick's pick-side check.
        const nameMatch = alt.score.match(/^(.+?)\s+-?\d+\s*-\s*-?\d+\s+(.+)$/);
        const away = nameMatch?.[1] || '';
        const home = nameMatch?.[2] || '';

        const correctResult = gradePick(alt, away, home, awayScore, homeScore);
        if (correctResult === alt.result) continue;

        altPicks[gameKey] = { ...alt, result: correctResult };
        changed = true;
        correctedCount++;
      }
      if (changed) {
        await sb.from('user_data').update({ value: JSON.stringify(altPicks) }).eq('user_id', row.user_id).eq('key', 'alt_picks');
      }
    }
    return correctedCount;
  } catch {
    return 0;
  }
}


// When a user picks an alternate market instead of the AI's own recommendation
// (via "View Other Markets"), THAT pick is what should be tracked for them —
// not the AI's original pick. This previously only graded client-side, gated
// behind the game being on that specific user's watchlist AND their device
// having the app open — meaning an alt pick could sit ungraded forever if
// neither condition was met. This runs server-side, for every user's alt
// picks, independent of watchlist or device presence — same fix pattern as
// the AI's own track record grading above.
export async function gradeUserAltPicks(sb, date, base) {
  try {
    const [y, m, d0] = date.split('-').map(Number);
    const dateWindows = [date];
    for (let back = 1; back <= 3; back++) {
      const dObj = new Date(Date.UTC(y, m - 1, d0));
      dObj.setUTCDate(dObj.getUTCDate() - back);
      dateWindows.push(`${dObj.getUTCFullYear()}-${String(dObj.getUTCMonth()+1).padStart(2,'0')}-${String(dObj.getUTCDate()).padStart(2,'0')}`);
    }

    // Pull final scores for the whole window once (keyed by game_key, same
    // format as alt pick keys: `${gameId}-${slot}`), reusing game_analyses
    // rows (away/home/sport) to identify each game behind an alt-pick key.
    const finalsByGameKey = {};
    for (const dd of dateWindows) {
      const { data: rows } = await sb.from('game_analyses').select('game_key, game_id, away, home, sport, date').eq('date', dd);
      if (!rows?.length) continue;
      const gRes = await fetch(`${base}/api/today?date=${dd}`, { cache: 'no-store' });
      if (!gRes.ok) continue;
      const { games: liveGames } = await gRes.json();
      for (const row of rows) {
        // Match by unique game ID first (resolves doubleheader ambiguity —
        // see the identical fix + explanation in gradeCompletedGames above).
        const g = (row.game_id != null && (liveGames || []).find(x => String(x.id) === String(row.game_id)))
          || (liveGames || []).find(x =>
            (x.away === row.away && x.home === row.home) ||
            (x.sport === row.sport && x.away === row.away && x.home === row.home)
          );
        const hasStarted = g?.rawTime ? new Date(g.rawTime) <= new Date() : false; // SAFE DEFAULT: if we can't confirm the game has started (no match found, or missing start time), assume it has NOT — never risk grading a game we can't verify
        if (g?.isFinal === true && hasStarted && g.awayScore != null && g.homeScore != null) {
          finalsByGameKey[row.game_key] = { away: row.away, home: row.home, awayScore: g.awayScore, homeScore: g.homeScore };
        }
      }
    }
    if (!Object.keys(finalsByGameKey).length) return 0;

    // Every user's alt_picks — one row per user, value = JSON object keyed
    // by game_key ({ market, pick, betType, selectedAt, result? }).
    const { data: userRows } = await sb.from('user_data').select('user_id, value').eq('key', 'alt_picks');
    if (!userRows?.length) return 0;

    let gradedCount = 0;
    for (const row of userRows) {
      let altPicks; try { altPicks = JSON.parse(row.value); } catch { continue; }
      if (!altPicks || typeof altPicks !== 'object') continue;

      let changed = false;
      for (const [gameKey, alt] of Object.entries(altPicks)) {
        if (!alt || alt.result) continue; // already graded, skip
        const final = finalsByGameKey[gameKey];
        if (!final) continue; // game not final yet, or not in this window

        const result = gradePick(alt, final.away, final.home, final.awayScore, final.homeScore);
        altPicks[gameKey] = {
          ...alt, result,
          score: `${final.away} ${final.awayScore} - ${final.homeScore} ${final.home}`,
          gradedAt: new Date().toISOString(),
        };
        changed = true;
        gradedCount++;
      }

      if (changed) {
        await sb.from('user_data').update({ value: JSON.stringify(altPicks) }).eq('user_id', row.user_id).eq('key', 'alt_picks');
      }
    }
    return gradedCount;
  } catch {
    return 0;
  }
}
