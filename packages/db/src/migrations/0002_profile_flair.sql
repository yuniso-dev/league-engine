-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
ALTER TABLE awards ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS character_note text,
  ADD COLUMN IF NOT EXISTS achievements text,
  ADD COLUMN IF NOT EXISTS show_character boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_achievements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_awards boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accent_color varchar(7);
