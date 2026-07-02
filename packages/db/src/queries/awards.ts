import { and, desc, eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, awards, tournaments, userAwards, users } from '../schema';

// Admin-only CRUD for awards + grant/revoke, plus a public-safe read for
// profile display. Players are identified by publicId everywhere a grant
// crosses into a client component — discord_id is resolved server-side only.

export type AwardRow = InferSelectModel<typeof awards>;

export type AdminAward = {
  id: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  grantCount: number;
};

export type AdminAwardGrant = {
  id: string;
  publicId: string;
  displayName: string;
  username: string;
  tournamentId: string | null;
  tournamentName: string | null;
  season: number | null;
  awardedAt: Date;
};

export type AdminAwardDetail = {
  award: AwardRow;
  grants: AdminAwardGrant[];
};

export type PublicAward = {
  id: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  tournamentName: string | null;
  season: number | null;
  awardedAt: string;
};

async function logAdminAction(adminId: string, action: string, details: unknown): Promise<void> {
  await getDb().insert(adminActions).values({ adminId, action, details });
}

export async function listAwardsForAdmin(): Promise<AdminAward[]> {
  const db = getDb();
  const rows = await db.select().from(awards).orderBy(desc(awards.id));
  const grants = await db.select({ awardId: userAwards.awardId }).from(userAwards);

  const counts = new Map<string, number>();
  for (const g of grants) counts.set(g.awardId, (counts.get(g.awardId) ?? 0) + 1);

  return rows.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    imageUrl: a.imageUrl,
    description: a.description,
    grantCount: counts.get(a.id) ?? 0,
  }));
}

export async function createAward(
  adminId: string,
  data: { name: string; icon: string | null; imageUrl: string | null; description: string | null },
): Promise<string> {
  const [row] = await getDb()
    .insert(awards)
    .values({ name: data.name, icon: data.icon, imageUrl: data.imageUrl, description: data.description })
    .returning({ id: awards.id });

  await logAdminAction(adminId, 'award.create', { awardId: row.id, name: data.name });
  return row.id;
}

export async function getAdminAward(awardId: string): Promise<AdminAwardDetail | null> {
  const db = getDb();

  const [award] = await db.select().from(awards).where(eq(awards.id, awardId)).limit(1);
  if (!award) return null;

  const grantRows = await db
    .select({
      id: userAwards.id,
      publicId: users.publicId,
      displayName: users.displayName,
      username: users.username,
      tournamentId: userAwards.tournamentId,
      tournamentName: tournaments.name,
      season: userAwards.season,
      awardedAt: userAwards.awardedAt,
    })
    .from(userAwards)
    .innerJoin(users, eq(userAwards.userId, users.discordId))
    .leftJoin(tournaments, eq(userAwards.tournamentId, tournaments.id))
    .where(eq(userAwards.awardId, awardId))
    .orderBy(desc(userAwards.awardedAt));

  return {
    award,
    grants: grantRows
      .filter((g): g is typeof g & { publicId: string } => g.publicId != null)
      .map(g => ({
        id: g.id,
        publicId: g.publicId,
        displayName: g.displayName,
        username: g.username,
        tournamentId: g.tournamentId,
        tournamentName: g.tournamentName,
        season: g.season,
        awardedAt: g.awardedAt,
      })),
  };
}

/** Blocks if the award has been granted to anyone — revoke those first. */
export async function deleteAward(adminId: string, awardId: string): Promise<void> {
  const [grant] = await getDb()
    .select({ id: userAwards.id })
    .from(userAwards)
    .where(eq(userAwards.awardId, awardId))
    .limit(1);
  if (grant) throw new Error('Award has been granted to a player — revoke it from them first.');

  await getDb().delete(awards).where(eq(awards.id, awardId));
  await logAdminAction(adminId, 'award.delete', { awardId });
}

export async function grantAward(
  adminId: string,
  data: { awardId: string; publicId: string; tournamentId: string | null; season: number | null },
): Promise<string> {
  const [player] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(and(eq(users.publicId, data.publicId), eq(users.isBlacklisted, false)))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  const [row] = await getDb()
    .insert(userAwards)
    .values({
      userId: player.discordId,
      awardId: data.awardId,
      tournamentId: data.tournamentId,
      season: data.season,
    })
    .returning({ id: userAwards.id });

  await logAdminAction(adminId, 'award.grant', { awardId: data.awardId, userAwardId: row.id });
  return row.id;
}

export async function revokeAward(adminId: string, userAwardId: string): Promise<void> {
  await getDb().delete(userAwards).where(eq(userAwards.id, userAwardId));
  await logAdminAction(adminId, 'award.revoke', { userAwardId });
}

export async function listAwardsForPlayer(publicId: string): Promise<PublicAward[]> {
  const rows = await getDb()
    .select({
      id: userAwards.id,
      name: awards.name,
      icon: awards.icon,
      imageUrl: awards.imageUrl,
      description: awards.description,
      tournamentName: tournaments.name,
      season: userAwards.season,
      awardedAt: userAwards.awardedAt,
    })
    .from(userAwards)
    .innerJoin(users, eq(userAwards.userId, users.discordId))
    .innerJoin(awards, eq(userAwards.awardId, awards.id))
    .leftJoin(tournaments, eq(userAwards.tournamentId, tournaments.id))
    .where(and(
      eq(users.publicId, publicId),
      eq(users.isBlacklisted, false),
      eq(users.showAwards, true),
    ))
    .orderBy(desc(userAwards.awardedAt));

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    imageUrl: r.imageUrl,
    description: r.description,
    tournamentName: r.tournamentName,
    season: r.season,
    awardedAt: r.awardedAt.toISOString(),
  }));
}
