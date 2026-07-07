import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { matchParticipants, matches, teamMembers, teams, tournaments, users } from '../schema';
import { getExcludedDiscordIds, listTournamentExclusions, type TournamentExclusion } from './exclusions';

// The awards-ceremony sheet: everything the admin needs to close out a
// Frontier — stat winners WITH ties, the goalkeeper rating table, and the
// champion roster. Players carry discordId as well as publicId because the
// announcement draft mentions winners with <@discordId>; the sheet is only
// ever rendered on an admin page, so exposing it here is fine.

export type CeremonyPlayer = {
  publicId: string;
  discordId: string;
  displayName: string;
  value: number;
};

export type CeremonySheet = {
  tournament: { id: string; name: string; season: number; status: string; winnerTeamId: string | null };
  /** Everyone tied at the top goal count (empty when nobody has scored). */
  topScorers: CeremonyPlayer[];
  /** Everyone tied at the top assist count. */
  topAssisters: CeremonyPlayer[];
  /** Goalkeepers by average match rating, best first (min 2 appearances). */
  gkTable: (CeremonyPlayer & { appearances: number })[];
  /** Everyone with ≥2 rated appearances, best avg rating first, with their
   *  most-played EA position bucket — the Team of the Tournament pool. */
  ratedPlayers: (CeremonyPlayer & { appearances: number; bucket: string | null })[];
  championTeam: {
    id: string;
    name: string;
    captain: { publicId: string; discordId: string; displayName: string } | null;
    members: { publicId: string; discordId: string; displayName: string }[];
  } | null;
  /** Every rostered player — the pool for the two voted-award pickers.
   *  Deliberately NOT exclusion-filtered: voted honours stay admin judgement. */
  voterPool: { publicId: string; discordId: string; displayName: string }[];
  /** Honours exclusions (rule violators) — filtered OUT of every computed
   *  list above before winners are decided. */
  exclusions: TournamentExclusion[];
};

export async function getCeremonySheet(tournamentId: string): Promise<CeremonySheet | null> {
  const db = getDb();

  const [tournament] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      season: tournaments.season,
      status: tournaments.status,
      winnerTeamId: tournaments.winnerTeamId,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return null;

  // Rule violators: out of every COMPUTED list below (filtered before winners
  // are decided, so an excluded top scorer can't hide the real one).
  const excluded = await getExcludedDiscordIds(tournamentId);

  // ── Stat totals (goals + assists in one pass) ──────────────────────────────
  const totals = await db
    .select({
      publicId: users.publicId,
      discordId: users.discordId,
      displayName: users.displayName,
      goals: sql<number>`sum(${matchParticipants.goals})::int`,
      assists: sql<number>`sum(${matchParticipants.assists})::int`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(eq(matches.tournamentId, tournamentId))
    .groupBy(users.publicId, users.discordId, users.displayName);

  const withPublicId = totals.filter(
    (r): r is typeof r & { publicId: string } => r.publicId != null && !excluded.has(r.discordId),
  );
  const maxGoals = Math.max(0, ...withPublicId.map(r => r.goals));
  const maxAssists = Math.max(0, ...withPublicId.map(r => r.assists));
  const toPlayer = (r: (typeof withPublicId)[number], value: number): CeremonyPlayer => ({
    publicId: r.publicId,
    discordId: r.discordId,
    displayName: r.displayName,
    value,
  });

  // ── Goalkeeper table (rating is numeric → cast, or postgres.js returns strings) ──
  const gkRows = await db
    .select({
      publicId: users.publicId,
      discordId: users.discordId,
      displayName: users.displayName,
      avgRating: sql<number>`avg(${matchParticipants.rating})::float`,
      appearances: sql<number>`count(*)::int`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(and(
      eq(matches.tournamentId, tournamentId),
      isNotNull(matchParticipants.rating),
      sql`lower(${matchParticipants.position}) in ('goalkeeper', 'gk')`,
    ))
    .groupBy(users.publicId, users.discordId, users.displayName)
    .having(sql`count(*) >= 2`)
    .orderBy(desc(sql`avg(${matchParticipants.rating})`));

  // ── Rating table with position buckets (Team of the Tournament pool) ───────
  const ratedRows = await db
    .select({
      publicId: users.publicId,
      discordId: users.discordId,
      displayName: users.displayName,
      avgRating: sql<number>`avg(${matchParticipants.rating})::float`,
      appearances: sql<number>`count(*)::int`,
      // Most-played position this tournament decides the player's TOTT slot.
      bucket: sql<string | null>`mode() within group (order by lower(${matchParticipants.position}))`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(and(
      eq(matches.tournamentId, tournamentId),
      isNotNull(matchParticipants.rating),
    ))
    .groupBy(users.publicId, users.discordId, users.displayName)
    .having(sql`count(*) >= 2`)
    .orderBy(desc(sql`avg(${matchParticipants.rating})`));

  // ── Champion roster (null until the admin sets a winner) ───────────────────
  let championTeam: CeremonySheet['championTeam'] = null;
  if (tournament.winnerTeamId) {
    const [team] = await db
      .select({ id: teams.id, name: teams.name, captainId: teams.captainId })
      .from(teams)
      .where(eq(teams.id, tournament.winnerTeamId))
      .limit(1);
    if (team) {
      const memberRows = await db
        .select({ publicId: users.publicId, discordId: users.discordId, displayName: users.displayName })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.discordId))
        .where(eq(teamMembers.teamId, team.id))
        .orderBy(asc(users.displayName));
      const members = memberRows.filter((m): m is typeof m & { publicId: string } => m.publicId != null);
      championTeam = {
        id: team.id,
        name: team.name,
        captain: members.find(m => m.discordId === team.captainId) ?? null,
        members,
      };
    }
  }

  // ── Voter pool: every rostered player in the tournament ────────────────────
  const poolRows = await db
    .selectDistinct({ publicId: users.publicId, discordId: users.discordId, displayName: users.displayName })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(users, eq(teamMembers.userId, users.discordId))
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(users.displayName));

  return {
    tournament,
    topScorers: maxGoals > 0
      ? withPublicId.filter(r => r.goals === maxGoals).map(r => toPlayer(r, r.goals))
      : [],
    topAssisters: maxAssists > 0
      ? withPublicId.filter(r => r.assists === maxAssists).map(r => toPlayer(r, r.assists))
      : [],
    gkTable: gkRows
      .filter((r): r is typeof r & { publicId: string } => r.publicId != null && !excluded.has(r.discordId))
      .map(r => ({
        publicId: r.publicId,
        discordId: r.discordId,
        displayName: r.displayName,
        value: r.avgRating,
        appearances: r.appearances,
      })),
    ratedPlayers: ratedRows
      .filter((r): r is typeof r & { publicId: string } => r.publicId != null && !excluded.has(r.discordId))
      .map(r => ({
        publicId: r.publicId,
        discordId: r.discordId,
        displayName: r.displayName,
        value: r.avgRating,
        appearances: r.appearances,
        bucket: r.bucket,
      })),
    championTeam,
    voterPool: poolRows.filter((p): p is typeof p & { publicId: string } => p.publicId != null),
    exclusions: await listTournamentExclusions(tournamentId),
  };
}
