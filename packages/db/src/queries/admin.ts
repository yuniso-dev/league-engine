import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getDb } from '../client';
import { computeGroupTable } from './stats';
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
  captainPublicId: string | null;
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

// Frontiers are single-day events — one date field, stored in start_date.
// end_date is kept in the schema but always written as null going forward.
export async function createTournament(
  adminId: string,
  data: { name: string; season: number; ranked: boolean; date: string | null },
): Promise<string> {
  const [row] = await getDb()
    .insert(tournaments)
    .values({
      name: data.name,
      season: data.season,
      ranked: data.ranked,
      startDate: data.date,
      endDate: null,
    })
    .returning({ id: tournaments.id });

  await logAdminAction(adminId, 'tournament.create', { tournamentId: row.id, name: data.name });
  return row.id;
}

export async function getTournamentById(tournamentId: string): Promise<TournamentRow | null> {
  const [row] = await getDb()
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  return row ?? null;
}

export async function updateTournament(
  adminId: string,
  tournamentId: string,
  data: { name: string; season: number; ranked: boolean; date: string | null },
): Promise<void> {
  await getDb()
    .update(tournaments)
    .set({
      name: data.name,
      season: data.season,
      ranked: data.ranked,
      startDate: data.date,
      endDate: null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));

  await logAdminAction(adminId, 'tournament.update', { tournamentId, name: data.name });
}

/** Cascades to teams/matches/participants at the DB level. Blocked once any match has been processed for Elo. */
export async function deleteTournament(adminId: string, tournamentId: string): Promise<void> {
  const [processedMatch] = await getDb()
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.processed, true)))
    .limit(1);
  if (processedMatch) throw new Error('Tournament has processed results — cannot delete.');

  try {
    await getDb().delete(tournaments).where(eq(tournaments.id, tournamentId));
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined;
    if (code === '23503') throw new Error('Tournament has linked records that block deletion.');
    throw e;
  }

  await logAdminAction(adminId, 'tournament.delete', { tournamentId });
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
          userId: teamMembers.userId, // used only to resolve captain — never returned
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
      captainPublicId:
        memberRows.find(m => m.teamId === t.id && m.userId === t.captainId)?.publicId ?? null,
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

// ── Draft board: per-player roster moves ─────────────────────────────────────

export async function addTeamMember(
  adminId: string,
  data: { teamId: string; publicId: string },
): Promise<void> {
  const resolved = await resolvePlayers([data.publicId]);
  const userId = resolved.get(data.publicId)!;

  await getDb()
    .insert(teamMembers)
    .values({ teamId: data.teamId, userId })
    .onConflictDoNothing();

  await logAdminAction(adminId, 'team.member.add', { teamId: data.teamId });
}

export async function removeTeamMember(
  adminId: string,
  data: { teamId: string; publicId: string },
): Promise<void> {
  const resolved = await resolvePlayers([data.publicId]);
  const userId = resolved.get(data.publicId)!;
  const db = getDb();

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, userId)));
  // A removed player can't stay captain.
  await db
    .update(teams)
    .set({ captainId: null })
    .where(and(eq(teams.id, data.teamId), eq(teams.captainId, userId)));

  await logAdminAction(adminId, 'team.member.remove', { teamId: data.teamId });
}

/** publicId null clears the captaincy. The captain must be on the team. */
export async function setTeamCaptain(
  adminId: string,
  data: { teamId: string; publicId: string | null },
): Promise<void> {
  const db = getDb();
  let userId: string | null = null;

  if (data.publicId) {
    const resolved = await resolvePlayers([data.publicId]);
    userId = resolved.get(data.publicId)!;
    const [member] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, userId)))
      .limit(1);
    if (!member) throw new Error('Captain must be a member of the team.');
  }

  await db.update(teams).set({ captainId: userId }).where(eq(teams.id, data.teamId));
  await logAdminAction(adminId, 'team.captain', { teamId: data.teamId });
}

// ── Bracket generation ───────────────────────────────────────────────────────

const KNOCKOUT_STAGE_BY_COUNT: Record<number, MatchStage> = {
  16: 'round_of_16',
  8: 'quarter',
  4: 'semi',
  2: 'final',
};

const NEXT_STAGE: Partial<Record<MatchStage, MatchStage>> = {
  round_of_16: 'quarter',
  quarter: 'semi',
  semi: 'final',
};

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random first-round draw for a knockout of 2/4/8/16 teams.
 *  Creates fixtures with empty scores — results are entered per fixture later. */
