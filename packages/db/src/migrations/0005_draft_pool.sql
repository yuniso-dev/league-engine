-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
--
-- On-demand draft staging. The Discord bot's /checkvc command snapshots
-- everyone in a voice channel into this table (regardless of whether they ever
-- signed into the website); admins can also hand-add players. The website's
-- Draft Board reads it and moves players onto teams. Nothing writes to it
-- continuously anymore — only /checkvc and the admin's add/remove buttons.
CREATE TABLE IF NOT EXISTS draft_pool (
  discord_id text PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'vc',
  added_at   timestamptz NOT NULL DEFAULT now()
);
