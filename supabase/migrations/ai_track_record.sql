-- Run this once in Supabase → SQL Editor to enable server-side grading.
-- This table stores the AI's OWN track record — every graded pick, computed
-- server-side, independent of any individual user's watchlist. It's what
-- powers the landing page's "Season Win Rate" card going forward.

create table if not exists ai_track_record (
  game_key    text primary key,
  date        text not null,
  sport       text,
  away        text,
  home        text,
  pick        text,
  bet_type    text,
  tier        text,
  result      text not null,          -- 'win' or 'loss'
  score       text,
  graded_at   timestamptz default now()
);

create index if not exists ai_track_record_date_idx on ai_track_record(date);
create index if not exists ai_track_record_result_idx on ai_track_record(result);

-- Row Level Security: readable by anyone (it's public track-record data shown
-- on the landing page), writable only by the service role (server-side only).
alter table ai_track_record enable row level security;

create policy "Public read access" on ai_track_record
  for select using (true);

-- No insert/update/delete policy for anon/authenticated — only the service
-- role key (used server-side in the cron) can write, which bypasses RLS by
-- default in Supabase. No policy needed for that.
