import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function detectChanges(current, snapshot) {
  if (!snapshot) return [{ type: 'FIRST_ANALYSIS', severity: 'INFO' }];
  const changes = [];
  if (current.awayPitcher && snapshot.awayPitcher && current.awayPitcher !== 'TBD' && snapshot.awayPitcher !== 'TBD' && current.awayPitcher !== snapshot.awayPitcher)
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.away} pitcher: ${snapshot.awayPitcher} → ${current.awayPitcher}`, severity: 'HIGH' });
  if (current.homePitcher && snapshot.homePitcher && current.homePitcher !== 'TBD' && snapshot.homePitcher !== 'TBD' && current.homePitcher !== snapshot.homePitcher)
    changes.push({ type: 'PITCHER_CHANGE', label: `${current.home} pitcher: ${snapshot.homePitcher} → ${current.homePitcher}`, severity: 'HIGH' });
  if (snapshot.awayPitcher === 'TBD' && current.awayPitcher && current.awayPitcher !== 'TBD')
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.away} starter confirmed: ${current.awayPitcher}`, severity: 'HIGH' });
  if (snapshot.homePitcher === 'TBD' && current.homePitcher && current.homePitcher !== 'TBD')
    changes.push({ type: 'PITCHER_CONFIRMED', label: `${current.home} starter confirmed: ${current.homePitcher}`, severity: 'HIGH' });
  const awayConfirmed = snapshot.awayLineup === 'Not yet posted' && current.awayLineup !== 'Not yet posted' && (current.awayLineup?.length || 0) > 20;
  const homeConfirmed = snapshot.homeLineup === 'Not yet posted' && current.homeLineup !== 'Not yet posted' && (current.homeLineup?.length || 0) > 20;
  if (awayConfirmed || homeConfirmed)
    changes.push({ type: 'LINEUP_CONFIRMED', label: `Lineups confirmed: ${current.away} @ ${current.home}`, severity: 'HIGH' });
  if (current.injuries && snapshot.injuries && current.injuries !== snapshot.injuries && current.injuries !== 'None reported')
    changes.push({ type: 'INJURY_UPDATE', label: `Injury update: ${current.away} @ ${current.home}`, severity: 'HIGH' });
  const trellKW = ['out', 'scratched', ' il ', 'day-to-day', 'dtd'];
  if (current.injuries && !snapshot.injuries && trellKW.some(k => current.injuries.toLowerCase().includes(k)))
    changes.push({ type: 'TRELL_RULE', label: `⚠️ Trell Rule: key player status change`, severity: 'CRITICAL' });
  const prevML = parseFloat((snapshot.awayML || '').replace(/[^-\d.]/g, '') || '0');
  const currML = parseFloat((current.awayML || '').replace(/[^-\d.]/g, '') || '0');
  if (prevML && currML && Math.abs(currML - prevML) >= 15)
    changes.push({ type: 'LINE_MOVEMENT', label: `Sharp move: ${current.away} ML ${snapshot.awayML}→${current.awayML}`, severity: 'MEDIUM' });
  return changes;
}

function isFinalizable(game) {
  if (!game.rawTime) return false;
  const mins = (new Date(game.rawTime) - new Date()) / 60000;
  if (mins < 0 || mins > 90) return false;
  return (game.awayLineup?.length || 0) > 20 && game.awayLineup !== 'Not yet posted' &&
         (game.homeLineup?.length || 0) > 20 && game.homeLineup !== 'Not yet posted';
}

