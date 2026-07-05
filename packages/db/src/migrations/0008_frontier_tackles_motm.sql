-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
--
-- Frontier stat boards gain Tackles and Man of the Match — entered per match
-- in the admin ⚽ STATS form alongside goals/assists/clean sheets.
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS tackles integer NOT NULL DEFAULT 0;
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS mom boolean NOT NULL DEFAULT false;
