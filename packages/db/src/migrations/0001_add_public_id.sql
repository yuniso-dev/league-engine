-- Run this against DIRECT_URL (port 5432) before running drizzle-kit pull.
-- public_id is set by the application on /initialise; nullable until then.
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id text UNIQUE;
