-- Casual era watermarks: when a club is added to config.ea_club_ids, the bot
-- records the moment tracking began. Games played BEFORE that are never
-- ingested — adding a club must not backfill its EA history into the
-- leaderboard or the results feed. Removing a club deletes its row, so
-- re-adding later starts a fresh era.
create table casual_club_since (
    club_id text primary key,
    since   timestamptz not null default now()
);
