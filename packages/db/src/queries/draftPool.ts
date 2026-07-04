import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { draftPool, users, voicePresence } from '../schema';

// The draft pool is an on-demand staging area. The Discord bot's /checkvc
// snapshots everyone in a voice channel into it (source 'vc'); admins can also
// hand-add players from the site (source 'manual'). The Draft Board reads this
// and moves players onto teams. Nothing writes to it continuously — a snapshot
// only happens when an admin runs /checkvc.

export type DraftPoolEntry = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  position1: string | null;
  position2: string | null;
  source: string;   // 'vc' (snapshotted from voice) | 'manual' (hand-added)
  inVoice: boolean; // still mirrored in voice_presence from the last /checkvc
};

/** Website: the current draft pool, joined to users for display. */
export async function getDraftPool(): Promise<DraftPoolEntry[]> {
  try {
    const rows = await getDb()
      .select({
        publicId: users.publicId,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        position1: users.position1,
        position2: users.position2,
        source: draftPool.source,
        addedAt: draftPool.addedAt,
        inVoiceChannel: voicePresence.channelName,
        isBlacklisted: users.isBlacklisted,
      })
      .from(draftPool)
      .innerJoin(users, eq(draftPool.discordId, users.discordId))
      .leftJoin(voicePresence, eq(voicePresence.discordId, users.discordId))
      .orderBy(desc(sql`${voicePresence.channelName} is not null`), asc(draftPool.addedAt));

    return rows
      .filter(r => !r.isBlacklisted && r.publicId != null)
      .map(r => ({
        publicId: r.publicId!,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        position1: r.position1,
        position2: r.position2,
        source: r.source,
        inVoice: r.inVoiceChannel != null,
      }));
  } catch (err) {
    // Non-essential surface: if migration 0005 hasn't been run yet, never let a
    // missing draft_pool table 500 the draft page — return empty and let the
    // admin add players manually (or run the migration).
    console.error(
      '[getDraftPool] returning empty (draft_pool unavailable):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Bot: merge a set of Discord IDs into the pool. On-conflict-do-nothing so a
 * repeated /checkvc adds late arrivals without disturbing anyone already staged
 * (including hand-added players). Returns how many were NEWLY added.
 */
export async function addDiscordIdsToDraftPool(
  entries: { discordId: string; source: string }[],
): Promise<number> {
  if (entries.length === 0) return 0;
  const inserted = await getDb()
    .insert(draftPool)
    .values(entries.map(e => ({ discordId: e.discordId, source: e.source })))
    .onConflictDoNothing()
    .returning({ discordId: draftPool.discordId });
  return inserted.length;
}

/** Website: hand-add a single player (by public_id) to the pool. Idempotent. */
export async function addToDraftPoolByPublicId(publicId: string): Promise<void> {
  const [row] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(and(eq(users.publicId, publicId), eq(users.isBlacklisted, false)))
    .limit(1);
  if (!row) throw new Error('Unknown player.');
  await getDb()
    .insert(draftPool)
    .values({ discordId: row.discordId, source: 'manual' })
    .onConflictDoNothing();
}

/** Website: disregard a player — remove them from the pool. Idempotent. */
export async function removeFromDraftPool(publicId: string): Promise<void> {
  const [row] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.publicId, publicId))
    .limit(1);
  if (!row) return;
  await getDb().delete(draftPool).where(eq(draftPool.discordId, row.discordId));
}

/** Website: empty the pool for a fresh draft. Teams already built are untouched. */
export async function clearDraftPool(): Promise<void> {
  await getDb().delete(draftPool);
}
