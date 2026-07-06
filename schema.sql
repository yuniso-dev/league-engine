-- ============================================================================
--  INAZUMA FC — DATABASE SCHEMA  (PostgreSQL / Supabase)
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

    initialised       boolean      not null default false,
    initialised_at    timestamptz,
    last_active_at    timestamptz,
    is_inactive       boolean      not null default false,

    events_signed_up  integer      not null default 0,
    events_attended   integer      not null default 0,

    country           varchar(2),
    quote             text,
    bio               text,

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
    end_date        date,
    winner_team_id  uuid,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
--  EVENT_SIGNUPS  — frictionless RSVP (planning + reliability, not the roster)
-- ----------------------------------------------------------------------------
create table event_signups (
    id              uuid primary key default gen_random_uuid(),
    tournament_id   uuid not null references tournaments(id) on delete cascade,
    user_id         text not null references users(discord_id) on delete cascade,
    signed_up_at    timestamptz not null default now(),
    source          text not null default 'discord',
    attended        boolean,
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
    elo_base            numeric(7,2) not null default 1000,
    k_placement         integer not null default 60,
    k_established       integer not null default 24,
    placement_games     integer not null default 3,
    decay_weeks         integer not null default 4,
    mov_multiplier_cap  numeric(4,2) not null default 1.75,
    last_reveal_at      timestamptz,
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
--  BLACKLISTED_USERS
-- ----------------------------------------------------------------------------
create table blacklisted_users (
    discord_id      text primary key,
    reason          text,
    blacklisted_by  text references users(discord_id),
    created_at      timestamptz not null default now()
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
create index idx_mp_match             on match_participants (match_id);
create index idx_history_user_week    on rating_history (user_id, week_of);


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

create trigger trg_users_updated       before update on users       for each row execute function set_updated_at();
create trigger trg_tournaments_updated  before update on tournaments for each row execute function set_updated_at();