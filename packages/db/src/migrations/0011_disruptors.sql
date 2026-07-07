-- Disruptor handling: voidable junk results + honours exclusions.
-- All additive — safe to run on live data at any time.

-- EA games an admin VOIDed (kickoff back-outs, half-time glitches). The
-- ingest must never re-record these — the fixture reopens and the REAL
-- replayed game auto-records instead.
create table if not exists voided_ea_matches (
    ea_match_id  text primary key,
    match_id     uuid,                    -- the fixture it was cleared from (informational)
    voided_by    text not null,           -- admin discord_id
    voided_at    timestamptz not null default now(),
    reason       text
);

-- Players excluded from a tournament's honours (rule violations, e.g.
-- height abuse). Honours-only: their match stats and team results stand,
-- but they can't win computed honours, appear in TOTT, or top the races.
create table if not exists tournament_exclusions (
    tournament_id uuid not null references tournaments(id) on delete cascade,
    user_id       text not null references users(discord_id) on delete cascade,
    reason        text,
    excluded_by   text not null,          -- admin discord_id
    excluded_at   timestamptz not null default now(),
    primary key (tournament_id, user_id)
);
