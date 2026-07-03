import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, awards, tournaments, userAwards, users } from '../schema';

// Admin surface for individual players: directory, per-player detail, and
// profile-flair edits. Players are keyed by publicId everywhere this data
// crosses into a client component — discord_id is resolved server-side only.

export type AdminPlayerListItem = {
  publicId: string;
  displayName: string;
  username: string;
  elo: number;
  rank: number | null;
  provisional: boolean;
  country: string | null;
  title: string | null;
  gamesPlayed: number;
};

export type AdminPlayerAwardGrant = {
  userAwardId: string;
  awardId: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  tournamentName: string | null;
  season: number | null;
  awardedAt: Date;
};

export type AdminPlayerDetail = {
  player: {
    publicId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    elo: number;
    rank: number | null;
    provisional: boolean;
    gamesPlayed: number;
    country: string | null;
    position1: string | null;
    position2: string | null;
    quote: string | null;
    bio: string | null;
    title: string | null;
    characterNote: string | null;
    achievements: string | null;
    showCharacter: boolean;
    showAchievements: boolean;
    showAwards: boolean;
    accentColor: string | null;
    tier: 'free' | 'premium';
    isInactive: boolean;
  };
  awards: AdminPlayerAwardGrant[];
};

async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId: string,
  details: unknown,
): Promise<void> {
  await getDb().insert(adminActions).values({ adminId, action, targetUserId, details });
}

/** Initialised, non-blacklisted players for the admin directory. */
export async function listPlayersDirectory(): Promise<AdminPlayerListItem[]> {
  const rows = await getDb()
    .select({
      publicId: users.publicId,
      displayName: users.displayName,
      username: users.username,
      elo: users.elo,
      rank: users.rank,
      provisional: users.provisional,
      country: users.country,
      title: users.title,
      gamesPlayed: users.gamesPlayed,
    })
    .from(users)
    .where(and(eq(users.initialised, true), eq(users.isBlacklisted, false)))
    .orderBy(asc(users.displayName));

  return rows
    .filter((r): r is typeof r & { publicId: string } => r.publicId != null)
    .map(r => ({
      publicId: r.publicId,
      displayName: r.displayName,
      username: r.username,
      elo: parseFloat(r.elo as string),
      rank: r.rank,
      provisional: r.provisional,
      country: r.country,
      title: r.title,
      gamesPlayed: r.gamesPlayed,
    }));
}

export async function getAdminPlayer(publicId: string): Promise<AdminPlayerDetail | null> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.publicId, publicId), eq(users.isBlacklisted, false)))
    .limit(1);
  if (!row || !row.initialised || !row.publicId) return null;

  const grantRows = await db
    .select({
      userAwardId: userAwards.id,
      awardId: awards.id,
      name: awards.name,
      icon: awards.icon,
      imageUrl: awards.imageUrl,
      tournamentName: tournaments.name,
      season: userAwards.season,
      awardedAt: userAwards.awardedAt,
    })
    .from(userAwards)
    .innerJoin(awards, eq(userAwards.awardId, awards.id))
    .leftJoin(tournaments, eq(userAwards.tournamentId, tournaments.id))
    .where(eq(userAwards.userId, row.discordId))
    .orderBy(desc(userAwards.awardedAt));

  return {
    player: {
      publicId: row.publicId,
      displayName: row.displayName,
      username: row.username,
      avatarUrl: row.avatarUrl,
      elo: parseFloat(row.elo as string),
      rank: row.rank,
      provisional: row.provisional,
      gamesPlayed: row.gamesPlayed,
      country: row.country,
      position1: row.position1,
      position2: row.position2,
      quote: row.quote,
      bio: row.bio,
      title: row.title,
      characterNote: row.characterNote,
      achievements: row.achievements,
      showCharacter: row.showCharacter,
      showAchievements: row.showAchievements,
      showAwards: row.showAwards,
      accentColor: row.accentColor,
      tier: row.tier,
      isInactive: row.isInactive,
    },
    awards: grantRows,
  };
}

/** Admin-only edit of a player's flair: title, character/achievements sections,
 *  visibility toggles and accent colour. Never touches the player's own fields. */
export async function updatePlayerProfileByAdmin(
  adminId: string,
  publicId: string,
  data: {
    title: string | null;
    characterNote: string | null;
    achievements: string | null;
    showCharacter: boolean;
    showAchievements: boolean;
    showAwards: boolean;
    accentColor: string | null;
  },
): Promise<void> {
  const [player] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(and(eq(users.publicId, publicId), eq(users.isBlacklisted, false)))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  await getDb()
    .update(users)
    .set({
      title: data.title,
      characterNote: data.characterNote,
      achievements: data.achievements,
      showCharacter: data.showCharacter,
      showAchievements: data.showAchievements,
      showAwards: data.showAwards,
      accentColor: data.accentColor,
      updatedAt: new Date(),
    })
    .where(eq(users.discordId, player.discordId));

  await logAdminAction(adminId, 'player.profile.update', player.discordId, {
    publicId,
    title: data.title,
    showCharacter: data.showCharacter,
    showAchievements: data.showAchievements,
    showAwards: data.showAwards,
  });
}

/** Admin edit of a player's own profile fields (name, positions, country,
 *  quote, bio) — for fixing up profiles on their behalf. */
export async function updatePlayerIdentityByAdmin(
  adminId: string,
  publicId: string,
  data: {
    displayName: string;
    position1: string | null;
    position2: string | null;
    country: string | null;
    quote: string | null;
    bio: string | null;
  },
): Promise<void> {
  const [player] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(and(eq(users.publicId, publicId), eq(users.isBlacklisted, false)))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  await getDb()
    .update(users)
    .set({
      displayName: data.displayName,
      position1: data.position1,
      position2: data.position2,
      country: data.country,
      quote: data.quote,
      bio: data.bio,
      updatedAt: new Date(),
    })
    .where(eq(users.discordId, player.discordId));

  await logAdminAction(adminId, 'player.identity.update', player.discordId, {
    publicId,
    displayName: data.displayName,
  });
}
