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
  const betType = (pick.betType || 'ML');
  const awayWon = awayScore > homeScore;
  const homeWon = homeScore > awayScore;
  const margin = Math.abs(homeScore - awayScore);
  const pickIsAway = pickTeam === away || away?.includes(pickTeam) || pickTeam?.includes((away || '').split(' ').pop());
  const pickIsHome = !pickIsAway;

  const bt = betType.toUpperCase();
  if (bt.includes('OVER')) {
    const total = parseFloat(bt.replace(/[^0-9.]/g, ''));
    return (awayScore + homeScore) > total ? 'win' : 'loss';
  }
  if (bt.includes('UNDER')) {
    const total = parseFloat(bt.replace(/[^0-9.]/g, ''));
    return (awayScore + homeScore) < total ? 'win' : 'loss';
  }
  if (bt.includes('-1.5') || bt.includes('RUN LINE')) {
    return (pickIsAway && awayWon && margin >= 2) || (pickIsHome && homeWon && margin >= 2) ? 'win' : 'loss';
  }
  if (bt.includes('+1.5')) {
    return (pickIsAway && (awayWon || margin <= 1)) || (pickIsHome && (homeWon || margin <= 1)) ? 'win' : 'loss';
  }
  // ML default
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
      const { data: rows } = await sb.from('game_analyses').select('game_key, away, home, sport, result, date').eq('date', dd);
      if (!rows?.length) continue;

      const gRes = await fetch(`${base}/api/today?date=${dd}`, { cache: 'no-store' });
      if (!gRes.ok) continue;
      const { games: liveGames } = await gRes.json();

      for (const row of rows) {
        let parsed; try { parsed = JSON.parse(row.result); } catch { continue; }
        if (parsed?.graded) continue; // already graded, skip
        const s = parsed?.summary;
        if (!s?.pick || s.tier === 'PASS' || s.tier === '3') continue;

        const g = (liveGames || []).find(x =>
          (x.away === row.away && x.home === row.home) ||
          (x.sport === row.sport && x.away === row.away && x.home === row.home)
        );
        const isFinal = g?.isFinal === true;
        const awayScore = g?.awayScore;
        const homeScore = g?.homeScore;
        if (!isFinal || awayScore == null || homeScore == null) continue;

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
