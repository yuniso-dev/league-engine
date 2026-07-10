import { asc, eq, gt } from 'drizzle-orm';
import { getDb } from '../client';
import { users, voicePresence } from '../schema';

// Voice-channel presence: the bot writes it, the website reads it.

// The voice card is a manual /checkvc snapshot — nothing tracks people leaving,
// so a stale snapshot would otherwise hang around forever. Only surface a check
// from the last few hours; after that the card empties itself.
const VOICE_TTL_HOURS = 3;

/** Bot: replace the whole table with the current voice occupancy (startup scan). */
export async function replaceVoicePresence(
  entries: { discordId: string; channelName: string }[],
): Promise<void> {
  const db = getDb();
  await db.transaction(async tx => {
    await tx.delete(voicePresence);
    if (entries.length > 0) {
      await tx.insert(voicePresence).values(entries);
    }
  });
}

/** Bot: someone joined or moved voice channels. */
export async function setVoicePresence(discordId: string, channelName: string): Promise<void> {
  await getDb()
    .insert(voicePresence)
    .values({ discordId, channelName })
    .onConflictDoUpdate({
      target: voicePresence.discordId,
      set: { channelName },
    });
}

/** Bot: someone left voice. */
export async function clearVoicePresence(discordId: string): Promise<void> {
  await getDb().delete(voicePresence).where(eq(voicePresence.discordId, discordId));
}

// Public shape — no discordId.
export type VoiceNowEntry = {
  displayName: string;
  avatarUrl: string | null;
  publicId: string | null; // null = in the server but never signed into the site
  channelName: string;
};

/** Website: who's in voice right now. */
export async function getVoiceNow(): Promise<VoiceNowEntry[]> {
  try {
    const fresh = new Date(Date.now() - VOICE_TTL_HOURS * 60 * 60 * 1000);
    const rows = await getDb()
      .select({
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        publicId: users.publicId,
        channelName: voicePresence.channelName,
        isBlacklisted: users.isBlacklisted,
      })
      .from(voicePresence)
      .innerJoin(users, eq(voicePresence.discordId, users.discordId))
      .where(gt(voicePresence.joinedAt, fresh))
      .orderBy(asc(voicePresence.channelName), asc(voicePresence.joinedAt));

    return rows
      .filter(r => !r.isBlacklisted)
      .map(r => ({
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        publicId: r.publicId,
        channelName: r.channelName,
      }));
  } catch (err) {
    // The live-voice card is non-essential. If the voice_presence table doesn't
    // exist yet (migration 0004 not run) or the query errors, never let it break
    // or slow the homepage — self-contain the failure and return empty so the
    // caller renders the rest of the page normally.
    console.error(
      '[getVoiceNow] returning empty (voice presence unavailable):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
