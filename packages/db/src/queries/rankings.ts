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

  // Award badges + stat totals for the ladder rows, two round trips for the lot.
  const [awardRows, statRows] = await Promise.all([
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
        played: sql<number>`(count(*) filter (where ${matchParticipants.result} is not null))::int`,
        goals: sql<number>`coalesce(sum(${matchParticipants.goals}), 0)::int`,
        assists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
        cleanSheets: sql<number>`(count(*) filter (where ${matchParticipants.cleanSheet}))::int`,
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
  const statsOf = new Map(statRows.map(s => [s.userId, s]));

  return rows.map(r => {
    const s = statsOf.get(r.discordId);
    return {
      ...toPublicPlayer(r),
      awardBadges: badges.get(r.discordId) ?? [],
      wins: s?.wins ?? 0,
      played: s?.played ?? 0,
      goals: s?.goals ?? 0,
      assists: s?.assists ?? 0,
      cleanSheets: s?.cleanSheets ?? 0,
    };
  });
}

/** Tie-aware ladder ranks for EVERY active player (provisional included):
 *  equal Elo shares the same rank (standard competition ranking, e.g. 1,1,1,4)
 *  — so a fresh league where everyone sits at the base Elo is all #1. */
export async function recomputeRanks(): Promise<number> {
  const rows = await getDb().execute(sql`
    with ladder as (
      select discord_id, rank() over (order by elo desc) as new_rank
        from users
       where initialised = true
         and is_blacklisted = false
         and is_inactive = false
    )
    update users u
       set rank = l.new_rank
      from ladder l
     where u.discord_id = l.discord_id
       and (u.rank is distinct from l.new_rank)
  `);
  return Array.isArray(rows) ? rows.length : 0;
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
