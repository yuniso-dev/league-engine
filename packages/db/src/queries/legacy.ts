import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { LegacyCategory, LegacyEdition } from '@inazuma/core';
import { getDb } from '../client';
import type { PlayerTag } from '../dto';
import { adminActions, legacyAwardWinners, legacyEditions, matchParticipants, matches, tournaments, users } from '../schema';

// The pre-website Frontier archive: import a parsed history, and read it back
// for the Hall of Fame "Legacy" section. Winners are stored by Discord ID;
// names/profile links are resolved with a LEFT JOIN to users when present.

/** Replace the whole archive with a freshly parsed one (idempotent re-import).
 *  Editions not in the new payload are removed, so a re-paste is the source of
 *  truth. Runs in one transaction. */
export async function importLegacy(adminId: string, editions: LegacyEdition[]): Promise<{ editions: number; winners: number }> {
  const db = getDb();
  let winnerCount = 0;

  await db.transaction(async tx => {
    // Wipe and reinsert — simplest correct "the paste is the truth" semantics.
    await tx.delete(legacyAwardWinners);
    await tx.delete(legacyEditions);

    for (const e of editions) {
      await tx.insert(legacyEditions).values({ edition: e.edition, label: e.label });
      if (e.winners.length > 0) {
        await tx.insert(legacyAwardWinners).values(
          e.winners.map(w => ({ edition: e.edition, category: w.category, discordId: w.discordId })),
        );
        winnerCount += e.winners.length;
      }
    }
  });

  await db.insert(adminActions).values({
    adminId,
    action: 'legacy.import',
    details: { editions: editions.length, winners: winnerCount },
  });

  return { editions: editions.length, winners: winnerCount };
}

export type LegacyHallWinner = {
  category: LegacyCategory;
  discordId: string;
  /** Resolved from users when the Discord ID still has an account. */
  displayName: string | null;
  publicId: string | null;
};

export type LegacyHallEdition = {
  edition: number;
  label: string;
  winners: LegacyHallWinner[];
};

/** True for "relation does not exist" (42P01) — lets the legacy reads degrade
 *  gracefully to empty when the 0016 migration hasn't been run yet, so a
 *  deploy-before-migrate never breaks the ladder or profiles. */
function isMissingTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '42P01';
}

/** The whole archive, newest edition first, each winner resolved to a
 *  name/profile where the account still exists (else name/publicId null). */
export async function getLegacyHall(): Promise<LegacyHallEdition[]> {
  const db = getDb();

  const editions = await db
    .select({ edition: legacyEditions.edition, label: legacyEditions.label })
    .from(legacyEditions)
    .orderBy(desc(legacyEditions.edition))
    .catch(e => { if (isMissingTable(e)) return []; throw e; });
  if (editions.length === 0) return [];

  const winners = await db
    .select({
      edition: legacyAwardWinners.edition,
      category: legacyAwardWinners.category,
      discordId: legacyAwardWinners.discordId,
      displayName: users.displayName,
      publicId: users.publicId,
    })
    .from(legacyAwardWinners)
    .leftJoin(users, eq(legacyAwardWinners.discordId, users.discordId))
    .orderBy(asc(legacyAwardWinners.edition));

  const byEdition = new Map<number, LegacyHallWinner[]>();
  for (const w of winners) {
    const list = byEdition.get(w.edition) ?? [];
    list.push({
      category: w.category as LegacyCategory,
      discordId: w.discordId,
      displayName: w.displayName,
      publicId: w.publicId,
    });
    byEdition.set(w.edition, list);
  }

  return editions.map(e => ({
    edition: e.edition,
    label: e.label,
    winners: byEdition.get(e.edition) ?? [],
  }));
}

/** Discord IDs that appear anywhere in the legacy archive — used to award the
 *  Legacy tag to current members who featured in the old version. */
export async function getLegacyTaggedDiscordIds(): Promise<Set<string>> {
  const rows = await getDb()
    .selectDistinct({ discordId: legacyAwardWinners.discordId })
    .from(legacyAwardWinners)
    .catch(e => { if (isMissingTable(e)) return []; throw e; });
  return new Set(rows.map(r => r.discordId));
}

/** Discord IDs that played the test (Season 0) frontier — the Beta tag. */
export async function getBetaDiscordIds(): Promise<Set<string>> {
  const rows = await getDb()
    .selectDistinct({ discordId: matchParticipants.userId })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(tournaments.season, 0));
  return new Set(rows.map(r => r.discordId));
}

/** Both tag sets, for the rankings query (attach per row). */
export async function getTagSets(): Promise<{ legacy: Set<string>; beta: Set<string> }> {
  const [legacy, beta] = await Promise.all([getLegacyTaggedDiscordIds(), getBetaDiscordIds()]);
  return { legacy, beta };
}

/** Tags for a single player by public id — used by the profile payload so the
 *  Legacy/Beta entries render regardless of how the profile was opened. */
export async function getTagsForPublicId(publicId: string): Promise<PlayerTag[]> {
  const [row] = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.publicId, publicId))
    .limit(1);
  return row ? getTagsForDiscordId(row.discordId) : [];
}

/** Tags for a single player — cheap targeted lookups for the profile page. */
export async function getTagsForDiscordId(discordId: string): Promise<PlayerTag[]> {
  const db = getDb();
  const [legacyRow, betaRow] = await Promise.all([
    db.select({ x: sql`1` }).from(legacyAwardWinners).where(eq(legacyAwardWinners.discordId, discordId)).limit(1)
      .catch(e => { if (isMissingTable(e)) return []; throw e; }),
    db
      .select({ x: sql`1` })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
      .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
      .where(and(eq(matchParticipants.userId, discordId), eq(tournaments.season, 0)))
      .limit(1),
  ]);
  const tags: PlayerTag[] = [];
  if (legacyRow.length) tags.push('legacy');
  if (betaRow.length) tags.push('beta');
  return tags;
}
