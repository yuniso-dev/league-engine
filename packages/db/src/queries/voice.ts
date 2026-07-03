import { asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { users, voicePresence } from '../schema';

// Voice-channel presence: the bot writes it, the website reads it.

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
    .orderBy(asc(voicePresence.channelName), asc(voicePresence.joinedAt));

  return rows
    .filter(r => !r.isBlacklisted)
    .map(r => ({
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      publicId: r.publicId,
      channelName: r.channelName,
    }));
}
