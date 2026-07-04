-- Run this once in Supabase → SQL Editor.
-- Tracks whether the "today's slate is fully analyzed" broadcast notification
-- has already been sent for a given date, so it only fires once per day
-- instead of every 30-min cron cycle once the slate is done.

create table if not exists slate_complete_notifications (
  date         text primary key,
  notified_at  timestamptz default now()
);
