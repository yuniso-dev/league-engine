-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
--
-- Frontier automation: each team links the captain's fresh EA club, and the
-- bot auto-ingests their club friendlies as fixture results (scores + per-
-- player stats) — replacing score7 + screenshot entry. One migration covers
-- all three automation phases.

-- The captain's fresh EA club for this Frontier (find it with /findclub).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ea_club_id text;

-- Idempotency ledger: which EA match filled this fixture (never ingest twice).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ea_match_id text UNIQUE;

-- EA per-match stats the manual form never captured — ratings power
-- Evan's Golden Glove (highest average match rating GK).
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS rating numeric(4,2);
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS saves integer NOT NULL DEFAULT 0;
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS position text;

-- The standing rules block for /frontierintro (Phase 3).
ALTER TABLE config ADD COLUMN IF NOT EXISTS frontier_rules text;
