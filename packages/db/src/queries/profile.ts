import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../client';
import { matchParticipants, matches, teams, tournaments, users } from '../schema';
import type { MatchStage } from './admin';

// Public, read-only recent-match feed for a player's profile.
// Keyed by publicId; discordId never leaves the server.

export type PublicRecentMatch = {
  matchId: string;
  tournamentName: string | null;
  stage: MatchStage;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  result: 'win' | 'loss' | 'draw' | null;
  eloChange: number | null;
  playedAt: string | null;
};

export async function getRecentMatchesForPlayer(
  publicId: string,
  limit = 5,
): Promise<PublicRecentMatch[]> {
  const homeTeam = alias(teams, 'home_team');
  const awayTeam = alias(teams, 'away_team');

  const rows = await getDb()
    .select({
      matchId: matches.id,
      tournamentName: tournaments.name,
      stage: matches.stage,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      result: matchParticipants.result,
      eloChange: matchParticipants.eloChange,
      playedAt: matches.playedAt,
    })
    .from(matchParticipants)
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(and(
      eq(users.publicId, publicId),
      eq(users.isBlacklisted, false),
      eq(matches.processed, true),
      eq(matches.ranked, true),
    ))
    .orderBy(desc(matches.playedAt))
    .limit(limit);

  return rows.map(r => ({
    matchId: r.matchId,
    tournamentName: r.tournamentName,
    stage: r.stage,
    homeTeamName: r.homeTeamName,
    awayTeamName: r.awayTeamName,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    result: r.result,
    eloChange: r.eloChange != null ? parseFloat(r.eloChange as string) : null,
    playedAt: r.playedAt ? r.playedAt.toISOString() : null,
  }));
}

// ── Head-to-head: "you vs them" between two players ───────────────────────────

export type HeadToHead = {
  meetings: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  assistsFor: number;
  assistsAgainst: number;
  lastMeeting: {
    playedAt: string;
    result: 'win' | 'loss' | 'draw' | null;
    ourGoals: number;
    theirGoals: number;
    tournamentName: string;
  } | null;
  /** Matches where the two were on the SAME team — the other half of the story. */
  teammates: {
    meetings: number;
    wins: number;
    draws: number;
    losses: number;
    goalsTogether: number;
  };
};

/**
 * Frontier head-to-head from the VIEWER's perspective. Counts only matches
 * where the two players were on OPPOSING teams (same match, different team) —
 * over processed, ranked matches. Returns null for the same player; a real but
 * never-met pair returns zeroed counts (the card shows a "never met" state).
 * publicId → discordId is resolved server-side (discordId never leaves).
 */
export async function getHeadToHead(
  viewerPublicId: string,
  targetPublicId: string,
): Promise<HeadToHead | null> {
  if (viewerPublicId === targetPublicId) return null;

  const rows = await getDb().execute(sql`
    with me as (
      select discord_id from users where public_id = ${viewerPublicId} and is_blacklisted = false
    ),
    them as (
      select discord_id from users where public_id = ${targetPublicId} and is_blacklisted = false
    ),
    meetings as (
      select mine.result       as my_result,
             mine.goals         as my_goals,
             mine.assists       as my_assists,
             theirs.goals       as their_goals,
             theirs.assists     as their_assists,
             m.played_at        as played_at,
             m.tournament_id    as tournament_id
        from match_participants mine
        join match_participants theirs
          on theirs.match_id = mine.match_id
         and theirs.team_id <> mine.team_id
        join matches m on m.id = mine.match_id
       where mine.user_id   in (select discord_id from me)
         and theirs.user_id in (select discord_id from them)
         and m.processed = true
         and m.ranked = true
    ),
    together as (
      select mine.result                as my_result,
             mine.goals + theirs.goals  as combined_goals
        from match_participants mine
        join match_participants theirs
          on theirs.match_id = mine.match_id
         and theirs.team_id = mine.team_id
        join matches m on m.id = mine.match_id
       where mine.user_id   in (select discord_id from me)
         and theirs.user_id in (select discord_id from them)
         and m.processed = true
         and m.ranked = true
    )
    select
      (select count(*)::int                              from meetings)                        as meetings,
      (select count(*)::int  from meetings where my_result = 'win')                            as wins,
      (select count(*)::int  from meetings where my_result = 'draw')                           as draws,
      (select count(*)::int  from meetings where my_result = 'loss')                           as losses,
      (select coalesce(sum(my_goals), 0)::int            from meetings)                        as goals_for,
      (select coalesce(sum(their_goals), 0)::int         from meetings)                        as goals_against,
      (select coalesce(sum(my_assists), 0)::int          from meetings)                        as assists_for,
      (select coalesce(sum(their_assists), 0)::int       from meetings)                        as assists_against,
      (select count(*)::int                              from together)                        as t_meetings,
      (select count(*)::int  from together where my_result = 'win')                            as t_wins,
      (select count(*)::int  from together where my_result = 'draw')                           as t_draws,
      (select count(*)::int  from together where my_result = 'loss')                           as t_losses,
      (select coalesce(sum(combined_goals), 0)::int      from together)                        as t_goals,
      (select row_to_json(x) from (
         select mt.played_at, mt.my_result as result, mt.my_goals as our_goals,
                mt.their_goals as their_goals, t.name as tournament_name
           from meetings mt
           left join tournaments t on t.id = mt.tournament_id
          where mt.played_at is not null
          order by mt.played_at desc
          limit 1
       ) x)                                                                                    as last_meeting
  `);

  const row = (rows as unknown as Record<string, unknown>[])[0];
  if (!row) return null;

  const lm = row.last_meeting as {
    played_at: string;
    result: 'win' | 'loss' | 'draw' | null;
    our_goals: number;
    their_goals: number;
    tournament_name: string | null;
  } | null;

  return {
    meetings: Number(row.meetings ?? 0),
    wins: Number(row.wins ?? 0),
    draws: Number(row.draws ?? 0),
    losses: Number(row.losses ?? 0),
    goalsFor: Number(row.goals_for ?? 0),
    goalsAgainst: Number(row.goals_against ?? 0),
    assistsFor: Number(row.assists_for ?? 0),
    assistsAgainst: Number(row.assists_against ?? 0),
    teammates: {
      meetings: Number(row.t_meetings ?? 0),
      wins: Number(row.t_wins ?? 0),
      draws: Number(row.t_draws ?? 0),
      losses: Number(row.t_losses ?? 0),
      goalsTogether: Number(row.t_goals ?? 0),
    },
    lastMeeting: lm
      ? {
          playedAt: new Date(lm.played_at).toISOString(),
          result: lm.result,
          ourGoals: Number(lm.our_goals ?? 0),
          theirGoals: Number(lm.their_goals ?? 0),
          tournamentName: lm.tournament_name ?? 'Frontier',
        }
      : null,
  };
}
