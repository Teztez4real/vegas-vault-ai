/**
 * /api/auto-slot-pattern  — the "AI sets the foundation for you" morning cron.
 *
 * WHY THIS EXISTS
 * Slot-system sports (MLB, NBA, WNBA, NFL, CFB) only get auto-analyzed once a
 * PUBLIC/VEGAS pattern exists for the day — and until now that pattern could
 * ONLY be typed in by hand in Settings. If the admin didn't do it, the
 * analyze cron no-op'd all day. This cron removes that dependency: at 6 AM
 * Central it lets the AI assign each game a PUBLIC or VEGAS slot following the
 * mentorship "foundation," writes it, and kicks off analysis — so the full
 * slate is analyzed in the morning with no browser ever opened.
 *
 * IT NEVER OVERWRITES A MANUAL CHOICE. If a pattern already exists for a
 * (date, sport) — because the admin set it in Settings — that sport is
 * skipped. The human always wins.
 *
 * Positional contract: the manual system stores `pattern` as an array of
 * 'PUBLIC'/'VEGAS' applied positionally to the time-ordered slate
 * (assignSlotFromPattern: games[i] -> pattern[i % len]). So we produce an
 * array of exactly one slot per game, in the same order /api/today returns
 * that sport's games, and it maps 1:1.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL } from '@/lib/aiModel';
import { ENABLED_SPORT_KEYS, hasSlotSystem, slotPatternKeyFor, getSport } from '@/lib/sports';
import { buildSlotPrompt, parseSlots } from '@/lib/slotFoundation';
import { recordHeartbeat } from '@/lib/agentHeartbeat';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getSB() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// US Central "now" — slot patterns and the slate are keyed by CT, and the
// America/Chicago timezone handles DST correctly (unlike a fixed UTC offset).
function ctParts() {
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const date = `${ctNow.getFullYear()}-${String(ctNow.getMonth() + 1).padStart(2, '0')}-${String(ctNow.getDate()).padStart(2, '0')}`;
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { date, hour: ctNow.getHours(), dowNum: ctNow.getDay(), dow: DOW[ctNow.getDay()] };
}

async function decideSlots(sportLabel, dateStr, dow, games) {
  const prompt = buildSlotPrompt(sportLabel, dateStr, dow, games);
  const msg = await ai.messages.create({
    model: AI_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt + '\n\nRespond with the JSON object only.' }],
  });
  const raw = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return parseSlots(raw, games.length);
}

async function run(origin, { dryRun = false, force = false } = {}) {
  const { date, hour, dow } = ctParts();

  // Time guard (skipped for an explicit admin `force`): only do real work in
  // the morning window. Two UTC cron fires (11:00 + 12:00) straddle DST; this
  // guard makes exactly one of them land at/after 6 AM local and proceed,
  // while the earlier winter fire (5 AM local) cleanly no-ops.
  if (!force && (hour < 6 || hour >= 12)) {
    return { skipped: 'outside-morning-window', ctHour: hour, date };
  }

  const base = origin || process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const slateRes = await fetch(`${base}/api/today?date=${date}`, { cache: 'no-store' });
  if (!slateRes.ok) return { error: `slate fetch failed (HTTP ${slateRes.status})`, date };
  const { games } = await slateRes.json();
  if (!games?.length) return { message: 'No games on the slate today', date, assigned: [] };

  const sb = await getSB();
  const assigned = [];

  // Registry-driven: every enabled slot-system sport. CBB (hasSlotSystem:false)
  // is a genuine no-slot sport and is correctly excluded — it auto-analyzes on
  // its own. A future slot sport is picked up automatically.
  const slotSports = ENABLED_SPORT_KEYS.filter(k => hasSlotSystem(k));

  for (const sportKey of slotSports) {
    const tableKey = slotPatternKeyFor(sportKey); // lowercase key for slot_patterns
    if (!tableKey) continue;

    const sportGames = games.filter(g => g.sport === sportKey && !(g.rawTime && new Date(g.rawTime) <= new Date()));
    if (!sportGames.length) { assigned.push({ sport: sportKey, status: 'no-games' }); continue; }

    // NEVER overwrite a manually-saved (or already auto-saved) pattern.
    const { data: existing } = await sb.from('slot_patterns').select('pattern').eq('date', date).eq('sport', tableKey).maybeSingle();
    if (existing?.pattern?.length) { assigned.push({ sport: sportKey, status: 'already-set', count: existing.pattern.length }); continue; }

    let slots = null;
    try {
      slots = await decideSlots(getSport(sportKey).label, date, dow, sportGames);
    } catch (e) {
      assigned.push({ sport: sportKey, status: 'ai-error', error: e.message });
      continue; // isolate per-sport failure — one sport's error never aborts the rest
    }
    if (!slots) { assigned.push({ sport: sportKey, status: 'ai-parse-failed' }); continue; }

    if (dryRun) { assigned.push({ sport: sportKey, status: 'dry-run', pattern: slots }); continue; }

    const { error: wErr } = await sb.from('slot_patterns').upsert(
      { date, sport: tableKey, pattern: slots, note: 'AI-assigned (auto-slot-pattern cron)', created_at: new Date().toISOString() },
      { onConflict: 'date,sport' }
    );
    assigned.push(wErr ? { sport: sportKey, status: 'write-error', error: wErr.message } : { sport: sportKey, status: 'assigned', pattern: slots });
  }

  // Kick off analysis right away so the freshly-slotted games are analyzed in
  // the morning, not whenever the next 30-min analyze cron happens to run.
  let analyzeTriggered = false;
  if (!dryRun && assigned.some(a => a.status === 'assigned')) {
    try {
      await fetch(`${base}/api/auto-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vv-cron': '1' },
        body: JSON.stringify({ date, base }),
      });
      analyzeTriggered = true;
    } catch {}
  }

  // Foundation Agent heartbeat — records what the morning run actually did.
  // 'ok' if it assigned at least one sport; 'idle' if everything was already
  // set manually or there were no games (healthy, nothing to do).
  if (!dryRun) {
    const assignedCount = assigned.filter(a => a.status === 'assigned').length;
    const anyError = assigned.some(a => a.status === 'ai-error' || a.status === 'write-error');
    const summary = assigned.map(a => `${a.sport}:${a.status}`).join(', ');
    await recordHeartbeat(sb, 'foundation', {
      status: anyError ? 'error' : (assignedCount > 0 ? 'ok' : 'idle'),
      detail: assignedCount > 0 ? `Assigned ${assignedCount} sport(s) — ${summary}` : `Nothing to assign — ${summary || 'no slate'}`,
      count: assignedCount,
    });
  }

  return { date, dow, ctHour: hour, dryRun, analyzeTriggered, assigned };
}

function isCron(req) {
  const authHeader = req.headers.get('authorization') || '';
  return req.headers.get('x-vercel-cron') != null
    || req.headers.get('x-vv-cron') === '1'
    || (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
}

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = new URL(req.url).origin;
  const result = await run(origin);
  return NextResponse.json(result);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  let authorized = isCron(req) || body.adminKey === process.env.ADMIN_SECRET_KEY;
  // Admin can also authenticate with their own Supabase session token (matches
  // how auto-analyze allows admin-triggered runs), for manual testing.
  if (!authorized && body.token) {
    try {
      const sb = await getSB();
      const { data: { user } } = await sb.auth.getUser(body.token);
      if (user?.email === 'battlecortez@gmail.com') authorized = true;
    } catch {}
  }
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = body.base || new URL(req.url).origin;
  const result = await run(origin, { dryRun: body.dryRun === true, force: body.force === true });
  return NextResponse.json(result);
}
