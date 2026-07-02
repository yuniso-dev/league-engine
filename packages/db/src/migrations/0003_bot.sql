-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
-- The bot's /postleaderboard command stores which channel its auto-updating
-- rankings message lives in (message id already exists as rankings_message_id).
ALTER TABLE config ADD COLUMN IF NOT EXISTS rankings_channel_id text;
