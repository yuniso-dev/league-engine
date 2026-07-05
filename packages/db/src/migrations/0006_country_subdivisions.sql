-- Run against DIRECT_URL (port 5432) or paste into the Supabase SQL editor
-- BEFORE deploying this round. Additive-only; safe on live data.
--
-- The UK is now picked as its home nations (England GB-ENG, Scotland GB-SCT,
-- Wales GB-WLS, Northern Ireland GB-NIR) — ISO 3166-2 codes are up to 6
-- characters, so the 2-character country column gets room to hold them.
-- Existing 2-letter values are untouched.
ALTER TABLE users ALTER COLUMN country TYPE varchar(8);
