import { getDb } from '../client';
import { tournaments, teams } from '../schema';
import { desc, eq, sql } from 'drizzle-orm';
import { toPublicTournament, type PublicTournament } from '../dto';

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
