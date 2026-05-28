-- Run this in Supabase SQL Editor to update slot_patterns table
-- Adds sport column and changes primary key to (date, sport)

-- Drop old table and recreate with composite key
DROP TABLE IF EXISTS slot_patterns;

CREATE TABLE slot_patterns (
  date        DATE NOT NULL,
  sport       TEXT NOT NULL DEFAULT 'mlb',
  pattern     TEXT[] NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (date, sport)
);

CREATE INDEX idx_slot_patterns_date ON slot_patterns(date);
