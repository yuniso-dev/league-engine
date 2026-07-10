import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { normalizePosition, type PositionBucket } from '@inazuma/core';
import { getDb } from '../client';
import { matchGuestLines, matchParticipants, matches, teams, tournaments, users } from '../schema';
import { getExcludedDiscordIds } from './exclusions';
import type { MatchStage } from './admin';

// The public match centre: one recorded match with both teams' full stat
// lines — everything the EA ingest (or the admin's stats editor) captured.
// Read-only and publicId-based; blacklisted players are filtered like every
// other public surface.

export type MatchDetailPlayer = {
  /** null = guest line — played the game but has no site account. */
  publicId: string | null;
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
  /** EA position, normalised to the site's buckets (null = no position data). */
  position: PositionBucket | null;
  /** Honours-excluded for this tournament (rule violation) — stats shown, flagged. */
  excluded: boolean;
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

  const excluded = await getExcludedDiscordIds(match.tournamentId);

  const rows = await db
    .select({
      teamId: matchParticipants.teamId,
      discordId: matchParticipants.userId,
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

  // Guest lines: players in the game with no linked site account. Best-effort
  // read — a missing table (migration 0018 not yet run) degrades to none.
  const guestRows = await db
    .select()
    .from(matchGuestLines)
    .where(eq(matchGuestLines.matchId, matchId))
    .catch(() => []);

  const playersOf = (teamId: string): MatchDetailPlayer[] =>
    rows
      .filter((r): r is typeof r & { publicId: string } => r.teamId === teamId && r.publicId != null)
      .map((r): MatchDetailPlayer => ({
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
        // Historic rows may hold raw EA codes ("att", "gk") — normalise on read.
        position: normalizePosition(r.position),
        excluded: excluded.has(r.discordId),
      }))
      .concat(guestRows
        .filter(g => g.teamId === teamId)
        .map((g): MatchDetailPlayer => ({
          publicId: null,
          displayName: g.eaName,
          avatarUrl: null,
          goals: g.goals,
          assists: g.assists,
          tackles: g.tackles,
          cleanSheet: g.cleanSheet,
          saves: g.saves,
          redCards: g.redCards,
          mom: g.mom,
          rating: g.rating != null ? parseFloat(g.rating) : null,
          position: normalizePosition(g.position),
          excluded: false,
        })))
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
