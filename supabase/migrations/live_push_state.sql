-- Run this once in Supabase → SQL Editor.
-- Tracks the last live-score state we pushed for each game, so the live-score
-- ticker only sends an update when something actually changed (new run,
-- inning change, etc.) instead of re-sending an identical notification
-- every couple of minutes.

create table if not exists live_push_state (
  game_id      text primary key,
  last_state   text not null,   -- e.g. "3-2|Top 6"
  updated_at   timestamptz default now()
);
