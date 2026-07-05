-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
--
-- CASUAL realm: tracks casual FC Clubs games, sourced from the EA Clubs API
-- by the Discord bot (polled every ~10 minutes for the configured club).
-- Players link their in-game persona via users.ea_name (Edit Profile) — the
-- join happens at query time on lower(ea_name), so linking later still
-- claims every already-ingested match.

-- Players link their EA persona name; admins configure which club(s) to poll.
ALTER TABLE users  ADD COLUMN IF NOT EXISTS ea_name text;
ALTER TABLE config ADD COLUMN IF NOT EXISTS ea_club_ids text;
ALTER TABLE config ADD COLUMN IF NOT EXISTS ea_platform text NOT NULL DEFAULT 'common-gen5';

-- One row per ingested club match (EA's matchId is globally unique).
CREATE TABLE IF NOT EXISTS casual_matches (
  match_id       text PRIMARY KEY,
  club_id        text NOT NULL,
  match_type     text NOT NULL DEFAULT 'league',
  opponent_name  text,
  our_goals      integer NOT NULL DEFAULT 0,
  opp_goals      integer NOT NULL DEFAULT 0,
  result         text NOT NULL,
  played_at      timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Per-player stat line within a match, keyed by EA persona name.
CREATE TABLE IF NOT EXISTS casual_match_players (
  match_id      text NOT NULL REFERENCES casual_matches(match_id) ON DELETE CASCADE,
  ea_name       text NOT NULL,
  position      text,
  rating        numeric(4,2),
  goals         integer NOT NULL DEFAULT 0,
  assists       integer NOT NULL DEFAULT 0,
  tackles       integer NOT NULL DEFAULT 0,
  clean_sheet   boolean NOT NULL DEFAULT false,
  saves         integer NOT NULL DEFAULT 0,
  shots         integer NOT NULL DEFAULT 0,
  passes_made   integer NOT NULL DEFAULT 0,
  pass_attempts integer NOT NULL DEFAULT 0,
  mom           boolean NOT NULL DEFAULT false,
  PRIMARY KEY (match_id, ea_name)
);

CREATE INDEX IF NOT EXISTS idx_casual_matches_played ON casual_matches (played_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmp_ea_name ON casual_match_players (lower(ea_name));
CREATE INDEX IF NOT EXISTS idx_users_ea_name ON users (lower(ea_name)) WHERE ea_name IS NOT NULL;