export async function generateBracket(adminId: string, tournamentId: string): Promise<number> {
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');

  const [existing] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .limit(1);
  if (existing) throw new Error('This tournament already has matches — delete them first to redraw.');

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));

  const stage = KNOCKOUT_STAGE_BY_COUNT[teamRows.length];
  if (!stage) {
    throw new Error(
      `A knockout needs exactly 2, 4, 8 or 16 teams — this tournament has ${teamRows.length}.`,
    );
  }

  const drawn = shuffle(teamRows.map(t => t.id));
  // Insert sequentially so createdAt preserves bracket order (winner of match 1
  // meets winner of match 2, and so on).
  let created = 0;
  for (let i = 0; i < drawn.length; i += 2) {
    await db.insert(matches).values({
      tournamentId,
      homeTeamId: drawn[i],
      awayTeamId: drawn[i + 1],
      stage,
      ranked: tournament.ranked,
    });
    created++;
  }

  await logAdminAction(adminId, 'bracket.generate', { tournamentId, stage, matches: created });
  return created;
}

/** Round-robin group stage: every team plays every other team once.
 *  Creates fixtures with empty scores — results are entered per fixture later. */
export async function generateGroupStage(adminId: string, tournamentId: string): Promise<number> {
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');

  const [existing] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .limit(1);
  if (existing) throw new Error('This tournament already has matches — delete them first to redraw.');

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));
  if (teamRows.length < 3) {
    throw new Error(`A group stage needs at least 3 teams — this tournament has ${teamRows.length}.`);
  }

  // Alternate pairing order so no team plays all its games back to back.
  const ids = shuffle(teamRows.map(t => t.id));
  let created = 0;
  for (let gap = 1; gap < ids.length; gap++) {
    for (let i = 0; i + gap < ids.length; i++) {
      await db.insert(matches).values({
        tournamentId,
        homeTeamId: ids[i],
        awayTeamId: ids[i + gap],
        stage: 'group',
        ranked: tournament.ranked,
      });
      created++;
    }
  }

  await logAdminAction(adminId, 'group.generate', { tournamentId, matches: created });
  return created;
}

/** Knockout drawn from the finished group table: top 4 → semis (1st v 4th,
 *  2nd v 3rd), or with fewer than 4 teams the top 2 → final. */
export async function generateKnockoutFromTable(adminId: string, tournamentId: string): Promise<number> {
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');

  const all = await db
    .select({ id: matches.id, stage: matches.stage, homeScore: matches.homeScore, awayScore: matches.awayScore })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const group = all.filter(m => m.stage === 'group');
  if (group.length === 0) throw new Error('No group fixtures yet — generate the group stage first.');
  const unplayed = group.filter(m => m.homeScore === null || m.awayScore === null);
  if (unplayed.length > 0) {
    throw new Error(`${unplayed.length} group fixture${unplayed.length === 1 ? '' : 's'} still need a result.`);
  }
  if (all.some(m => m.stage !== 'group' && m.stage !== 'friendly')) {
    throw new Error('The knockout has already been drawn.');
  }

  const table = await computeGroupTable(tournamentId);

  let created = 0;
  if (table.length >= 4) {
    // Semis seeded from the table; insert in bracket order so the final pairs
    // the two winners (generateNextRound relies on createdAt order).
    const [t1, t2, t3, t4] = table;
    await db.insert(matches).values({
      tournamentId, homeTeamId: t1.teamId, awayTeamId: t4.teamId, stage: 'semi', ranked: tournament.ranked,
    });
    await db.insert(matches).values({
      tournamentId, homeTeamId: t2.teamId, awayTeamId: t3.teamId, stage: 'semi', ranked: tournament.ranked,
    });
    created = 2;
  } else {
    const [t1, t2] = table;
    if (!t1 || !t2) throw new Error('Not enough teams for a knockout.');
    await db.insert(matches).values({
      tournamentId, homeTeamId: t1.teamId, awayTeamId: t2.teamId, stage: 'final', ranked: tournament.ranked,
    });
    created = 1;
  }

  await logAdminAction(adminId, 'knockout.from_table', { tournamentId, matches: created });
  return created;
}

/** Once every fixture in the current round has a score, pair the winners into
 *  the next round (and after the semis, also create the third-place playoff). */
