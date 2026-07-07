import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, playerSanctions, tournaments, users } from '../schema';

// Suspensions: no-shows and mid-tournament leavers sit out future Frontiers.
// An ACTIVE sanction (not lifted, frontiers_remaining > 0) blocks signing up.
// Serving is automatic: when a Frontier completes, every active sanction
// loses one unit — except a sanction issued FOR that tournament, so "banned
// for the next Frontier" can never be served by the offence itself. The bot
// mirrors active sanctions onto the punished Discord role and DMs both the
// suspension and the release.

export type SanctionType = 'no_show' | 'abandon' | 'other';

export const SANCTION_LABELS: Record<SanctionType, string> = {
  no_show: 'No-show',
  abandon: 'Abandoned mid-tournament',
  other: 'Rule violation',
};

/** Default ban lengths — leaving a live Frontier hurts far more than not arriving. */
export const SANCTION_DEFAULT_FRONTIERS: Record<SanctionType, number> = {
  no_show: 1,
  abandon: 2,
  other: 1,
};

export type PlayerSanction = {
  id: string;
  discordId: string;
  displayName: string;
  publicId: string | null;
  type: SanctionType;
  reason: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  frontiersRemaining: number;
  issuedBy: string;
  issuedAt: Date;
  liftedAt: Date | null;
  /** Still blocking signups: not lifted and frontiers remain. */
  active: boolean;
};

function toSanction(r: {
  id: string;
  discordId: string;
  displayName: string;
  publicId: string | null;
  type: string;
  reason: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  frontiersRemaining: number;
  issuedBy: string;
  issuedAt: Date;
  liftedAt: Date | null;
}): PlayerSanction {
  return {
    ...r,
    type: (r.type === 'no_show' || r.type === 'abandon' ? r.type : 'other') as SanctionType,
    active: r.liftedAt === null && r.frontiersRemaining > 0,
  };
}

const sanctionSelection = {
  id: playerSanctions.id,
  discordId: users.discordId,
  displayName: users.displayName,
  publicId: users.publicId,
  type: playerSanctions.type,
  reason: playerSanctions.reason,
  tournamentId: playerSanctions.tournamentId,
  tournamentName: tournaments.name,
  frontiersRemaining: playerSanctions.frontiersRemaining,
  issuedBy: playerSanctions.issuedBy,
  issuedAt: playerSanctions.issuedAt,
  liftedAt: playerSanctions.liftedAt,
};

/** Suspend a player — identified by discordId (bot) or publicId (web, which
 *  never sees discordIds). Returns the created sanction (joined for display). */
export async function issueSanction(
  adminId: string,
  data: {
    discordId?: string;
    publicId?: string;
    type: SanctionType;
    reason: string | null;
    frontiers?: number;
    tournamentId?: string | null;
  },
): Promise<PlayerSanction> {
  const db = getDb();
  if (!data.discordId && !data.publicId) throw new Error('Unknown player.');
  const [player] = await db
    .select({ discordId: users.discordId })
    .from(users)
    .where(data.discordId ? eq(users.discordId, data.discordId) : eq(users.publicId, data.publicId!))
    .limit(1);
  if (!player) throw new Error('Unknown player.');

  const frontiers = Math.max(1, Math.min(10, data.frontiers ?? SANCTION_DEFAULT_FRONTIERS[data.type]));

  const [inserted] = await db
    .insert(playerSanctions)
    .values({
      userId: player.discordId,
      type: data.type,
      reason: data.reason,
      tournamentId: data.tournamentId ?? null,
      frontiersRemaining: frontiers,
      issuedBy: adminId,
    })
    .returning({ id: playerSanctions.id });

  await db.insert(adminActions).values({
    adminId,
    action: 'sanction.issue',
    targetUserId: player.discordId,
    details: { sanctionId: inserted.id, type: data.type, frontiers, reason: data.reason, tournamentId: data.tournamentId ?? null },
  });

  const [row] = await db
    .select(sanctionSelection)
    .from(playerSanctions)
    .innerJoin(users, eq(playerSanctions.userId, users.discordId))
    .leftJoin(tournaments, eq(playerSanctions.tournamentId, tournaments.id))
    .where(eq(playerSanctions.id, inserted.id))
    .limit(1);
  return toSanction(row);
}

