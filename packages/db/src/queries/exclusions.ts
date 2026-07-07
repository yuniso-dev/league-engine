import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, tournamentExclusions, users } from '../schema';

// Honours exclusions: a rule violator (heights etc.) keeps their match stats
// and their team keeps its results, but for THIS tournament they can't win a
// computed honour, make Team of the Tournament, or top the races. Reversible.

export type TournamentExclusion = {
  publicId: string;
  discordId: string;
  displayName: string;
  reason: string | null;
};

export async function listTournamentExclusions(tournamentId: string): Promise<TournamentExclusion[]> {
  const rows = await getDb()
    .select({
      publicId: users.publicId,
      discordId: users.discordId,
      displayName: users.displayName,
      reason: tournamentExclusions.reason,
    })
    .from(tournamentExclusions)
    .innerJoin(users, eq(tournamentExclusions.userId, users.discordId))
    .where(eq(tournamentExclusions.tournamentId, tournamentId))
    .orderBy(asc(users.displayName));
  return rows.filter((r): r is typeof r & { publicId: string } => r.publicId != null);
}

/** Internal filter feed for ceremony/stat computations. */
export async function getExcludedDiscordIds(tournamentId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ userId: tournamentExclusions.userId })
    .from(tournamentExclusions)
    .where(eq(tournamentExclusions.tournamentId, tournamentId));
  return new Set(rows.map(r => r.userId));
}

export async function setTournamentExclusion(
  adminId: string,
  data: { tournamentId: string; publicId: string; reason: string | null },
): Promise<void> {
  const db = getDb();
  const [player] = await db
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.publicId, data.publicId))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  await db
    .insert(tournamentExclusions)
    .values({
      tournamentId: data.tournamentId,
      userId: player.discordId,
      reason: data.reason,
      excludedBy: adminId,
    })
    .onConflictDoNothing();

  await db.insert(adminActions).values({
    adminId,
    action: 'tournament.exclude',
    targetUserId: player.discordId,
    details: { tournamentId: data.tournamentId, reason: data.reason },
  });
}

export async function removeTournamentExclusion(
  adminId: string,
  data: { tournamentId: string; publicId: string },
): Promise<void> {
  const db = getDb();
  const [player] = await db
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.publicId, data.publicId))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  await db
    .delete(tournamentExclusions)
    .where(and(
      eq(tournamentExclusions.tournamentId, data.tournamentId),
      eq(tournamentExclusions.userId, player.discordId),
    ));

  await db.insert(adminActions).values({
    adminId,
    action: 'tournament.unexclude',
    targetUserId: player.discordId,
    details: { tournamentId: data.tournamentId },
  });
}
