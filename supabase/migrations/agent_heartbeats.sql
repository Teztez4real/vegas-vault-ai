-- Run this once in Supabase → SQL Editor.
-- Each automated "agent" (cron job) writes a heartbeat here every time it runs,
-- so the Agents page can show REAL status (last run, healthy/idle/stale, and
-- how much it processed) instead of a hardcoded "Running" badge. This is what
-- makes "every agent is doing their job" verifiable without opening the app.

create table if not exists agent_heartbeats (
  agent_key    text primary key,   -- e.g. 'analysis', 'foundation', 'top-play'
  status       text default 'ok',  -- 'ok' | 'idle' | 'error'
  detail       text default '',    -- short human note about the last run
  count        integer default 0,  -- items processed on the last run
  last_run_at  timestamptz default now(),
  updated_at   timestamptz default now()
);
