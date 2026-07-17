/**
 * Agent heartbeat system — the "are my employees actually working?" layer.
 *
 * Every automated cron job records a heartbeat when it runs. The Agents page
 * reads these and shows each agent's REAL status (last run, healthy/idle/stale,
 * items processed) instead of a cosmetic hardcoded "Running" badge.
 *
 * Writes are best-effort: recordHeartbeat swallows its own errors so a missing
 * table or a transient DB blip can NEVER break the actual job (analysis,
 * grading, etc.). Observability must never take down the thing it observes.
 */

// The canonical roster — the "employees." Order here is the display order.
// expectedIntervalMin drives staleness: an agent that hasn't checked in within
// a grace multiple of its expected cadence is flagged stale (something's wrong).
export const AGENTS = [
  {
    key: 'foundation', name: 'Foundation Agent', role: 'Slot Strategy', icon: 'ti-layout-grid',
    desc: 'Every morning, decides PUBLIC vs VEGAS for each game when you have not set the pattern yourself — never overwrites your manual choice.',
    expectedIntervalMin: 24 * 60,
  },
  {
    key: 'slate-sync', name: 'Slate Sync Agent', role: 'Data Pipeline', icon: 'ti-refresh',
    desc: 'Pulls the daily schedule, records, injuries, and live odds from MLB Stats API, ESPN, and the odds providers for every sport in season.',
    expectedIntervalMin: 30,
  },
  {
    key: 'analysis', name: 'Analysis Agent', role: 'AI Engine', icon: 'ti-target-arrow',
    desc: 'Runs the full sport-specific 4-stage analysis on every slotted game the moment it is eligible, and publishes the pick to every client.',
    expectedIntervalMin: 30,
  },
  {
    key: 'scam-hunter', name: 'Scam Hunter Agent', role: 'Edge Detection', icon: 'ti-shield-check',
    desc: 'Runs the multi-layer scam hunt (ML, spread, total, form, propaganda, situational) on every Vegas-slot game to find the mispricing.',
    expectedIntervalMin: 30,
  },
  {
    key: 'top-play', name: 'Top Play Agent', role: 'Daily Curation', icon: 'ti-star',
    desc: 'Selects and caches the single best play of the day, generated server-side so it is ready before anyone opens the app.',
    expectedIntervalMin: 24 * 60,
  },
  {
    key: 'outcome-tracker', name: 'Outcome Tracker', role: 'Results', icon: 'ti-clock',
    desc: 'Checks final scores after games, applies WIN/LOSS/PUSH grades to every pick, and updates the shared track record and analytics.',
    expectedIntervalMin: 30,
  },
  {
    key: 'notification', name: 'Notification Agent', role: 'Alerts', icon: 'ti-bell-ringing',
    desc: 'Pushes an alert when the slate is fully analyzed and when a tracked game materially changes, so clients never have to sit and refresh.',
    expectedIntervalMin: 24 * 60,
  },
];

export const AGENT_KEYS = AGENTS.map(a => a.key);

/**
 * Record a heartbeat. Best-effort — never throws.
 * @param sb Supabase service-role client
 * @param key one of AGENT_KEYS
 * @param status 'ok' | 'idle' | 'error'
 * @param detail short human note
 * @param count items processed
 */
export async function recordHeartbeat(sb, key, { status = 'ok', detail = '', count = 0 } = {}) {
  try {
    const now = new Date().toISOString();
    await sb.from('agent_heartbeats').upsert(
      { agent_key: key, status, detail: String(detail).slice(0, 300), count, last_run_at: now, updated_at: now },
      { onConflict: 'agent_key' }
    );
  } catch {
    // Swallow — observability must never break the job it observes.
  }
}

/**
 * Derive a display status for an agent from its heartbeat row.
 * Returns one of: 'on' (green), 'idle' (amber), 'stale' (red), 'error' (red),
 * 'unknown' (grey — no heartbeat yet / awaiting first run).
 */
export function deriveStatus(agent, hb, now = Date.now()) {
  if (!hb || !hb.last_run_at) return 'unknown';
  const last = new Date(hb.last_run_at).getTime();
  if (isNaN(last)) return 'unknown';
  const ageMin = (now - last) / 60000;
  // Stale threshold: 3x the expected cadence, with a floor so a 30-min agent
  // isn't flagged on a single skipped cycle. Daily agents get ~30h.
  const staleAfter = Math.max(agent.expectedIntervalMin * 3, 90);
  if (ageMin > staleAfter) return 'stale';
  if (hb.status === 'error') return 'error';
  if (hb.status === 'idle') return 'idle';
  return 'on';
}

// Compact "3m ago" / "2h ago" / "1d ago" formatting for the UI.
export function agoLabel(iso, now = Date.now()) {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
