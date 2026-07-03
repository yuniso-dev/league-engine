import { getDb } from '../client';
import { awards, matchParticipants, userAwards, users } from '../schema';
import { asc, desc, eq, and, ilike, inArray, or, sql } from 'drizzle-orm';
import { toPublicPlayer, type PublicPlayer } from '../dto';

const baseWhere = () =>
  and(
    eq(users.initialised, true),
    eq(users.isInactive, false),
    eq(users.isBlacklisted, false),
  );

export async function getRankings(): Promise<PublicPlayer[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(baseWhere())
    // PostgreSQL: ASC defaults to NULLS LAST, so null ranks sort after all ranked players.
    // elo desc is a stable secondary sort before Phase 4 assigns real ranks.
    .orderBy(asc(users.rank), desc(users.elo));
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.discordId);

  // Award badges + win counts for the ladder rows, two round trips for the lot.
  const [awardRows, winRows] = await Promise.all([
    db
      .select({
        userId: userAwards.userId,
        name: awards.name,
        icon: awards.icon,
        imageUrl: awards.imageUrl,
      })
      .from(userAwards)
      .innerJoin(awards, eq(userAwards.awardId, awards.id))
      .where(inArray(userAwards.userId, ids))
      .orderBy(desc(userAwards.awardedAt)),
    db
      .select({
        userId: matchParticipants.userId,
        wins: sql<number>`(count(*) filter (where ${matchParticipants.result} = 'win'))::int`,
      })
      .from(matchParticipants)
      .where(inArray(matchParticipants.userId, ids))
      .groupBy(matchParticipants.userId),
  ]);

  const badges = new Map<string, { name: string; icon: string | null; imageUrl: string | null }[]>();
  for (const a of awardRows) {
    const list = badges.get(a.userId) ?? [];
    list.push({ name: a.name, icon: a.icon, imageUrl: a.imageUrl });
    badges.set(a.userId, list);
  }
  const winsOf = new Map(winRows.map(w => [w.userId, w.wins]));

  return rows.map(r => ({
    ...toPublicPlayer(r),
    awardBadges: badges.get(r.discordId) ?? [],
    wins: winsOf.get(r.discordId) ?? 0,
  }));
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
