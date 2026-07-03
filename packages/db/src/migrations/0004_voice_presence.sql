-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
-- Live voice-channel presence, mirrored by the Discord bot so the website can
-- show who's in VC right now.
CREATE TABLE IF NOT EXISTS voice_presence (
  discord_id   text PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  joined_at    timestamptz NOT NULL DEFAULT now()
);