/** Lift one sanction early (admin pardon). No-op if already lifted. */
export async function liftSanction(adminId: string, sanctionId: string): Promise<void> {
  const db = getDb();
  const lifted = await db
    .update(playerSanctions)
    .set({ liftedBy: adminId, liftedAt: new Date() })
    .where(and(eq(playerSanctions.id, sanctionId), isNull(playerSanctions.liftedAt)))
    .returning({ userId: playerSanctions.userId });
  if (lifted.length === 0) return;

  await db.insert(adminActions).values({
    adminId,
    action: 'sanction.lift',
    targetUserId: lifted[0].userId,
    details: { sanctionId },
  });
}

/** Lift ALL of a player's active sanctions (the bot's /pardon). Returns how many. */
export async function pardonPlayer(adminId: string, discordId: string): Promise<number> {
  const db = getDb();
  const lifted = await db
    .update(playerSanctions)
    .set({ liftedBy: adminId, liftedAt: new Date() })
    .where(and(
      eq(playerSanctions.userId, discordId),
      isNull(playerSanctions.liftedAt),
      gt(playerSanctions.frontiersRemaining, 0),
    ))
    .returning({ id: playerSanctions.id });

  if (lifted.length > 0) {
    await db.insert(adminActions).values({
      adminId,
      action: 'sanction.pardon',
      targetUserId: discordId,
      details: { sanctionIds: lifted.map(l => l.id) },
    });
  }
  return lifted.length;
}

/** Everyone currently suspended — the bot's role mirror and /suspensions list. */
export async function listActiveSanctions(): Promise<PlayerSanction[]> {
  const rows = await getDb()
    .select(sanctionSelection)
    .from(playerSanctions)
    .innerJoin(users, eq(playerSanctions.userId, users.discordId))
    .leftJoin(tournaments, eq(playerSanctions.tournamentId, tournaments.id))
    .where(and(isNull(playerSanctions.liftedAt), gt(playerSanctions.frontiersRemaining, 0)))
    .orderBy(desc(playerSanctions.issuedAt));
  return rows.map(toSanction);
}

/** Full history for one player (admin player page), newest first. */
export async function listSanctionsForUser(discordId: string): Promise<PlayerSanction[]> {
  const rows = await getDb()
    .select(sanctionSelection)
    .from(playerSanctions)
    .innerJoin(users, eq(playerSanctions.userId, users.discordId))
    .leftJoin(tournaments, eq(playerSanctions.tournamentId, tournaments.id))
    .where(eq(playerSanctions.userId, discordId))
    .orderBy(desc(playerSanctions.issuedAt));
  return rows.map(toSanction);
}

/** Full history keyed by publicId — the admin player page (discordId never
 *  reaches the browser, so the web layer can't pass it). */
export async function listSanctionsForPlayer(publicId: string): Promise<PlayerSanction[]> {
  const rows = await getDb()
    .select(sanctionSelection)
    .from(playerSanctions)
    .innerJoin(users, eq(playerSanctions.userId, users.discordId))
    .leftJoin(tournaments, eq(playerSanctions.tournamentId, tournaments.id))
    .where(eq(users.publicId, publicId))
    .orderBy(desc(playerSanctions.issuedAt));
  return rows.map(toSanction);
}

/** The signup gate: the player's heaviest active sanction, or null if clear. */
export async function getActiveSanction(discordId: string): Promise<PlayerSanction | null> {
  const rows = await getDb()
    .select(sanctionSelection)
    .from(playerSanctions)
    .innerJoin(users, eq(playerSanctions.userId, users.discordId))
    .leftJoin(tournaments, eq(playerSanctions.tournamentId, tournaments.id))
    .where(and(
      eq(playerSanctions.userId, discordId),
      isNull(playerSanctions.liftedAt),
      gt(playerSanctions.frontiersRemaining, 0),
    ))
    .orderBy(desc(playerSanctions.frontiersRemaining))
    .limit(1);
  return rows.length > 0 ? toSanction(rows[0]) : null;
}

/** Called when a tournament transitions to completed: one Frontier served.
 *  The offence tournament itself never serves its own sanction. */
export async function serveSanctionsOnCompletion(completedTournamentId: string): Promise<number> {
  const served = await getDb()
    .update(playerSanctions)
    .set({ frontiersRemaining: sql`${playerSanctions.frontiersRemaining} - 1` })
    .where(and(
      isNull(playerSanctions.liftedAt),
      gt(playerSanctions.frontiersRemaining, 0),
      sql`${playerSanctions.tournamentId} is distinct from ${completedTournamentId}::uuid`,
    ))
    .returning({ id: playerSanctions.id });
  return served.length;
}
