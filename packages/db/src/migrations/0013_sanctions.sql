-- Sanctions: no-shows and mid-tournament leavers sit out future Frontiers.
-- A sanction blocks signing up while frontiers_remaining > 0 and it hasn't
-- been lifted. Completing a Frontier serves one unit off every active
-- sanction — except the tournament where the offence happened, so "banned
-- for the NEXT Frontier" can never be served by the offence itself.
create table if not exists player_sanctions (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references users(discord_id) on delete cascade,
    type text not null,                     -- 'no_show' | 'abandon' | 'other'
    reason text,
    tournament_id uuid references tournaments(id) on delete set null, -- where the offence happened
    frontiers_remaining integer not null default 1,
    issued_by text not null,
    issued_at timestamptz not null default now(),
    lifted_by text,
    lifted_at timestamptz
);

create index if not exists idx_sanctions_user on player_sanctions (user_id);

-- Discord roles the bot keeps in sync: who's signed up for the open Frontier,
-- and who's currently suspended.
alter table config add column if not exists signup_role_id text;
alter table config add column if not exists punished_role_id text;
