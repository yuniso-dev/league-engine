import { getDb } from '../client';
import { users } from '../schema';
import { asc, desc, eq, and, ilike, or } from 'drizzle-orm';
import { toPublicPlayer, type PublicPlayer } from '../dto';

const baseWhere = () =>
  and(
    eq(users.initialised, true),
    eq(users.isInactive, false),
    eq(users.isBlacklisted, false),
  );

export async function getRankings(): Promise<PublicPlayer[]> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(baseWhere())
    // PostgreSQL: ASC defaults to NULLS LAST, so null ranks sort after all ranked players.
    // elo desc is a stable secondary sort before Phase 4 assigns real ranks.
    .orderBy(asc(users.rank), desc(users.elo));

  return rows.map(toPublicPlayer);
}

export async function searchRankings(q: string): Promise<PublicPlayer[]> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(
      and(
        baseWhere(),
        q
          ? or(ilike(users.displayName, `%${q}%`), ilike(users.username, `%${q}%`))
          : undefined,
      ),
    )
    .orderBy(asc(users.rank), desc(users.elo));

  return rows.map(toPublicPlayer);
}
