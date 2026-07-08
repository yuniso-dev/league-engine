-- ============================================================================
--  INAZUMA FC — COMPLETE DATABASE SCHEMA  (PostgreSQL / Supabase)
--
--  One-paste setup for a FRESH database (e.g. a test-season project).
--  This is the original schema.sql with every migration (0001–0004) folded
--  in, matching packages/db/src/schema.ts exactly. Paste the whole file into
--  the Supabase SQL Editor and run it once.
--
--  After running it, promote the first admin (yourself) once you've signed
--  in on the site:
--     update users set role = 'owner' where username = '<your discord username>';
-- ============================================================================

-- ----------------------------------------------------------------------------
--  ENUM TYPES
-- ----------------------------------------------------------------------------
create type user_role         as enum ('owner', 'admin', 'member');
create type account_tier      as enum ('free', 'premium');
create type tournament_status as enum ('upcoming', 'live', 'completed');
create type match_stage       as enum ('group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place', 'friendly');
create type match_result      as enum ('win', 'loss', 'draw');


-- ----------------------------------------------------------------------------
--  USERS  — central table (identity + profile + ranking + permissions)
-- ----------------------------------------------------------------------------
create table users (
    discord_id        text primary key,                 -- snowflake stored as text (JS-safe)
    username          text not null,
    display_name      text not null,
    avatar_url        text,

    position1         varchar(3),
    position2         varchar(3),
    hide_positions    boolean      not null default false,
    show_username     boolean      not null default true,

    elo               numeric(7,2) not null default 1000,
    rank              integer,
    provisional       boolean      not null default true,
    games_played      integer      not null default 0,
    peak_elo          numeric(7,2),
    peak_rank         integer,

    public_id         text unique,                      -- set on /initialise
    initialised       boolean      not null default false,
    initialised_at    timestamptz,
    last_active_at    timestamptz,
    is_inactive       boolean      not null default false,

    events_signed_up  integer      not null default 0,
    events_attended   integer      not null default 0,

    country           varchar(8),      -- ISO 3166-1 or GB-ENG-style subdivision
    quote             text,
    bio               text,
    ea_name           text,            -- FC Clubs persona (casual match linking)

    -- profile flair (admin-curated sections + player accent)
    title             text,
    character_note    text,
    achievements      text,
    show_character    boolean      not null default true,
    show_achievements boolean      not null default true,
    show_awards       boolean      not null default true,
    accent_color      varchar(7),

    role              user_role    not null default 'member',
    tier              account_tier not null default 'free',
    is_blacklisted    boolean      not null default false,

    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now()
);


