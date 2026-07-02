import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getDb } from '../client';
import { users, blacklistedUsers } from '../schema';
import { toPublicPlayer, type PublicPlayer } from '../dto';

export type UserRow = InferSelectModel<typeof users>;

function makePublicId(): string {
  return randomBytes(8).toString('base64url').slice(0, 10);
}

/**
 * Upsert a Discord user on sign-in.
 * Blacklist is checked FIRST — if the Discord ID is listed, no write occurs.
 * Returns true if the user is blocked (caller should deny sign-in).
 */
export async function upsertDiscordUser(data: {
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
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.discordId,
      set: {
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      },
    });

  return false;
}

/** Full row for server-side auth checks — never passed to the browser. */
export async function getUserByDiscordId(discordId: string): Promise<UserRow | null> {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.discordId, discordId))
    .limit(1);
  return row ?? null;
}

/** Safe public profile for a shareable URL. Returns null if not found, uninitialised, or blacklisted. */
export async function getUserByPublicId(publicId: string): Promise<PublicPlayer | null> {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.publicId, publicId))
    .limit(1);
  if (!row || !row.initialised || row.isBlacklisted) return null;
  return toPublicPlayer(row);
}

/**
 * Mark a user as initialised and set their profile.
 * Generates a public_id with up to 5 retries on collision.
 * Returns the generated public_id.
 */
export async function initialiseUser(
  discordId: string,
  data: {
    displayName: string;
    position1: string | null;
    position2: string | null;
    hidePositions: boolean;
    country: string | null;
  },
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = makePublicId();
    try {
      await getDb()
        .update(users)
        .set({
          displayName: data.displayName,
          position1: data.position1,
          position2: data.position2,
          hidePositions: data.hidePositions,
          country: data.country,
          initialised: true,
          initialisedAt: new Date(),
          publicId,
          updatedAt: new Date(),
        })
        .where(eq(users.discordId, discordId));
      return publicId;
    } catch (e: unknown) {
      const code = typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined;
      if (code === '23505' && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error('Failed to generate unique public_id after 5 attempts');
}

/** Update mutable settings fields for an existing user. */
export async function updateSettings(
  discordId: string,
  data: {
    displayName: string;
    position1: string | null;
    position2: string | null;
    hidePositions: boolean;
    country: string | null;
    quote?: string | null;
    bio?: string | null;
  },
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      displayName: data.displayName,
      position1: data.position1,
      position2: data.position2,
      hidePositions: data.hidePositions,
      country: data.country,
      ...(data.quote !== undefined && { quote: data.quote }),
      ...(data.bio !== undefined && { bio: data.bio }),
      updatedAt: new Date(),
    })
    .where(eq(users.discordId, discordId));
}
