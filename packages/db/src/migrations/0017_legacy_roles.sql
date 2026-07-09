-- Discord roles the bot mirrors: @Legacy for everyone in the pre-website
-- archive, @Beta for everyone who played the Season 0 test frontier. Both
-- optional (null = off), same pattern as signup_role_id / punished_role_id.

alter table config add column if not exists legacy_role_id text;
alter table config add column if not exists beta_role_id   text;
