-- Frontier results feed: the Discord channel the bot posts each auto-recorded
-- game into (scoreline + scorers + MOTM + a link to the match centre).
-- Blank = off (the result still records to the site as before).
alter table config add column results_channel_id text;
