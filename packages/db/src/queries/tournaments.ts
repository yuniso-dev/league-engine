import { db } from '../client';
import { tournaments } from '../schema';
import { desc } from 'drizzle-orm';
import { toPublicTournament, type PublicTournament } from '../dto';

export async function getTournaments(): Promise<PublicTournament[]> {
  const rows = await db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.season));

  return rows.map(toPublicTournament);
}
