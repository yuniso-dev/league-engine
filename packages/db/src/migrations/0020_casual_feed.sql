-- Casual results feed: the Discord channel the bot posts each newly ingested
-- club game into (scoreline + every teammate's stat line). Blank = off.
alter table config add column casual_results_channel_id text;
