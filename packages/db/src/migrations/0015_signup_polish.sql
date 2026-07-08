-- Frontier signup polish: kill duplicate signup DMs, add a start time + a
-- 15-minute kickoff reminder.

-- 1) Per-signup "already DM'd" flag — replaces the fragile in-memory watermark
--    that was re-sending confirmations. Existing rows are marked notified so
--    deploying this never spams anyone who's already signed up.
alter table event_signups add column if not exists notified boolean not null default false;
update event_signups set notified = true where notified = false;

-- 2) De-dupe any accidental double signups, then guarantee one row per player
--    per tournament (older databases predate this constraint).
delete from event_signups a
  using event_signups b
  where a.ctid < b.ctid
    and a.tournament_id = b.tournament_id
    and a.user_id = b.user_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_signups_tournament_user_key'
  ) then
    alter table event_signups
      add constraint event_signups_tournament_user_key unique (tournament_id, user_id);
  end if;
end $$;

-- 3) A real kickoff time (full timestamp, not just a date) + a fired-once flag
--    for the "starts in ~15 minutes" reminder DM. reminder_sent is reset to
--    false whenever the start time is edited (handled in the app layer).
alter table tournaments add column if not exists start_time timestamptz;
alter table tournaments add column if not exists reminder_sent boolean not null default false;
