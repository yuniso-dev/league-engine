import { getDb } from '../client';
import { tournaments, teams, users } from '../schema';
import { asc, desc, eq, ne, sql } from 'drizzle-orm';
import { toPublicTournament, type PublicTournament } from '../dto';

export type TournamentCaptain = {
  teamId: string;
  teamName: string;
  /** The captain's discordId — mention as <@id>. Null until one is assigned. */
  captainId: string | null;
  captainName: string | null;
  memberCount: number;
};

/** Teams + captains of one tournament, in creation order — the raw material
 *  for the bot's /spinorder wheel and /frontierintro captain list. */
export async function getTournamentCaptains(tournamentId: string): Promise<TournamentCaptain[]> {
  return getDb()
    .select({
      teamId: teams.id,
      teamName: teams.name,
      captainId: teams.captainId,
      captainName: users.displayName,
      memberCount: sql<number>`(select count(*)::int from team_members tm where tm.team_id = ${teams.id})`,
    })
    .from(teams)
    .leftJoin(users, eq(teams.captainId, users.discordId))
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));
}

/** The Frontier currently being set up or played — newest non-completed.
 *  Used by the bot's /frontierclubstart to know where linked teams belong. */
export async function getLatestOpenTournament(): Promise<{
  id: string;
  name: string;
  season: number;
  status: 'upcoming' | 'live';
  startTime: Date | null;
} | null> {
  const [row] = await getDb()
    .select({
      id: tournaments.id,
      name: tournaments.name,
      season: tournaments.season,
      status: tournaments.status,
      startTime: tournaments.startTime,
    })
    .from(tournaments)
    .where(ne(tournaments.status, 'completed'))
    .orderBy(desc(tournaments.createdAt))
    .limit(1);
  if (!row) return null;
  return { ...row, status: row.status as 'upcoming' | 'live' };
}

export async function getTournaments(): Promise<PublicTournament[]> {
  const rows = await getDb()
    .select({
      tournament: tournaments,
      winnerName: teams.name,
      signupCount: sql<number>`(select count(distinct es.user_id)::int
        from event_signups es where es.tournament_id = ${tournaments.id})`,
    })
    .from(tournaments)
    .leftJoin(teams, eq(tournaments.winnerTeamId, teams.id))
    .orderBy(desc(tournaments.season), desc(tournaments.createdAt));

  return rows.map(({ tournament, winnerName, signupCount }) => ({
    ...toPublicTournament(tournament, winnerName),
    signupCount,
  }));
}
