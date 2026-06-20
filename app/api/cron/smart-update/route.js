import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function detectChanges(current, snapshot) {
  if (!snapshot) return [{ type: 'FIRST_ANALYSIS', label: 'Initial analysis', severity: 'INFO' }];
  const changes = [];
  if (current.awayPitcher && snapshot.awayPitcher && current.awayPitcher !== 'TBD' && snapshot.awayPitcher !== 'TBD' && current.awayPitcher !== snapshot.awayPitcher)
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.away} pitcher changed: ${snapshot.awayPitcher} → ${current.awayPitcher}`, severity: 'HIGH' });
  if (current.homePitcher && snapshot.homePitcher && current.homePitcher !== 'TBD' && snapshot.homePitcher !== 'TBD' && current.homePitcher !== snapshot.homePitcher)
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.home} pitcher changed: ${snapshot.homePitcher} → ${current.homePitcher}`, severity: 'HIGH' });
  if (snapshot.awayPitcher === 'TBD' && current.awayPitcher && current.awayPitcher !== 'TBD')
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.away} starter confirmed: ${current.awayPitcher}`, severity: 'HIGH' });
  if (snapshot.homePitcher === 'TBD' && current.homePitcher && current.homePitcher !== 'TBD')
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.home} starter confirmed: ${current.homePitcher}`, severity: 'HIGH' });
  const awayLineupConfirmed = snapshot.awayLineup === 'Not yet posted' && current.awayLineup !== 'Not yet posted' && current.awayLineup?.length > 20;
  const homeLineupConfirmed = snapshot.homeLineup === 'Not yet posted' && current.homeLineup !== 'Not yet posted' && current.homeLineup?.length > 20;
  if (awayLineupConfirmed || homeLineupConfirmed) {
    const who = awayLineupConfirmed && homeLineupConfirmed ? 'Both lineups' : awayLineupConfirmed ? `${current.away} lineup` : `${current.home} lineup`;
    changes.push({ type: 'LINEUP_CONFIRMED', label: `${who} confirmed`, severity: 'HIGH' });
  }
  if (current.injuries && snapshot.injuries && current.injuries !== snapshot.injuries && current.injuries !== 'Injury data unavailable' && current.injuries !== 'None reported')
    changes.push({ type: 'INJURY_UPDATE', label: `Injury report updated: ${current.away} @ ${current.home}`, severity: 'HIGH' });
  const trellKeywords = ['out', 'scratched', 'il', 'injured list', 'day-to-day', 'dtd', 'questionable'];
  const prevHadStar = snapshot.injuries ? trellKeywords.some(k => snapshot.injuries.toLowerCase().includes(k)) : false;
  const currHasStar = current.injuries ? trellKeywords.some(k => current.injuries.toLowerCase().includes(k)) : false;
  if (currHasStar && !prevHadStar)
    changes.push({ type: 'TRELL_RULE', label: `⚠️ Trell Rule alert — key player status change`, severity: 'CRITICAL' });
  const prevAwayML = parseFloat((snapshot.awayML || '0').replace(/[^-\d.]/g, ''));
  const currAwayML = parseFloat((current.awayML || '0').replace(/[^-\d.]/g, ''));
  if (!isNaN(prevAwayML) && !isNaN(currAwayML) && Math.abs(currAwayML - prevAwayML) >= 15)
    changes.push({ type: 'LINE_MOVEMENT', label: `Sharp ML movement: ${current.away} (${snapshot.awayML} → ${current.awayML})`, severity: 'MEDIUM' });
  const prevTotal = parseFloat(snapshot.total || '0');
  const currTotal = parseFloat(current.total || '0');
  if (!isNaN(prevTotal) && !isNaN(currTotal) && prevTotal > 0 && currTotal > 0 && Math.abs(currTotal - prevTotal) >= 0.5)
    changes.push({ type: 'TOTAL_MOVEMENT', label: `Total moved: ${snapshot.total} → ${current.total}`, severity: 'MEDIUM' });
  return changes;
}

