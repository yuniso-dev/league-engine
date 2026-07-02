import { and, desc, eq } from 'drizzle-orm';
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