-- ----------------------------------------------------------------------------
--  TOURNAMENTS
-- ----------------------------------------------------------------------------
create table tournaments (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    season          integer not null,
    status          tournament_status not null default 'upcoming',
    ranked          boolean not null default true,
    start_date      date,
    start_time      timestamptz,
    reminder_sent   boolean not null default false,
    end_date        date,
    winner_team_id  uuid,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  EVENT_SIGNUPS  — Frontier signups (the ROSTER CALL card)
-- ----------------------------------------------------------------------------
create table event_signups (
    id              uuid primary key default gen_random_uuid(),
    tournament_id   uuid not null references tournaments(id) on delete cascade,
    user_id         text not null references users(discord_id) on delete cascade,
    signed_up_at    timestamptz not null default now(),
    source          text not null default 'discord',
    attended        boolean,
    notified        boolean not null default false,
    unique (tournament_id, user_id)
);


-- ----------------------------------------------------------------------------
--  TEAMS  — drafted sides within a tournament
-- ----------------------------------------------------------------------------
create table teams (
    id              uuid primary key default gen_random_uuid(),
    tournament_id   uuid not null references tournaments(id) on delete cascade,
    name            text not null,
    captain_id      text references users(discord_id),
    ea_club_id      text,            -- the captain's fresh EA club (auto result ingestion)
    placement       integer,
    created_at      timestamptz not null default now()
);

create table team_members (
    team_id         uuid not null references teams(id) on delete cascade,
    user_id         text not null references users(discord_id),
    primary key (team_id, user_id)
);

alter table tournaments
    add constraint fk_tournaments_winner_team
    foreign key (winner_team_id) references teams(id) on delete set null;


-- ----------------------------------------------------------------------------
--  MATCHES
-- ----------------------------------------------------------------------------
create table matches (
    id              uuid primary key default gen_random_uuid(),
    tournament_id   uuid not null references tournaments(id) on delete cascade,
    home_team_id    uuid not null references teams(id),
    away_team_id    uuid not null references teams(id),
    home_score      integer,
    away_score      integer,
    stage           match_stage not null default 'group',
    ranked          boolean not null default true,
    played_at       timestamptz,
    processed       boolean not null default false,
    processed_at    timestamptz,
    ea_match_id     text unique,     -- set when auto-ingested from the EA API
    dnf             boolean not null default false, -- decided by a side quitting
    created_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  MATCH_PARTICIPANTS  — per-player stats + Elo audit
-- ----------------------------------------------------------------------------
create table match_participants (
    id              uuid primary key default gen_random_uuid(),
    match_id        uuid not null references matches(id) on delete cascade,
    user_id         text not null references users(discord_id),
    team_id         uuid not null references teams(id),
    result          match_result,
    goals           integer not null default 0,
    assists         integer not null default 0,
    clean_sheet     boolean not null default false,
    tackles         integer not null default 0,
    mom             boolean not null default false,
    rating          numeric(4,2),    -- EA match rating (auto-ingest)
    saves           integer not null default 0,
    position        text,            -- position played per EA (GK detection)
    red_cards       integer not null default 0,
    elo_before      numeric(7,2),
    elo_after       numeric(7,2),
    elo_change      numeric(6,2),
    unique (match_id, user_id)
);


-- ----------------------------------------------------------------------------
--  RATING_HISTORY  — weekly snapshot per player (progression graph)
-- ----------------------------------------------------------------------------
create table rating_history (
    id              uuid primary key default gen_random_uuid(),
    user_id         text not null references users(discord_id) on delete cascade,
    elo             numeric(7,2) not null,
    rank            integer,
    games_played    integer not null,
    week_of         date not null,
    elo_change      numeric(6,2),
    rank_change     integer,
    created_at      timestamptz not null default now(),
    unique (user_id, week_of)
);


-- ----------------------------------------------------------------------------
--  AWARDS
-- ----------------------------------------------------------------------------
create table awards (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    icon            text,
    image_url       text,
    description     text
);

create table user_awards (
    id              uuid primary key default gen_random_uuid(),
    user_id         text not null references users(discord_id) on delete cascade,
    award_id        uuid not null references awards(id),
    tournament_id   uuid references tournaments(id),
    season          integer,
    awarded_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  CONFIG  — single-row system + Elo settings
-- ----------------------------------------------------------------------------
create table config (
    id                  integer primary key default 1,
    current_season      integer not null default 1,
    guild_id            text,
    rankings_message_id text,
    rankings_channel_id text,
    elo_base            numeric(7,2) not null default 1000,
    k_placement         integer not null default 60,
    k_established       integer not null default 24,
    placement_games     integer not null default 3,
    decay_weeks         integer not null default 4,
    mov_multiplier_cap  numeric(4,2) not null default 1.75,
    last_reveal_at      timestamptz,
    ea_club_ids         text,
    ea_platform         text not null default 'common-gen5',
    frontier_rules      text,
    signup_role_id      text,
    punished_role_id    text,
    updated_at          timestamptz not null default now(),
    check (id = 1)
);

insert into config (id) values (1) on conflict do nothing;


-- ----------------------------------------------------------------------------
--  ADMIN_ACTIONS  — audit log for manual overrides
-- ----------------------------------------------------------------------------
create table admin_actions (
    id              uuid primary key default gen_random_uuid(),
    admin_id        text not null references users(discord_id),
    action          text not null,
    target_user_id  text references users(discord_id),
    details         jsonb,
    created_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  VOICE_PRESENCE  — live VC mirror, written by the Discord bot
-- ----------------------------------------------------------------------------
create table voice_presence (
    discord_id      text primary key references users(discord_id) on delete cascade,
    channel_name    text not null,
    joined_at       timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  BLACKLISTED_USERS
-- ----------------------------------------------------------------------------
create table blacklisted_users (
    discord_id      text primary key,
    reason          text,
    blacklisted_by  text references users(discord_id),
    created_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  DRAFT_POOL  — on-demand draft staging (bot /checkvc snapshot + manual adds)
-- ----------------------------------------------------------------------------
create table draft_pool (
    discord_id      text primary key references users(discord_id) on delete cascade,
    source          text not null default 'vc',
    added_at        timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  CASUAL  — FC Clubs matches ingested from the EA Clubs API (bot poller)
-- ----------------------------------------------------------------------------
create table casual_matches (
    match_id        text primary key,
    club_id         text not null,
    match_type      text not null default 'league',
    opponent_name   text,
    our_goals       integer not null default 0,
    opp_goals       integer not null default 0,
    result          text not null,
    played_at       timestamptz not null,
    created_at      timestamptz not null default now()
);

create table casual_match_players (
    match_id        text not null references casual_matches(match_id) on delete cascade,
    ea_name         text not null,
    position        text,
    rating          numeric(4,2),
    goals           integer not null default 0,
    assists         integer not null default 0,
    tackles         integer not null default 0,
    clean_sheet     boolean not null default false,
    saves           integer not null default 0,
    shots           integer not null default 0,
    passes_made     integer not null default 0,
    pass_attempts   integer not null default 0,
    mom             boolean not null default false,
    primary key (match_id, ea_name)
);


-- ----------------------------------------------------------------------------
--  INDEXES
-- ----------------------------------------------------------------------------
create index idx_users_elo            on users (elo desc);
create index idx_users_rank           on users (rank);
create index idx_users_active_ladder  on users (initialised, is_inactive);
create index idx_teams_tournament     on teams (tournament_id);
create index idx_team_members_user    on team_members (user_id);
create index idx_matches_tournament   on matches (tournament_id);
create index idx_signups_tournament   on event_signups (tournament_id);
create index idx_signups_user         on event_signups (user_id);
create index idx_matches_unprocessed  on matches (processed) where processed = false;
create index idx_mp_user              on match_participants (user_id);
-- ----------------------------------------------------------------------------
--  DISRUPTOR HANDLING  -- voided junk results + honours exclusions (0011)
-- ----------------------------------------------------------------------------
create table voided_ea_matches (
    ea_match_id  text primary key,
    match_id     uuid,
    voided_by    text not null,
    voided_at    timestamptz not null default now(),
    reason       text
);

create table ea_pending_matches (
    ea_match_id   text primary key,
    tournament_id uuid not null references tournaments(id) on delete cascade,
    team_a_id     uuid not null references teams(id) on delete cascade,
    team_b_id     uuid not null references teams(id) on delete cascade,
    score_a       integer not null,
    score_b       integer not null,
    dnf           boolean not null default false,
    duration_min  integer,
    played_at     timestamptz not null,
    players       jsonb not null,
    status        text not null default 'pending',
    resolved_by   text,
    resolved_at   timestamptz,
    created_at    timestamptz not null default now()
);

create table tournament_exclusions (
    tournament_id uuid not null references tournaments(id) on delete cascade,
    user_id       text not null references users(discord_id) on delete cascade,
    reason        text,
    excluded_by   text not null,
    excluded_at   timestamptz not null default now(),
    primary key (tournament_id, user_id)
);

-- ----------------------------------------------------------------------------
--  PLAYER_SANCTIONS  -- suspensions for no-shows / mid-tournament leavers (0013)
-- ----------------------------------------------------------------------------
create table player_sanctions (
    id                  uuid primary key default gen_random_uuid(),
    user_id             text not null references users(discord_id) on delete cascade,
    type                text not null,      -- 'no_show' | 'abandon' | 'other'
    reason              text,
    tournament_id       uuid references tournaments(id) on delete set null,
    frontiers_remaining integer not null default 1,
    issued_by           text not null,
    issued_at           timestamptz not null default now(),
    lifted_by           text,
    lifted_at           timestamptz
);

create index idx_sanctions_user on player_sanctions (user_id);

-- ----------------------------------------------------------------------------
--  TRACKED_CLUBS  -- community EA clubs shown on the CASUAL realm (0014)
-- ----------------------------------------------------------------------------
create table tracked_clubs (
    club_id        text primary key,
    name           text,
    added_by       text not null,
    added_at       timestamptz not null default now(),
    info           jsonb,
    overall        jsonb,
    members        jsonb,
    recent_matches jsonb,
    fetched_at     timestamptz,
    fetch_error    text
);


create index idx_mp_match             on match_participants (match_id);
create index idx_history_user_week    on rating_history (user_id, week_of);
create index idx_casual_matches_played on casual_matches (played_at desc);
create index idx_cmp_ea_name           on casual_match_players (lower(ea_name));
create index idx_users_ea_name         on users (lower(ea_name)) where ea_name is not null;


-- ----------------------------------------------------------------------------
--  updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_users_updated        before update on users       for each row execute function set_updated_at();
create trigger trg_tournaments_updated  before update on tournaments for each row execute function set_updated_at();
