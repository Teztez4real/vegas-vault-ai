-- Run this in Supabase SQL Editor to enable line movement tracking
-- Dashboard → SQL Editor → New Query → paste and run

CREATE TABLE IF NOT EXISTS line_snapshots (
  game_key        TEXT PRIMARY KEY,
  sport           TEXT NOT NULL,
  game_date       DATE NOT NULL,
  open_home_ml    INTEGER,
  open_away_ml    INTEGER,
  open_home_rl    NUMERIC,
  open_away_rl    NUMERIC,
  open_total      NUMERIC,
  snapshots       JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for fast date-based cleanup
CREATE INDEX IF NOT EXISTS idx_line_snapshots_date ON line_snapshots(game_date);

-- Auto-delete rows older than 3 days (keep DB lean)
CREATE OR REPLACE FUNCTION delete_old_line_snapshots() RETURNS void AS $$
BEGIN
  DELETE FROM line_snapshots WHERE game_date < CURRENT_DATE - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security but allow service role full access
ALTER TABLE line_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON line_snapshots
  FOR ALL USING (true) WITH CHECK (true);