export async function generateNextRound(adminId: string, tournamentId: string): Promise<number> {
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');

  const all = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(asc(matches.createdAt));
  if (all.length === 0) throw new Error('No bracket yet — generate the bracket first.');

  // The current round is the deepest knockout stage that has matches.
  const order: MatchStage[] = ['round_of_16', 'quarter', 'semi', 'final'];
  const current = [...order].reverse().find(s => all.some(m => m.stage === s));
  if (!current) throw new Error('No knockout rounds found.');
  if (current === 'final') throw new Error('The bracket is complete — set the tournament winner.');

  const round = all.filter(m => m.stage === current);
  const unplayed = round.filter(m => m.homeScore === null || m.awayScore === null);
  if (unplayed.length > 0) {
    throw new Error(`${unplayed.length} fixture${unplayed.length === 1 ? '' : 's'} in this round still need a result.`);
  }
  const tied = round.find(m => m.homeScore === m.awayScore);
  if (tied) throw new Error('A knockout fixture ended level — edit it to a decisive score (e.g. after pens).');

  const winners = round.map(m => (m.homeScore! > m.awayScore! ? m.homeTeamId : m.awayTeamId));
  const losers = round.map(m => (m.homeScore! > m.awayScore! ? m.awayTeamId : m.homeTeamId));
  const next = NEXT_STAGE[current]!;

  let created = 0;
  // Third-place playoff between the semi-final losers, ahead of the final.
  if (current === 'semi' && losers.length === 2) {
    await db.insert(matches).values({
      tournamentId,
      homeTeamId: losers[0],
      awayTeamId: losers[1],
      stage: 'third_place',
      ranked: tournament.ranked,
    });
    created++;
  }
  for (let i = 0; i < winners.length; i += 2) {
    await db.insert(matches).values({
      tournamentId,
      homeTeamId: winners[i],
      awayTeamId: winners[i + 1],
      stage: next,
      ranked: tournament.ranked,
    });
    created++;
  }

  await logAdminAction(adminId, 'bracket.next_round', { tournamentId, stage: next, matches: created });
  return created;
}

/** Fill in the result of a generated fixture (a match whose scores are still null). */
export async function recordMatchResult(
  adminId: string,
  data: {
    matchId: string;
    homeScore: number;
    awayScore: number;
    playedAt: Date | null;
    homePlayerPublicIds: string[];
    awayPlayerPublicIds: string[];
  },
): Promise<void> {
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, data.matchId)).limit(1);
  if (!match) throw new Error('Unknown match.');
  if (match.processed) throw new Error('Match already processed for Elo.');
  if (match.homeScore !== null || match.awayScore !== null) {
    throw new Error('This fixture already has a result — delete it and re-enter if it was wrong.');
  }

  const overlap = data.homePlayerPublicIds.filter(id => data.awayPlayerPublicIds.includes(id));
  if (overlap.length > 0) throw new Error('A player cannot be on both teams.');
  if (data.homePlayerPublicIds.length === 0 || data.awayPlayerPublicIds.length === 0) {
    throw new Error('Select the players who took part on each side.');
  }

  const resolved = await resolvePlayers([...data.homePlayerPublicIds, ...data.awayPlayerPublicIds]);

  const homeResult = data.homeScore > data.awayScore ? 'win' : data.homeScore < data.awayScore ? 'loss' : 'draw';
  const awayResult = homeResult === 'win' ? 'loss' : homeResult === 'loss' ? 'win' : 'draw';

  const participants = [
    ...data.homePlayerPublicIds.map(publicId => ({
      userId: resolved.get(publicId)!,
      teamId: match.homeTeamId,
      result: homeResult as 'win' | 'loss' | 'draw',
      cleanSheet: data.awayScore === 0,
    })),
    ...data.awayPlayerPublicIds.map(publicId => ({
      userId: resolved.get(publicId)!,
      teamId: match.awayTeamId,
      result: awayResult as 'win' | 'loss' | 'draw',
      cleanSheet: data.homeScore === 0,
    })),
  ];

  await db.transaction(async tx => {
    await tx
      .update(matches)
      .set({
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        playedAt: data.playedAt ?? new Date(),
      })
      .where(eq(matches.id, data.matchId));
    await tx.insert(matchParticipants).values(
      participants.map(p => ({ matchId: data.matchId, ...p })),
    );
  });

  await logAdminAction(adminId, 'match.result', {
    matchId: data.matchId,
    score: `${data.homeScore}-${data.awayScore}`,
    participants: participants.length,
  });
}
