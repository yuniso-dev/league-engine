import { and, eq } from 'drizzle-orm';
import { cleanDisplayName } from '@inazuma/core';
import { getDb } from '../client';
import { blacklistedUsers, config, users } from '../schema';

// Queries for the Discord bot process ONLY. These expose discordId, which is
// fine here — the bot runs server-side and nothing it returns ever reaches a
// browser. Do not import these from apps/web page/component code.

export type NicknamePlayer = {
  discordId: string;
  displayName: string;
  rank: number | null;
  provisional: boolean;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
};

/** Everyone the bot should keep a Discord nickname in sync for.
 *  Mirrors the rankings filter: initialised, not blacklisted, not inactive. */
export async function listPlayersForNicknames(): Promise<NicknamePlayer[]> {
  return getDb()
    .select({
      discordId: users.discordId,
      displayName: users.displayName,
      rank: users.rank,
      provisional: users.provisional,
      position1: users.position1,
      position2: users.position2,
      hidePositions: users.hidePositions,
    })
    .from(users)
    .where(and(
      eq(users.initialised, true),
      eq(users.isBlacklisted, false),
      eq(users.isInactive, false),
    ));
}

/**
 * Upsert a guild member from the bot's member sync. Deliberately NOT
 * upsertDiscordUser: on conflict this updates ONLY username/avatar/isInactive,
 * never displayName — the caller's displayName comes from Discord and the bot
 * itself writes rank-stamped nicknames, so syncing it back into
 * users.displayName (which formatNickname consumes) would loop, and would
 * clobber names players chose on the site.
 *
 * Pass user.globalName ?? user.username as displayName — NEVER member.displayName
 * (that is the guild nickname, i.e. possibly the bot's own "#3 Name | ST/GK").
 *
 * Returns true if the Discord ID is blacklisted (caller should skip).
 */
export async function syncGuildMember(data: {
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<boolean> {
  const [blocked] = await getDb()
    .select({ discordId: blacklistedUsers.discordId })
    .from(blacklistedUsers)
    .where(eq(blacklistedUsers.discordId, data.discordId))
    .limit(1);
  if (blocked) return true;

  await getDb()
    .insert(users)
    .values({
      discordId: data.discordId,
      username: data.username,
      // Emoji and fancy-Unicode names normalised at the door (site font +
      // nickname truncation both depend on plain text).
      displayName: cleanDisplayName(data.displayName, data.username),
      avatarUrl: data.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.discordId,
      set: {
        username: data.username,
        avatarUrl: data.avatarUrl,
        isInactive: false, // re-joining the server reactivates a leaver
        updatedAt: new Date(),
      },
    });

  return false;
}

/** Leavers are hidden from the ladder (rankings + reveal both filter isInactive). */
export async function setUserInactive(discordId: string, isInactive: boolean): Promise<void> {
  await getDb()
    .update(users)
    .set({ isInactive, updatedAt: new Date() })
    .where(eq(users.discordId, discordId));
}

/** Cheap 2-column scan for the periodic "who left while the bot was down" reconciliation. */
export async function listTrackedUsers(): Promise<{ discordId: string; isInactive: boolean }[]> {
  return getDb()
    .select({ discordId: users.discordId, isInactive: users.isInactive })
    .from(users);
}

/** Written by /postleaderboard: which message the bot keeps edited with live rankings. */
export async function setRankingsRef(ref: { channelId: string; messageId: string }): Promise<void> {
  const values = {
    rankingsChannelId: ref.channelId,
    rankingsMessageId: ref.messageId,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(config)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: config.id, set: values });
}
