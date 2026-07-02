import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getDb } from '../client';
import {
  adminActions,
  matches,
  matchParticipants,
  matchStageEnum,
  teamMembers,
  teams,
  tournaments,
  users,
  config,
} from '../schema';

// Admin-only data. These types cross into client components on /admin pages,
// so players are identified by publicId — discord_id never reaches the browser.
// All functions here must only be called behind an owner/admin role check.

export type TournamentRow = InferSelectModel<typeof tournaments>;
export type MatchStage = (typeof matchStageEnum.enumValues)[number];
export const MATCH_STAGES = matchStageEnum.enumValues;

export type AdminPlayerOption = {
  publicId: string;
  displayName: string;
  username: string;
  position1: string | null;
  position2: string | null;
};

export type AdminTeam = {
  id: string;
  name: string;
  members: AdminPlayerOption[];
  matchCount: number;
};

export type AdminMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  stage: MatchStage;
  ranked: boolean;
  playedAt: Date | null;
  processed: boolean;
};

export type AdminTournamentDetail = {
  tournament: TournamentRow;
  teams: AdminTeam[];
  matches: AdminMatch[];
};

async function logAdminAction(adminId: string, action: string, details: unknown): Promise<void> {
  await getDb().insert(adminActions).values({ adminId, action, details });
}

export async function getCurrentSeason(): Promise<number> {
  const [row] = await getDb().select({ currentSeason: config.currentSeason }).from(config).limit(1);
  return row?.currentSeason ?? 1;
}

export async function listAdminTournaments(): Promise<TournamentRow[]> {
  return getDb()
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.season), desc(tournaments.createdAt));
}

export async function createTournament(
  adminId: string,
  data: {
    name: string;
    season: number;
    ranked: boolean;
    startDate: string | null;
    endDate: string | null;
  },
): Promise<string> {
  const [row] = await getDb()
    .insert(tournaments)
    .values({
      name: data.name,
      season: data.season,
      ranked: data.ranked,
      startDate: data.startDate,
      endDate: data.endDate,
    })
    .returning({ id: tournaments.id });

  await logAdminAction(adminId, 'tournament.create', { tournamentId: row.id, name: data.name });
  return row.id;
}

export async function updateTournamentStatus(
  adminId: string,
  tournamentId: string,
  status: TournamentRow['status'],
  winnerTeamId: string | null,
): Promise<void> {
  if (winnerTeamId) {
    const [team] = await getDb()
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, winnerTeamId), eq(teams.tournamentId, tournamentId)))
      .limit(1);
    if (!team) throw new Error('Winner team does not belong to this tournament.');
  }

  await getDb()
    .update(tournaments)
    .set({ status, winnerTeamId, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  await logAdminAction(adminId, 'tournament.status', { tournamentId, status, winnerTeamId });
}

/** Initialised, non-blacklisted players for admin pickers (team creation, participants). */
export async function listPlayersForAdmin(): Promise<AdminPlayerOption[]> {
  const rows = await getDb()
    .select({
      publicId: users.publicId,
      displayName: users.displayName,
      username: users.username,
      position1: users.position1,
      position2: users.position2,
    })
    .from(users)
    .where(and(eq(users.initialised, true), eq(users.isBlacklisted, false)))
    .orderBy(asc(users.displayName));

  return rows
    .filter((r): r is typeof r & { publicId: string } => r.publicId != null)
    .map(r => ({
      publicId: r.publicId,
      displayName: r.displayName,
      username: r.username,
      position1: r.position1,
      position2: r.position2,
    }));
}

export async function getAdminTournament(tournamentId: string): Promise<AdminTournamentDetail | null> {
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return null;

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));

  const memberRows = teamRows.length
    ? await db
        .select({
          teamId: teamMembers.teamId,
          publicId: users.publicId,
          displayName: users.displayName,
          username: users.username,
          position1: users.position1,
          position2: users.position2,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.discordId))
        .where(inArray(teamMembers.teamId, teamRows.map(t => t.id)))
    : [];

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(desc(matches.createdAt));

  const teamName = new Map(teamRows.map(t => [t.id, t.name]));
  const matchCounts = new Map<string, number>();
  for (const m of matchRows) {
    matchCounts.set(m.homeTeamId, (matchCounts.get(m.homeTeamId) ?? 0) + 1);
    matchCounts.set(m.awayTeamId, (matchCounts.get(m.awayTeamId) ?? 0) + 1);
  }

  return {
    tournament,
    teams: teamRows.map(t => ({
      id: t.id,
      name: t.name,
      matchCount: matchCounts.get(t.id) ?? 0,
      members: memberRows
        .filter(m => m.teamId === t.id && m.publicId != null)
        .map(m => ({
          publicId: m.publicId!,
          displayName: m.displayName,
          username: m.username,
          position1: m.position1,
          position2: m.position2,
        })),
    })),
    matches: matchRows.map(m => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeamName: teamName.get(m.homeTeamId) ?? '?',
      awayTeamName: teamName.get(m.awayTeamId) ?? '?',
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stage: m.stage,
      ranked: m.ranked,
      playedAt: m.playedAt,
      processed: m.processed,
    })),
  };
}

