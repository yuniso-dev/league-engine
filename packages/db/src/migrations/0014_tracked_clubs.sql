-- Tracked EA clubs: the community's own FC Clubs, registered by admins
-- (web page or /trackclub) and refreshed round-robin by the bot from the EA
-- API. The website only ever reads these stored snapshots, so club pages
-- load instantly and survive EA outages (with a "last updated" stamp).
create table if not exists tracked_clubs (
    club_id        text primary key,
    name           text,              -- filled by the bot from EA on first sync
    added_by       text not null,
    added_at       timestamptz not null default now(),
    info           jsonb,             -- { name, teamId, crestAssetId }
    overall        jsonb,             -- record, skill rating, divisions, streaks…
    members        jsonb,             -- squad list with per-player career stats
    recent_matches jsonb,             -- last ~10 league/playoff games w/ top performers
    fetched_at     timestamptz,       -- last successful sync
    fetch_error    text               -- last pass's error, null when healthy
);
