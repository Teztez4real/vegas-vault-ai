-- Run this once in Supabase → SQL Editor.
-- Freezes the TRUE opening line for every game the first time it's ever
-- seen (regardless of when the AI analyzes it or when the admin sets the
-- slot pattern), so line movement can be computed as a genuine opening→now
-- comparison instead of comparing the current price to itself.

create table if not exists opening_lines (
  game_key      text primary key,
  date          text not null,
  sport         text,
  away_ml       numeric,
  home_ml       numeric,
  spread        text,
  away_spread_price   numeric,
  home_spread_price   numeric,
  total         text,
  over_price    numeric,
  under_price   numeric,
  captured_at   timestamptz default now()
);

create index if not exists opening_lines_date_idx on opening_lines(date);

alter table opening_lines enable row level security;
