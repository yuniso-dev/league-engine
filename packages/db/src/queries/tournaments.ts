import { getDb } from '../client';
import { tournaments, teams } from '../schema';
import { desc, eq } from 'drizzle-orm';
import { toPublicTournament, type PublicTournament } from '../dto';

export async function getTournaments(): Promise<PublicTournament[]> {
  const rows = await getDb()
    .select({ tournament: tournaments, winnerName: teams.name })
    .from(tournaments)
    .leftJoin(teams, eq(tournaments.winnerTeamId, teams.id))
    .orderBy(desc(tournaments.season), desc(tournaments.createdAt));

  return rows.map(({ tournament, winnerName }) => toPublicTournament(tournament, winnerName));
}
