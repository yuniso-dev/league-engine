import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../client';
import { matchParticipants, matches, teams, tournaments, users } from '../schema';
import type { MatchStage } from './admin';

// The public match centre: one recorded match with both teams' full stat
// lines — everything the EA ingest (or the admin's stats editor) captured.
// Read-only and publicId-based; blacklisted players are filtered like every
// other public surface.

export type MatchDetailPlayer = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheet: boolean;
  saves: number;
  redCards: number;
  mom: boolean;
  rating: number | null;
  /** EA position bucket: goalkeeper | defender | midfielder | forward. */
  position: string | null;
};

export type MatchDetail = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  stage: MatchStage;
  playedAt: Date | null;
  /** Decided by a side quitting — the score may be an EA forfeit. */
  dnf: boolean;
  home: { teamId: string; name: string; score: number | null; players: MatchDetailPlayer[] };
  away: { teamId: string; name: string; score: number | null; players: MatchDetailPlayer[] };
};

/** GK → DEF → MID → FWD, then best rating — a lineup, not an alphabet. */
const BUCKET_ORDER: Record<string, number> = { goalkeeper: 0, defender: 1, midfielder: 2, forward: 3 };

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const db = getDb();
  const homeTeam = alias(teams, 'home_team');
  const awayTeam = alias(teams, 'away_team');

  const [match] = await db
    .select({
      id: matches.id,
      tournamentId: matches.tournamentId,
      tournamentName: tournaments.name,
      stage: matches.stage,
      playedAt: matches.playedAt,
      dnf: matches.dnf,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return null;

  const rows = await db
    .select({
      teamId: matchParticipants.teamId,
      publicId: users.publicId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      goals: matchParticipants.goals,
      assists: matchParticipants.assists,
      tackles: matchParticipants.tackles,
      cleanSheet: matchParticipants.cleanSheet,
      saves: matchParticipants.saves,
      redCards: matchParticipants.redCards,
      mom: matchParticipants.mom,
      rating: matchParticipants.rating,
      position: matchParticipants.position,
    })
    .from(matchParticipants)
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(and(
      eq(matchParticipants.matchId, matchId),
      inArray(matchParticipants.teamId, [match.homeTeamId, match.awayTeamId]),
      eq(users.isBlacklisted, false),
    ));

  const playersOf = (teamId: string): MatchDetailPlayer[] =>
    rows
      .filter((r): r is typeof r & { publicId: string } => r.teamId === teamId && r.publicId != null)
      .map(r => ({
        publicId: r.publicId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        goals: r.goals,
        assists: r.assists,
        tackles: r.tackles,
        cleanSheet: r.cleanSheet,
        saves: r.saves,
        redCards: r.redCards,
        mom: r.mom,
        rating: r.rating != null ? parseFloat(r.rating) : null,
        position: r.position,
      }))
      .sort((a, b) =>
        (BUCKET_ORDER[a.position ?? ''] ?? 9) - (BUCKET_ORDER[b.position ?? ''] ?? 9) ||
        (b.rating ?? -1) - (a.rating ?? -1) ||
        a.displayName.localeCompare(b.displayName));

  return {
    id: match.id,
    tournamentId: match.tournamentId,
    tournamentName: match.tournamentName,
    stage: match.stage,
    playedAt: match.playedAt,
    dnf: match.dnf,
    home: { teamId: match.homeTeamId, name: match.homeName, score: match.homeScore, players: playersOf(match.homeTeamId) },
    away: { teamId: match.awayTeamId, name: match.awayName, score: match.awayScore, players: playersOf(match.awayTeamId) },
  };
}