export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  // Allow if the secret matches OR if this is an internal admin-proxied call
  const isInternal = req.headers.get('x-vv-internal') === '1';
  if (auth !== expected && !isInternal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const reqUrl = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;

  try {
    // US Central date — matches the slate + slot patterns (not UTC)
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const date = `${ctNow.getFullYear()}-${String(ctNow.getMonth()+1).padStart(2,'0')}-${String(ctNow.getDate()).padStart(2,'0')}`;
    const gRes = await fetch(`${base}/api/today?date=${date}`, { cache: 'no-store' });
    if (!gRes.ok) return NextResponse.json({ error: `Failed to fetch games (${gRes.status})` }, { status: 200 });
    const { games } = await gRes.json();
    const slate = (games || []).filter(g => g.slot && g.slot !== 'NONE' && !g.isFinal);
    if (!slate.length) return NextResponse.json({ message: 'No active games', updated: 0 });

    const log = [], finalized = [];
    for (const game of slate) {
      try {
        const { data: snap } = await sb.from('user_data').select('value').eq('user_id', 'SYSTEM_SNAPSHOT').eq('key', `snap_${game.id}`).single();
        const snapshot = snap ? JSON.parse(snap.value) : null;
        const changes = detectChanges(game, snapshot).filter(c => c.severity !== 'INFO');

        if (changes.length) {
          const reason = changes[0].label;
          const rRes = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game }) });
          if (rRes.ok) {
            const result = await rRes.json();
            const key = `${game.id}-${game.slot}`;
            await sb.from('game_analyses').upsert({ game_key: key, game_id: game.id, date, slot: game.slot, sport: game.sport, away: game.away, home: game.home, result: JSON.stringify({ ...result, updatedAt: new Date().toISOString() }), auto_update_reason: reason, updated_at: new Date().toISOString() }, { onConflict: 'game_key' });
            log.push({ game: `${game.away} @ ${game.home}`, change: reason });

            const { data: wlRows } = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
            const uids = (wlRows || []).filter(r => { try { return JSON.parse(r.value).includes(game.id); } catch { return false; } }).map(r => r.user_id);
            if (uids.length) {
              const notif = { title: `🔄 Updated — ${game.away} @ ${game.home}`, body: reason, url: '/', tag: `vv-${game.id}`, userIds: uids, trigger: 'cron' };
              await fetch(`${base}/api/push/targeted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notif) }).catch(() => {});
            }
          }
        }

        if (isFinalizable(game)) {
          const { data: ex } = await sb.from('game_analyses').select('finalized_notified_at, result').eq('game_key', `${game.id}-${game.slot}`).single();
          if (ex && !ex.finalized_notified_at) {
            let pick = 'Play ready';
            try { const r = JSON.parse(ex.result); pick = `${r.summary?.pick} ${r.summary?.betType}`; } catch {}
            finalized.push(game);
            await sb.from('game_analyses').update({ finalized_notified_at: new Date().toISOString() }).eq('game_key', `${game.id}-${game.slot}`);
            const { data: wlRows } = await sb.from('user_data').select('user_id, value').eq('key', 'watchlist');
            const uids = (wlRows || []).filter(r => { try { return JSON.parse(r.value).includes(game.id); } catch { return false; } }).map(r => r.user_id);
            if (uids.length) await fetch(`${base}/api/push/targeted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `🔒 BET NOW — ${game.away} @ ${game.home}`, body: `${pick} — Place your bet.`, url: '/', tag: `vv-lock-${game.id}`, userIds: uids, trigger: 'cron' }) }).catch(() => {});
          }
        }

        await sb.from('user_data').upsert({ user_id: 'SYSTEM_SNAPSHOT', key: `snap_${game.id}`, value: JSON.stringify({ awayPitcher: game.awayPitcher, homePitcher: game.homePitcher, awayLineup: game.awayLineup, homeLineup: game.homeLineup, injuries: game.injuries, awayML: game.awayML, total: game.total, savedAt: new Date().toISOString() }), updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
      } catch {}
    }
    return NextResponse.json({ success: true, date, gamesChecked: slate.length, gamesUpdated: log.length, finalizedPlays: finalized.length, updates: log });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.trigger !== 'admin' && body?.adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Proxy to GET with an internal header so it doesn't depend on CRON_SECRET
    return GET(new Request(req.url, { method: 'GET', headers: { 'x-vv-internal': '1' } }));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}
