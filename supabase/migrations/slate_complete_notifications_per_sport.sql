-- Run this once in Supabase → SQL Editor.
-- Per-sport slate-completion tracking: one row per (DATE, SPORT), so each
-- sport's slate completion is notified independently — "All NBA plays are
-- ready" fires when NBA finishes, separately from MLB, CFB, etc.
--
-- Robust to any prior state:
--   • Fresh install (table never existed): creates it with the composite key.
--   • Older install (table had DATE as the sole primary key): adds the sport
--     column and swaps to the composite (date, sport) key.
-- Idempotent — safe to re-run.

-- Fresh install: create with the final schema.
create table if not exists slate_complete_notifications (
  date         text not null,
  sport        text not null default 'ALL',
  notified_at  timestamptz default now(),
  primary key (date, sport)
);

-- Upgrade an older date-only table (no-op on the fresh table above).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'slate_complete_notifications' and column_name = 'sport'
  ) then
    alter table slate_complete_notifications add column sport text not null default 'ALL';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
    where tc.table_name = 'slate_complete_notifications'
      and tc.constraint_type = 'PRIMARY KEY'
      and kcu.column_name = 'sport'
  ) then
    alter table slate_complete_notifications drop constraint if exists slate_complete_notifications_pkey;
    alter table slate_complete_notifications add primary key (date, sport);
  end if;
end $$;