/** Resolve player publicIds to discord IDs. Throws if any id is unknown or blacklisted. */
async function resolvePlayers(publicIds: string[]): Promise<Map<string, string>> {
  if (publicIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ publicId: users.publicId, discordId: users.discordId })
    .from(users)
    .where(and(inArray(users.publicId, publicIds), eq(users.isBlacklisted, false)));

  const map = new Map(rows.map(r => [r.publicId!, r.discordId]));
  for (const id of publicIds) {
    if (!map.has(id)) throw new Error('Unknown player in selection.');
  }
  return map;
}

export async function createTeam(
  adminId: string,
  data: { tournamentId: string; name: string; memberPublicIds: string[] },
): Promise<string> {
  const resolved = await resolvePlayers(data.memberPublicIds);
  const db = getDb();

  const teamId = await db.transaction(async tx => {
    const [team] = await tx
      .insert(teams)
      .values({ tournamentId: data.tournamentId, name: data.name })
      .returning({ id: teams.id });

    if (resolved.size > 0) {
      await tx.insert(teamMembers).values(
        [...resolved.values()].map(userId => ({ teamId: team.id, userId })),
      );
    }
    return team.id;
  });

  await logAdminAction(adminId, 'team.create', {
    tournamentId: data.tournamentId,
    teamId,
    name: data.name,
    members: resolved.size,
  });
  return teamId;
}

export async function deleteTeam(adminId: string, teamId: string): Promise<void> {
  const db = getDb();
  const [used] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.homeTeamId, teamId))
    .limit(1);
  const [usedAway] = used
    ? [used]
    : await db.select({ id: matches.id }).from(matches).where(eq(matches.awayTeamId, teamId)).limit(1);
  if (usedAway) throw new Error('Team has matches recorded — delete those first.');

  await db.delete(teams).where(eq(teams.id, teamId));
  await logAdminAction(adminId, 'team.delete', { teamId });
}

export async function createMatch(
  adminId: string,
  data: {
    tournamentId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    stage: MatchStage;
    ranked: boolean;
    playedAt: Date | null;
    homePlayerPublicIds: string[];
    awayPlayerPublicIds: string[];
  },
): Promise<string> {
  if (data.homeTeamId === data.awayTeamId) throw new Error('Home and away team must differ.');

  const overlap = data.homePlayerPublicIds.filter(id => data.awayPlayerPublicIds.includes(id));
  if (overlap.length > 0) throw new Error('A player cannot be on both teams.');

  const db = getDb();
  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.tournamentId, data.tournamentId), inArray(teams.id, [data.homeTeamId, data.awayTeamId])));
  if (teamRows.length !== 2) throw new Error('Both teams must belong to this tournament.');

  const resolved = await resolvePlayers([...data.homePlayerPublicIds, ...data.awayPlayerPublicIds]);

  const homeResult = data.homeScore > data.awayScore ? 'win' : data.homeScore < data.awayScore ? 'loss' : 'draw';
  const awayResult = homeResult === 'win' ? 'loss' : homeResult === 'loss' ? 'win' : 'draw';

  const participants = [
    ...data.homePlayerPublicIds.map(publicId => ({
      userId: resolved.get(publicId)!,
      teamId: data.homeTeamId,
      result: homeResult as 'win' | 'loss' | 'draw',
      cleanSheet: data.awayScore === 0,
    })),
    ...data.awayPlayerPublicIds.map(publicId => ({
      userId: resolved.get(publicId)!,
      teamId: data.awayTeamId,
      result: awayResult as 'win' | 'loss' | 'draw',
      cleanSheet: data.homeScore === 0,
    })),
  ];

  const matchId = await db.transaction(async tx => {
    const [match] = await tx
      .insert(matches)
      .values({
        tournamentId: data.tournamentId,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        stage: data.stage,
        ranked: data.ranked,
        playedAt: data.playedAt,
      })
      .returning({ id: matches.id });

    if (participants.length > 0) {
      await tx.insert(matchParticipants).values(
        participants.map(p => ({ matchId: match.id, ...p })),
      );
    }
    return match.id;
  });

  await logAdminAction(adminId, 'match.create', {
    tournamentId: data.tournamentId,
    matchId,
    score: `${data.homeScore}-${data.awayScore}`,
    stage: data.stage,
    ranked: data.ranked,
    participants: participants.length,
  });
  return matchId;
}

export async function deleteMatch(adminId: string, matchId: string): Promise<void> {
  const db = getDb();
  const [match] = await db
    .select({ processed: matches.processed })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return;
  if (match.processed) throw new Error('Match already processed — cannot delete.');

  await db.delete(matches).where(eq(matches.id, matchId));
  await logAdminAction(adminId, 'match.delete', { matchId });
}
