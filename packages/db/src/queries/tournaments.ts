import { getDb } from '../client';
import { tournaments, teams } from '../schema';
import { desc, eq, ne, sql } from 'drizzle-orm';
import { toPublicTournament, type PublicTournament } from '../dto';

/** The Frontier currently being set up or played — newest non-completed.
 *  Used by the bot's /frontierclubstart to know where linked teams belong. */
export async function getLatestOpenTournament(): Promise<{
  id: string;
  name: string;
  season: number;
  status: 'upcoming' | 'live';
} | null> {
  const [row] = await getDb()
    .select({
      id: tournaments.id,
      name: tournaments.name,
      season: tournaments.season,
      status: tournaments.status,
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
