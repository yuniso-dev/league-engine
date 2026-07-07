-- Captured games: EVERY EA game between linked clubs is kept, even when its
-- fixture is already scored (the replay-after-a-bug case). The admin — who is
-- usually playing and can't tab out mid-tournament — reviews afterwards:
-- APPLY swaps a captured game onto the fixture, DISCARD bins it. Nothing is
-- ever lost to timing again.

create table if not exists ea_pending_matches (
    ea_match_id   text primary key,
    tournament_id uuid not null references tournaments(id) on delete cascade,
    team_a_id     uuid not null references teams(id) on delete cascade,
    team_b_id     uuid not null references teams(id) on delete cascade,
    score_a       integer not null,
    score_b       integer not null,
    dnf           boolean not null default false,
    duration_min  integer,             -- in-game minutes (from EA secondsPlayed; 90 = full game)
    played_at     timestamptz not null,
    players       jsonb not null,      -- full per-player stat lines, exactly as EA served them
    status        text not null default 'pending',   -- pending | applied | discarded
    resolved_by   text,                -- admin discord_id
    resolved_at   timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists idx_pending_tournament on ea_pending_matches (tournament_id, status);
