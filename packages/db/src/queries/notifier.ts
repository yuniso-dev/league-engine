import { asc, eq, gt } from 'drizzle-orm';
import { getDb } from '../client';
import { awards, userAwards, users } from '../schema';

// Feed queries for the bot's DM notifier. Each returns rows AFTER a watermark
// the bot holds in memory (seeded to boot time, so restarts never replay
// history into people's DMs).

export type NewAwardGrant = {
  discordId: string;
  awardName: string;
  awardIcon: string | null;
  /** For the trophy-cabinet link; null when the winner has no public profile. */
  publicId: string | null;
  awardedAt: Date;
};

/** Award grants after `since`, oldest first. Deliberately NOT scoped to an
 *  open tournament — ceremonies run after a Frontier completes. */
export async function getNewAwardGrants(since: Date): Promise<NewAwardGrant[]> {
  return getDb()
    .select({
      discordId: userAwards.userId,
      awardName: awards.name,
      awardIcon: awards.icon,
      publicId: users.publicId,
      awardedAt: userAwards.awardedAt,
    })
    .from(userAwards)
    .innerJoin(awards, eq(userAwards.awardId, awards.id))
    .innerJoin(users, eq(userAwards.userId, users.discordId))
    .where(gt(userAwards.awardedAt, since))
    .orderBy(asc(userAwards.awardedAt));
}
