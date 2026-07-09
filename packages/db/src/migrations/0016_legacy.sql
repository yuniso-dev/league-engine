-- Legacy archive: the pre-website Frontier editions (I–XVI) and their honours,
-- imported from a pasted Discord history. Winners stored by Discord ID only
-- (many are ex-members), resolved to profiles with a LEFT JOIN when present.

create table if not exists legacy_editions (
  edition integer primary key,
  label   text not null
);

create table if not exists legacy_award_winners (
  id         uuid primary key default gen_random_uuid(),
  edition    integer not null references legacy_editions(edition) on delete cascade,
  category   text not null, -- champion | golden_boot | wallside | sharps | xavier_frost
  discord_id text not null
);

create index if not exists legacy_award_winners_edition_idx on legacy_award_winners (edition);
create index if not exists legacy_award_winners_discord_idx  on legacy_award_winners (discord_id);
