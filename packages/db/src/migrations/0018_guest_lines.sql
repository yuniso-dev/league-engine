-- Guest stat lines: EA players in a Frontier game who have no linked site
-- account. Previously their lines were dropped at ingest, so lineups showed
-- fewer than the XI who actually played. Stored by EA name only — no Elo,
-- no awards, no profile; purely so the match centre shows the full team.
create table if not exists match_guest_lines (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  team_id     uuid not null references teams(id),
  ea_name     text not null,
  goals       integer not null default 0,
  assists     integer not null default 0,
  clean_sheet boolean not null default false,
  tackles     integer not null default 0,
  mom         boolean not null default false,
  rating      numeric(4,2),
  saves       integer not null default 0,
  position    text,
  red_cards   integer not null default 0,
  unique (match_id, ea_name)
);

create index if not exists match_guest_lines_match_idx on match_guest_lines (match_id);
