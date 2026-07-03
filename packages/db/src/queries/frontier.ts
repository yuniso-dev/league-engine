import { and, asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../client';
import { matches, teamMembers, teams, tournaments, users } from '../schema';
import { toPublicTournament, type PublicTournament } from '../dto';
import type { MatchStage } from './admin';
import {
  computeGroupTable,
  getTournamentStats,
  type LeagueTableRow,
  type StatLeaderboards,
} from './stats';

// Public, read-only view of a tournament's teams and matches — for the
// "click a Frontier, see its fixtures" page. Never exposes discordId.

export type PublicTeamMember = {
  publicId: string;
  displayName: string;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
};

export type PublicBracketTeam = {
  id: string;
  name: string;
  captainPublicId: string | null;
  members: PublicTeamMember[];
};

export type PublicBracketMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  stage: MatchStage;
  playedAt: Date | null;
};

export type PublicTournamentDetail = {
  tournament: PublicTournament;
  teams: PublicBracketTeam[];
  matchesByStage: { stage: MatchStage; matches: PublicBracketMatch[] }[];
  /** Group-stage league table — null until group fixtures exist. */
  table: LeagueTableRow[] | null;
  stats: StatLeaderboards;
};

// Display order differs from the enum's declaration order (which has
// final before third_place), so it can't be relied on for grouping.
const STAGE_ORDER: MatchStage[] = [
  'group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final', 'friendly',
];

export async function getTournamentDetail(tournamentId: string): Promise<PublicTournamentDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({ tournament: tournaments, winnerName: teams.name })
    .from(tournaments)
    .leftJoin(teams, eq(tournaments.winnerTeamId, teams.id))
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!row) return null;

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));

  const memberRows = teamRows.length
    ? await db
        .select({
          teamId: teamMembers.teamId,
          userId: teamMembers.userId, // used only to resolve the captain — never returned
          publicId: users.publicId,
          displayName: users.displayName,
          position1: users.position1,
          position2: users.position2,
          hidePositions: users.hidePositions,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.discordId))
        .where(and(
          inArray(teamMembers.teamId, teamRows.map(t => t.id)),
          eq(users.isBlacklisted, false),
        ))
    : [];

  const homeTeam = alias(teams, 'home_team');
  const awayTeam = alias(teams, 'away_team');

  const matchRows = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      stage: matches.stage,
      playedAt: matches.playedAt,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    })
    .from(matches)
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(matches.tournamentId, tournamentId));

  const grouped = new Map<MatchStage, PublicBracketMatch[]>();
  for (const m of matchRows) {
    const list = grouped.get(m.stage) ?? [];
    list.push({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stage: m.stage,
      playedAt: m.playedAt,
    });
    grouped.set(m.stage, list);
  }

  const hasGroupStage = matchRows.some(m => m.stage === 'group');
  const [table, stats] = await Promise.all([
    hasGroupStage ? computeGroupTable(tournamentId) : Promise.resolve(null),
    getTournamentStats(tournamentId),
  ]);

  return {
    table,
    stats,
    tournament: toPublicTournament(row.tournament, row.winnerName),
    teams: teamRows.map(t => ({
      id: t.id,
      name: t.name,
      captainPublicId:
        memberRows.find(m => m.teamId === t.id && m.userId === t.captainId)?.publicId ?? null,
      members: memberRows
        .filter(m => m.teamId === t.id && m.publicId != null)
        .map(m => ({
          publicId: m.publicId!,
          displayName: m.displayName,
          position1: m.position1,
          position2: m.position2,
          hidePositions: m.hidePositions,
        })),
    })),
    matchesByStage: STAGE_ORDER
      .filter(stage => grouped.has(stage))
      .map(stage => ({ stage, matches: grouped.get(stage)! })),
  };
}
