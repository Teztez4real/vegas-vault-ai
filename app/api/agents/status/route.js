/**
 * /api/agents/status — real status of every automated agent (cron job).
 *
 * Reads the agent_heartbeats table (written by each cron when it runs) and
 * joins it with the canonical roster, deriving a display health per agent.
 * This is what powers the Agents page's live "are my employees working?" view,
 * replacing the old hardcoded "Running" badges.
 *
 * Degrades gracefully: if the migration hasn't been run yet (table missing) or
 * a cron has never fired, agents come back as 'unknown' ("awaiting first run")
 * rather than erroring — an honest empty state, never a fake green light.
 */

import { NextResponse } from 'next/server';
import { AGENTS, deriveStatus } from '@/lib/agentHeartbeat';

export const runtime = 'nodejs';

async function getSB() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export async function GET() {
  let byKey = {};
  try {
    const sb = await getSB();
    const { data } = await sb.from('agent_heartbeats').select('*');
    for (const row of data || []) byKey[row.agent_key] = row;
  } catch {
    // table missing / DB blip — fall through with empty heartbeats
  }

  const now = Date.now();
  const agents = AGENTS.map(a => {
    const hb = byKey[a.key] || null;
    return {
      key: a.key,
      name: a.name,
      role: a.role,
      icon: a.icon,
      desc: a.desc,
      status: deriveStatus(a, hb, now),   // on | idle | stale | error | unknown
      lastRunAt: hb?.last_run_at || null,
      detail: hb?.detail || '',
      count: hb?.count ?? null,
    };
  });

  return NextResponse.json({ agents, fetchedAt: new Date().toISOString() });
}
