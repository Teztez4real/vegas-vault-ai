-- Run this once in Supabase → SQL Editor.
-- Upgrades slate_complete_notifications from one row per DATE (a single "the
-- whole slate is done" broadcast) to one row per (DATE, SPORT), so each sport's
-- slate completion is tracked and notified independently — e.g. "All NBA plays
-- are ready" fires when NBA finishes, separately from MLB, CFB, etc.
--
-- Safe to run on the existing table: it adds the sport column (existing rows
-- default to 'ALL', the old global marker) and swaps the primary key to the
-- composite (date, sport). Idempotent — re-running it is a no-op.

alter table slate_complete_notifications
  add column if not exists sport text not null default 'ALL';

alter table slate_complete_notifications
  drop constraint if exists slate_complete_notifications_pkey;

alter table slate_complete_notifications
  add primary key (date, sport);