function isFinalizable(game) {
  if (!game.rawTime) return false;
  const minsUntil = (new Date(game.rawTime) - new Date()) / 60000;
  if (minsUntil < 0 || minsUntil > 90) return false;
  return game.awayLineup && game.awayLineup !== 'Not yet posted' && game.awayLineup.length > 20 &&
         game.homeLineup && game.homeLineup !== 'Not yet posted' && game.homeLineup.length > 20;
}

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Lazy init — prevents module-level throws during Vercel build data collection
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const date = new Date().toISOString().split('T')[0];
    const gamesRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/today?date=${date}`, { cache: 'no-store' });
    if (!gamesRes.ok) throw new Error('Failed to fetch games');
    const { games } = await gamesRes.json();
    const slateGames = (games || []).filter(g => g.slot && g.slot !== 'NONE' && !g.isFinal);
    if (!slateGames.length) return NextResponse.json({ message: 'No active slate games', updated: 0 });

    const updateLog = [], finalizedPlays = [];

    for (const game of slateGames) {
      try {
        const { data: snapRow } = await sb.from('user_data').select('value').eq('user_id', 'SYSTEM_SNAPSHOT').eq('key', `snap_${game.id}`).single();
        const snapshot = snapRow ? JSON.parse(snapRow.value) : null;
        const changes = detectChanges(game, snapshot).filter(c => c.severity === 'HIGH' || c.severity === 'CRITICAL' || c.severity === 'MEDIUM');

        if (changes.length > 0) {
          const reason = changes.map(c => c.label).join(' | ');
          const reRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game }) });
          if (reRes.ok) {
            const result = await reRes.json();
            const gameKey = `${game.id}-${game.slot}`;
            await sb.from('game_analyses').upsert({ game_key: gameKey, game_id: game.id, date, slot: game.slot, sport: game.sport, away: game.away, home: game.home, result: JSON.stringify(result), auto_update_reason: reason, updated_at: new Date().toISOString() }, { onConflict: 'game_key' });
            updateLog.push({ game: `${game.away} @ ${game.home}`, changeCount: changes.length });

            const wlData = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
            const watchlistedUsers = (wlData.data || []).filter(r => { try { return JSON.parse(r.value).includes(game.id); } catch { return false; } }).map(r => r.user_id);
            if (watchlistedUsers.length > 0) {
              await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/targeted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `🔄 Updated — ${game.away} @ ${game.home}`, body: changes[0].label, url: '/', tag: `vv-update-${game.id}`, userIds: watchlistedUsers, adminKey: process.env.ADMIN_SECRET_KEY }) });
            }
          }
        }

        if (isFinalizable(game)) {
          const { data: existing } = await sb.from('game_analyses').select('finalized_notified_at, result').eq('game_key', `${game.id}-${game.slot}`).single();
          if (existing && !existing.finalized_notified_at) {
            let pick = 'Play ready';
            try { const r = JSON.parse(existing.result); pick = `${r.summary?.pick} ${r.summary?.betType}`; } catch {}
            finalizedPlays.push({ game, pick });
            await sb.from('game_analyses').update({ finalized_notified_at: new Date().toISOString() }).eq('game_key', `${game.id}-${game.slot}`);
            const wlData = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
            const wlUsers = (wlData.data || []).filter(r => { try { return JSON.parse(r.value).includes(game.id); } catch { return false; } }).map(r => r.user_id);
            if (wlUsers.length > 0) {
              await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/targeted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `🔒 BET NOW — ${game.away} @ ${game.home}`, body: `${pick} — Lineups confirmed. Place your bet.`, url: '/', tag: `vv-finalized-${game.id}`, userIds: wlUsers, adminKey: process.env.ADMIN_SECRET_KEY }) });
            }
          }
        }

        await sb.from('user_data').upsert({ user_id: 'SYSTEM_SNAPSHOT', key: `snap_${game.id}`, value: JSON.stringify({ awayPitcher: game.awayPitcher, homePitcher: game.homePitcher, awayLineup: game.awayLineup, homeLineup: game.homeLineup, injuries: game.injuries, awayML: game.awayML, homeML: game.homeML, total: game.total, weather: game.weather, savedAt: new Date().toISOString() }), updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
      } catch (err) { console.error(`[smart-update] ${game.id}:`, err.message); }
    }

    return NextResponse.json({ success: true, date, gamesChecked: slateGames.length, gamesUpdated: updateLog.length, finalizedPlays: finalizedPlays.length, updates: updateLog });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { adminKey } = await req.json();
    if (adminKey !== process.env.ADMIN_SECRET_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return GET(new Request(req.url, { method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
