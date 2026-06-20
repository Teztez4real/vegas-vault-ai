import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── CHANGE DETECTION ──────────────────────────────────────────────────────────
// Returns an array of detected changes for a game vs its stored snapshot.
// Only flags changes significant enough to warrant re-analysis and notification.
function detectChanges(current, snapshot) {
  if (!snapshot) return [{ type: 'FIRST_ANALYSIS', label: 'Initial analysis', severity: 'INFO' }];

  const changes = [];

  // Starting pitcher changed
  if (current.awayPitcher && snapshot.awayPitcher &&
      current.awayPitcher !== 'TBD' && snapshot.awayPitcher !== 'TBD' &&
      current.awayPitcher !== snapshot.awayPitcher) {
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.away} pitcher changed: ${snapshot.awayPitcher} → ${current.awayPitcher}`, severity: 'HIGH' });
  }
  if (current.homePitcher && snapshot.homePitcher &&
      current.homePitcher !== 'TBD' && snapshot.homePitcher !== 'TBD' &&
      current.homePitcher !== snapshot.homePitcher) {
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.home} pitcher changed: ${snapshot.homePitcher} → ${current.homePitcher}`, severity: 'HIGH' });
  }

  // Pitcher moved from TBD to confirmed (lineup/starter confirmed)
  if (snapshot.awayPitcher === 'TBD' && current.awayPitcher && current.awayPitcher !== 'TBD') {
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.away} starter confirmed: ${current.awayPitcher}`, severity: 'HIGH' });
  }
  if (snapshot.homePitcher === 'TBD' && current.homePitcher && current.homePitcher !== 'TBD') {
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.home} starter confirmed: ${current.homePitcher}`, severity: 'HIGH' });
  }

  // Lineup confirmed (went from "Not yet posted" to actual lineup)
  const awayLineupConfirmed = snapshot.awayLineup === 'Not yet posted' && current.awayLineup !== 'Not yet posted' && current.awayLineup?.length > 20;
  const homeLineupConfirmed = snapshot.homeLineup === 'Not yet posted' && current.homeLineup !== 'Not yet posted' && current.homeLineup?.length > 20;
  if (awayLineupConfirmed || homeLineupConfirmed) {
    const who = awayLineupConfirmed && homeLineupConfirmed ? 'Both lineups' : awayLineupConfirmed ? `${current.away} lineup` : `${current.home} lineup`;
    changes.push({ type: 'LINEUP_CONFIRMED', label: `${who} confirmed for ${current.away} @ ${current.home}`, severity: 'HIGH' });
  }

  // Injury changes — new players mentioned in injuries that weren't before
  if (current.injuries && snapshot.injuries && current.injuries !== snapshot.injuries &&
      current.injuries !== 'Injury data unavailable' && current.injuries !== 'None reported') {
    changes.push({ type: 'INJURY_UPDATE', label: `Injury report updated: ${current.away} @ ${current.home}`, severity: 'HIGH' });
  }

  // Trell Rule trigger — star player status change detected via injury field
  const trellKeywords = ['out', 'scratched', 'il', 'injured list', 'day-to-day', 'dtd', 'questionable'];
  const prevHadStar = snapshot.injuries ? trellKeywords.some(k => snapshot.injuries.toLowerCase().includes(k)) : false;
  const currHasStar = current.injuries ? trellKeywords.some(k => current.injuries.toLowerCase().includes(k)) : false;
  if (currHasStar && !prevHadStar) {
    changes.push({ type: 'TRELL_RULE', label: `⚠️ Trell Rule alert — key player status change: ${current.away} @ ${current.home}`, severity: 'CRITICAL' });
  }

  // Significant ML line movement (15+ points)
  const prevAwayML = parseFloat((snapshot.awayML || '0').replace(/[^-\d.]/g, ''));
  const currAwayML = parseFloat((current.awayML || '0').replace(/[^-\d.]/g, ''));
  if (!isNaN(prevAwayML) && !isNaN(currAwayML) && Math.abs(currAwayML - prevAwayML) >= 15) {
    const dir = currAwayML < prevAwayML ? 'shortened' : 'lengthened';
    changes.push({ type: 'LINE_MOVEMENT', label: `Sharp ML movement: ${current.away} line ${dir} (${snapshot.awayML} → ${current.awayML})`, severity: 'MEDIUM' });
  }

  // Total movement (0.5+ points)
  const prevTotal = parseFloat(snapshot.total || '0');
  const currTotal = parseFloat(current.total || '0');
  if (!isNaN(prevTotal) && !isNaN(currTotal) && prevTotal > 0 && currTotal > 0 && Math.abs(currTotal - prevTotal) >= 0.5) {
    changes.push({ type: 'TOTAL_MOVEMENT', label: `Total moved: ${snapshot.total} → ${current.total} for ${current.away} @ ${current.home}`, severity: 'MEDIUM' });
  }

  // Weather significant change (wind direction or large temp shift)
  if (current.weather && snapshot.weather && current.weather !== snapshot.weather) {
    const currWind = current.weather.match(/(\d+)mph/)?.[1] || 0;
    const prevWind = snapshot.weather.match(/(\d+)mph/)?.[1] || 0;
    if (Math.abs(parseInt(currWind) - parseInt(prevWind)) >= 8) {
      changes.push({ type: 'WEATHER_CHANGE', label: `Weather update: wind changed for ${current.home}`, severity: 'MEDIUM' });
    }
  }

  return changes;
}

