import { getDb } from '../client';
import { awards, config, matchParticipants, userAwards, users } from '../schema';
import { asc, desc, eq, and, gt, ilike, inArray, or, sql } from 'drizzle-orm';
import { participationFloor, DEFAULT_ELO_CONFIG } from '@inazuma/core';
import { toPublicPlayer, type PlayerTag, type PublicPlayer } from '../dto';
import { getTagSets } from './legacy';

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

  // Award badges + stat totals + tag sets for the ladder rows.
  const [awardRows, statRows, tagSets] = await Promise.all([
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
    getTagSets(),
  ]);

  const tagsFor = (discordId: string): PlayerTag[] => {
    const t: PlayerTag[] = [];
    if (tagSets.legacy.has(discordId)) t.push('legacy');
    if (tagSets.beta.has(discordId)) t.push('beta');
    return t;
  };

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
      tags: tagsFor(r.discordId),
      awardBadges: badges.get(r.discordId) ?? [],
      wins: s?.wins ?? 0,
      played: s?.played ?? 0,
      goals: s?.goals ?? 0,
      assists: s?.assists ?? 0,
      cleanSheets: s?.cleanSheets ?? 0,
    };
  });
}

/** Normalise the ladder: apply the participation floor to everyone who has
 *  played, then assign tie-aware ranks. Equal Elo shares the same rank
 *  (standard competition ranking, e.g. 1,1,1,4). Never-played players sit
 *  untouched at the base Elo, so ranking them there would put them above
 *  people who played and dropped below it — they're left unranked (rank =
 *  null) and sort below on the ladder. The floor pass here lets the admin
 *  "recalc ranks" button lift already-committed players who fell below their
 *  earned floor, without waiting for their next reveal. */
export async function recomputeRanks(): Promise<number> {
  const db = getDb();

  // Participation floor: playing lifts your rating toward a ceiling, so
  // veterans who show up aren't stuck below newcomers. Reuses the engine
  // function so reveal and this path can never disagree. Idempotent — a
  // player already at/above their floor is untouched.
  const [cfgRow] = await db.select({ eloBase: config.eloBase }).from(config).limit(1);
  const baseline = cfgRow ? parseFloat(cfgRow.eloBase) : DEFAULT_ELO_CONFIG.baseline;
  const played = await db
    .select({ discordId: users.discordId, elo: users.elo, gamesPlayed: users.gamesPlayed })
    .from(users)
    .where(and(
      eq(users.initialised, true),
      eq(users.isBlacklisted, false),
      eq(users.isInactive, false),
      gt(users.gamesPlayed, 0),
    ));
  for (const p of played) {
    const floor = participationFloor(p.gamesPlayed, baseline);
    if (parseFloat(p.elo) < floor) {
      await db.update(users).set({ elo: floor.toFixed(2) }).where(eq(users.discordId, p.discordId));
    }
  }

  await db.execute(sql`
    with ladder as (
      select discord_id, rank() over (order by elo desc) as new_rank
        from users
       where initialised = true
         and is_blacklisted = false
         and is_inactive = false
         and games_played > 0
    )
    update users u
       set rank = l.new_rank
      from ladder l
     where u.discord_id = l.discord_id
       and (u.rank is distinct from l.new_rank)
  `);
  // Anyone who hasn't played (or is no longer active) loses their rank.
  const cleared = await getDb().execute(sql`
    update users
       set rank = null
     where rank is not null
       and (games_played = 0
            or initialised = false
            or is_blacklisted = true
            or is_inactive = true)
  `);
  return Array.isArray(cleared) ? cleared.length : 0;
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
