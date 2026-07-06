-- Frontier data correctness: DNF forfeits + red cards.
-- All additive — safe to run on live data at any time.

-- A result decided by a side quitting (EA's winnerByDnf). The score EA reports
-- for a forfeit may not reflect the game (e.g. a 90th-minute rage-quit in a
-- draw becomes 3-0), so DNF results are tagged on the site and the admin is
-- alerted to correct the score if needed.
alter table matches add column if not exists dnf boolean not null default false;

-- Red cards per player per match (EA exposes this; we now keep it).
alter table match_participants add column if not exists red_cards integer not null default 0;