// ── FINALIZATION CHECK ────────────────────────────────────────────────────────
// A play is "finalized" (BET NOW) when:
// - Both lineups are confirmed, AND
// - Game starts in 30–90 minutes
function isFinalizable(game) {
  if (!game.rawTime) return false;
  const gameStart = new Date(game.rawTime);
  const now = new Date();
  const minsUntil = (gameStart - now) / 60000;
  if (minsUntil < 0 || minsUntil > 90) return false;
  // Both lineups confirmed
  const awayConfirmed = game.awayLineup && game.awayLineup !== 'Not yet posted' && game.awayLineup.length > 20;
  const homeConfirmed = game.homeLineup && game.homeLineup !== 'Not yet posted' && game.homeLineup.length > 20;
  return awayConfirmed && homeConfirmed;
}

// ── FIND USERS WHO WATCHLISTED A GAME ────────────────────────────────────────
async function findWatchlistedUsers(gameId) {
  try {
    const { data, error } = await sb
      .from('user_data')
      .select('user_id, value')
      .eq('key', 'watchlist');
    if (error || !data) return [];
    return data
      .filter(row => {
        try {
          const wl = JSON.parse(row.value);
          return Array.isArray(wl) && wl.includes(gameId);
        } catch { return false; }
      })
      .map(row => row.user_id);
  } catch { return []; }
}

// ── SEND PUSH TO SPECIFIC USERS ───────────────────────────────────────────────
async function pushToUsers(userIds, notification) {
  if (!userIds.length) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/targeted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...notification, userIds, adminKey: process.env.ADMIN_SECRET_KEY }),
    });
  } catch {}
}

// ── SEND PUSH TO ALL SUBSCRIBERS ─────────────────────────────────────────────
async function pushToAll(notification) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...notification, adminKey: process.env.ADMIN_SECRET_KEY }),
    });
  } catch {}
}

// ── TRIGGER RE-ANALYSIS FOR A GAME ───────────────────────────────────────────
async function reanalyzeGame(game, reason) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    if (!result || result.error) return null;

    const gameKey = `${game.id}-${game.slot}`;
    const now = new Date().toISOString();

    // Store in shared game_analyses table
    await sb.from('game_analyses').upsert({
      game_key: gameKey,
      game_id: game.id,
      date: game.date || now.split('T')[0],
      slot: game.slot,
      sport: game.sport,
      away: game.away,
      home: game.home,
      result: JSON.stringify(result),
      auto_update_reason: reason,
      updated_at: now,
    }, { onConflict: 'game_key' });

    return result;
  } catch { return null; }
}

// ── STORE / LOAD GAME SNAPSHOT ────────────────────────────────────────────────
async function loadSnapshot(gameId) {
  try {
    const { data } = await sb.from('user_data')
      .select('value')
      .eq('user_id', 'SYSTEM_SNAPSHOT')
      .eq('key', `snap_${gameId}`)
      .single();
    return data ? JSON.parse(data.value) : null;
  } catch { return null; }
}

