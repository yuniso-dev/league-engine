import { eq, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, config, ratingHistory, users } from '../schema';

// Season lifecycle: a hard reset of the ladder (for starting a fresh season
// after a beta/test run) and a per-player Elo override for one-off corrections.
// Neither touches tournaments/matches/awards — those stay as history and feed
// the Hall of Fame, Season 0 (Beta), and the tags.

const fx2 = (n: number): string => n.toFixed(2);

/**
 * Wipe every player's ladder rating back to the base Elo and start a new
 * season. Clears games, provisional, rank, peaks and the rating-history graphs,
 * so the ladder reads "everyone unranked at base" until real games are played
 * and revealed. Tournaments, matches and awards are deliberately left intact.
 */
export async function resetSeasonRatings(
  adminId: string,
  opts: { newSeason: number },
): Promise<{ players: number }> {
  const db = getDb();

  const players = await db.transaction(async tx => {
    const [cfg] = await tx
      .select({ eloBase: config.eloBase })
      .from(config)
      .limit(1);
    const base = cfg?.eloBase ?? '1000';
    const now = new Date();

    await tx.update(users).set({
      elo: base,
      gamesPlayed: 0,
      provisional: true,
      rank: null,
      peakElo: null,
      peakRank: null,
      updatedAt: now,
    });

    await tx.delete(ratingHistory);

    await tx
      .update(config)
      .set({ currentSeason: opts.newSeason, updatedAt: now })
      .where(eq(config.id, 1));

    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
    return n;
  });

  await db.insert(adminActions).values({
    adminId,
    action: 'season.reset',
    details: { newSeason: opts.newSeason, players },
  });

  return { players };
}

/**
 * Manually set one player's Elo (and optionally games played), keyed by their
 * public id. Provisional is recomputed from the placement threshold. Rank is
 * left to the next reveal / recalc so ties stay consistent across the ladder.
 */
export async function setPlayerElo(
  adminId: string,
  publicId: string,
  opts: { elo: number; gamesPlayed?: number },
): Promise<void> {
  const db = getDb();
  const [target] = await db
    .select({ discordId: users.discordId })
    .from(users)
    .where(eq(users.publicId, publicId))
    .limit(1);
  if (!target) throw new Error('Player not found.');

  const [cfg] = await db.select({ placementGames: config.placementGames }).from(config).limit(1);
  const placement = cfg?.placementGames ?? 3;

  await db
    .update(users)
    .set({
      elo: fx2(opts.elo),
      ...(opts.gamesPlayed != null
        ? { gamesPlayed: opts.gamesPlayed, provisional: opts.gamesPlayed < placement }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.publicId, publicId));

  await db.insert(adminActions).values({
    adminId,
    action: 'player.setElo',
    targetUserId: target.discordId,
    details: { elo: opts.elo, gamesPlayed: opts.gamesPlayed ?? null },
  });
}