async function saveSnapshot(gameId, gameData) {
  try {
    const snap = {
      awayPitcher: gameData.awayPitcher,
      homePitcher: gameData.homePitcher,
      awayLineup: gameData.awayLineup,
      homeLineup: gameData.homeLineup,
      injuries: gameData.injuries,
      awayML: gameData.awayML,
      homeML: gameData.homeML,
      total: gameData.total,
      weather: gameData.weather,
      savedAt: new Date().toISOString(),
    };
    await sb.from('user_data').upsert({
      user_id: 'SYSTEM_SNAPSHOT',
      key: `snap_${gameId}`,
      value: JSON.stringify(snap),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
  } catch {}
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const date = new Date().toISOString().split('T')[0];

    // 1. Fetch today's full game slate with all current data
    const gamesRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/today?date=${date}`,
      { cache: 'no-store' }
    );
    if (!gamesRes.ok) throw new Error('Failed to fetch games');
    const { games } = await gamesRes.json();

    const slateGames = (games || []).filter(g => g.slot && g.slot !== 'NONE' && !g.isFinal);
    if (!slateGames.length) {
      return NextResponse.json({ message: 'No active slate games', updated: 0 });
    }

    const updateLog = [];
    const finalizedPlays = [];

    for (const game of slateGames) {
      try {
        // 2. Load previous snapshot for this game
        const snapshot = await loadSnapshot(game.id);

        // 3. Detect what changed
        const changes = detectChanges(game, snapshot);
        const significantChanges = changes.filter(c => c.severity === 'HIGH' || c.severity === 'CRITICAL' || c.severity === 'MEDIUM');

        // 4. If something significant changed, re-analyze
        if (significantChanges.length > 0) {
          const primaryChange = significantChanges[0];
          const reason = significantChanges.map(c => c.label).join(' | ');

          console.log(`[smart-update] Re-analyzing ${game.away} @ ${game.home}: ${reason}`);
          const result = await reanalyzeGame(game, reason);

          if (result) {
            updateLog.push({ game: `${game.away} @ ${game.home}`, changes: significantChanges });

            // 5. Find users who watchlisted this game and notify them
            const watchlistedUsers = await findWatchlistedUsers(game.id);

            // Build notification based on change type
            let notifTitle, notifBody;
            if (primaryChange.type === 'TRELL_RULE') {
              notifTitle = `⚠️ Trell Rule — ${game.away} @ ${game.home}`;
              notifBody = `Key player status changed. Analysis auto-updated.`;
            } else if (primaryChange.type === 'PITCHER_CHANGE') {
              notifTitle = `🔄 Pitcher Change — ${game.away} @ ${game.home}`;
              notifBody = primaryChange.label;
            } else if (primaryChange.type === 'LINEUP_CONFIRMED') {
              notifTitle = `📋 Lineup Confirmed — ${game.away} @ ${game.home}`;
              notifBody = `Final lineups posted. Analysis auto-updated.`;
            } else if (primaryChange.type === 'INJURY_UPDATE') {
              notifTitle = `🚨 Injury Alert — ${game.away} @ ${game.home}`;
              notifBody = `Injury report changed. Analysis auto-updated.`;
            } else if (primaryChange.type === 'LINE_MOVEMENT') {
              notifTitle = `📊 Sharp Money — ${game.away} @ ${game.home}`;
              notifBody = primaryChange.label;
            } else {
              notifTitle = `🔄 Updated — ${game.away} @ ${game.home}`;
              notifBody = `Analysis auto-updated: ${primaryChange.label}`;
            }

            if (watchlistedUsers.length > 0) {
              // Send targeted notification to watchlisted users
              await pushToUsers(watchlistedUsers, {
                title: notifTitle,
                body: notifBody,
                url: '/',
                tag: `vv-update-${game.id}`,
              });
            }
          }
        }

        // 6. Check for finalization (BET NOW signal)
        if (isFinalizable(game)) {
          // Only send if not already finalized (check existing analysis)
          const { data: existing } = await sb
            .from('game_analyses')
            .select('finalized_notified_at, result')
            .eq('game_key', `${game.id}-${game.slot}`)
            .single();

          if (existing && !existing.finalized_notified_at) {
            let pick = 'Play ready';
            try {
              const r = JSON.parse(existing.result);
              pick = `${r.summary?.pick} ${r.summary?.betType}`;
            } catch {}

            finalizedPlays.push({ game, pick });

            // Mark as finalization notified
            await sb.from('game_analyses')
              .update({ finalized_notified_at: new Date().toISOString() })
              .eq('game_key', `${game.id}-${game.slot}`);

            // Notify watchlisted users that this play is BET NOW
            const watchlistedUsers = await findWatchlistedUsers(game.id);
            if (watchlistedUsers.length > 0) {
              await pushToUsers(watchlistedUsers, {
                title: `🔒 BET NOW — ${game.away} @ ${game.home}`,
                body: `${pick} — Lineups confirmed, play is locked. Place your bet.`,
                url: '/',
                tag: `vv-finalized-${game.id}`,
              });
            }
          }
        }

        // 7. Always save the latest snapshot (even if no changes — keeps it fresh)
        await saveSnapshot(game.id, game);

      } catch (err) {
        console.error(`[smart-update] Error processing ${game.id}:`, err.message);
      }
    }

    // 8. If all games are finalized/analyzed, send a "Slate Complete" notification
    const { data: allAnalyses } = await sb
      .from('game_analyses')
      .select('game_key')
      .eq('date', date);

    const analyzedKeys = new Set((allAnalyses || []).map(a => a.game_key));
    const allDone = slateGames.every(g => analyzedKeys.has(`${g.id}-${g.slot}`));

    if (allDone && updateLog.length > 0) {
      await pushToAll({
        title: '✅ Vegas Vault AI — Slate Updated',
        body: `${updateLog.length} game${updateLog.length > 1 ? 's' : ''} auto-updated. All plays current.`,
        url: '/',
        tag: 'vv-slate-update',
      });
    }

    return NextResponse.json({
      success: true,
      date,
      gamesChecked: slateGames.length,
      gamesUpdated: updateLog.length,
      finalizedPlays: finalizedPlays.length,
      updates: updateLog.map(u => ({ game: u.game, changeCount: u.changes.length })),
    });

  } catch (err) {
    console.error('[smart-update] Fatal error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST for manual trigger from admin
export async function POST(req) {
  try {
    const { adminKey } = await req.json();
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const mockReq = new Request(req.url, {
      method: 'GET',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return GET(mockReq);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
