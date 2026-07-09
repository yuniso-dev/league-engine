import { and, asc, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  matchDeltas,
  awardBonusForName,
  AWARD_BONUS_CAP_PER_REVEAL,
  DEFAULT_ELO_CONFIG,
  type EloConfig,
} from '@inazuma/core';
import { getDb } from '../client';
import {
  adminActions,
  awards,
  config,
  matches,
  matchParticipants,
  ratingHistory,
  teams,
  tournaments,
  userAwards,
  users,
} from '../schema';

// Weekly reveal: apply the Elo engine to every unprocessed ranked match in
// chronological order — each participant's recorded match stats personalise
// their slice of the team swing — then pay one-off Elo bonuses for honours
// granted since the last reveal, and re-rank the ladder. previewReveal() and
// commitReveal() share computeReveal() so what the admin sees is exactly
// what gets committed.

type DbLike = ReturnType<typeof getDb>;
// Drizzle's transaction client shares the query API surface we use.
type TxLike = Parameters<Parameters<DbLike['transaction']>[0]>[0];
type Queryable = DbLike | TxLike;

export type RevealMatchPreview = {
  id: string;
  tournamentName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  playedAt: Date | null;
};

export type RevealPlayerPreview = {
  publicId: string | null;
  displayName: string;
  oldElo: number;
  newElo: number;
  delta: number;
  oldGames: number;
  newGames: number;
  wasProvisional: boolean;
  nowProvisional: boolean;
  /** One-off Elo from honours granted since the last reveal (already inside delta). */
  awardBonus: number;
};

export type RevealAwardPreview = {
  displayName: string;
  awardName: string;
  awardIcon: string | null;
  bonus: number;
};

export type RevealPreview = {
  matches: RevealMatchPreview[];
  players: RevealPlayerPreview[];
  awardGrants: RevealAwardPreview[];
  lastRevealAt: Date | null;
};

export type RatingPoint = {
  weekOf: string;
  elo: number;
  rank: number | null;
};

const num = (v: string | null): number => (v == null ? 0 : parseFloat(v));
const fx2 = (v: number): string => v.toFixed(2);

type ParticipantUpdate = {
  participantId: string;
  userId: string;
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
};

type ComputeResult = {
  cfg: EloConfig;
  lastRevealAt: Date | null;
  matchIds: string[];
  matchPreviews: RevealMatchPreview[];
  participantUpdates: ParticipantUpdate[];
  awardGrants: RevealAwardPreview[];
  /** Final per-player state after all pending matches, keyed by discordId. */
  players: Map<string, {
    publicId: string | null;
    displayName: string;
    oldElo: number;
    newElo: number;
    oldGames: number;
    newGames: number;
    wasProvisional: boolean;
    awardBonus: number;
  }>;
};

async function loadEloConfig(db: Queryable): Promise<{ cfg: EloConfig; lastRevealAt: Date | null }> {
  const [row] = await db.select().from(config).limit(1);
  if (!row) return { cfg: DEFAULT_ELO_CONFIG, lastRevealAt: null };
  return {
    cfg: {
      kPlacement: row.kPlacement,
      kEstablished: row.kEstablished,
      placementGames: row.placementGames,
      movMultiplierCap: num(row.movMultiplierCap),
    },
    lastRevealAt: row.lastRevealAt,
  };
}

async function computeReveal(db: Queryable): Promise<ComputeResult> {
  const { cfg, lastRevealAt } = await loadEloConfig(db);

  const homeTeam = alias(teams, 'home_team');
  const awayTeam = alias(teams, 'away_team');

  const pending = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      playedAt: matches.playedAt,
      tournamentName: tournaments.name,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(and(
      eq(matches.processed, false),
      eq(matches.ranked, true),
      isNotNull(matches.homeScore),
      isNotNull(matches.awayScore),
    ))
    .orderBy(asc(matches.playedAt), asc(matches.createdAt));

  const parts = pending.length
    ? await db
        .select({
          id: matchParticipants.id,
          matchId: matchParticipants.matchId,
          userId: matchParticipants.userId,
          teamId: matchParticipants.teamId,
          rating: matchParticipants.rating,
          goals: matchParticipants.goals,
          assists: matchParticipants.assists,
          tackles: matchParticipants.tackles,
          elo: users.elo,
          gamesPlayed: users.gamesPlayed,
          provisional: users.provisional,
          publicId: users.publicId,
          displayName: users.displayName,
        })
        .from(matchParticipants)
        .innerJoin(users, eq(matchParticipants.userId, users.discordId))
        .where(inArray(matchParticipants.matchId, pending.map(m => m.id)))
    : [];

  const byMatch = new Map<string, typeof parts>();
  for (const p of parts) {
    const list = byMatch.get(p.matchId) ?? [];
    list.push(p);
    byMatch.set(p.matchId, list);
  }

  // Working state carries ratings forward match-by-match within the reveal.
  const state = new Map<string, { elo: number; games: number }>();
  const players: ComputeResult['players'] = new Map();
  const seed = (p: {
    userId: string;
    elo: string | null;
    gamesPlayed: number;
    provisional: boolean;
    publicId: string | null;
    displayName: string;
  }) => {
    if (!state.has(p.userId)) {
      state.set(p.userId, { elo: num(p.elo), games: p.gamesPlayed });
      players.set(p.userId, {
        publicId: p.publicId,
        displayName: p.displayName,
        oldElo: num(p.elo),
        newElo: num(p.elo),
        oldGames: p.gamesPlayed,
        newGames: p.gamesPlayed,
        wasProvisional: p.provisional,
        awardBonus: 0,
      });
    }
  };

  const matchIds: string[] = [];
  const matchPreviews: RevealMatchPreview[] = [];
  const participantUpdates: ParticipantUpdate[] = [];

  for (const m of pending) {
    const all = byMatch.get(m.id) ?? [];
    const home = all.filter(p => p.teamId === m.homeTeamId);
    const away = all.filter(p => p.teamId === m.awayTeamId);
    // A side with no recorded participants can't be rated — leave the match pending.
    if (home.length === 0 || away.length === 0) continue;

    [...home, ...away].forEach(seed);

    // Per-player stats ride along so teammates with a better match rating /
    // more goal involvement earn a bigger slice of the team swing.
    const toEloPlayer = (p: (typeof parts)[number]) => ({
      elo: state.get(p.userId)!.elo,
      gamesPlayed: state.get(p.userId)!.games,
      stats: {
        rating: p.rating == null ? null : num(p.rating),
        goals: p.goals,
        assists: p.assists,
        tackles: p.tackles,
      },
    });

    const deltas = matchDeltas(
      {
        home: home.map(toEloPlayer),
        away: away.map(toEloPlayer),
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
      },
      cfg,
    );

    const apply = (p: (typeof parts)[number], delta: number) => {
      const s = state.get(p.userId)!;
      const before = s.elo;
      s.elo = Math.round((s.elo + delta) * 100) / 100;
      s.games += 1;
      participantUpdates.push({
        participantId: p.id,
        userId: p.userId,
        eloBefore: before,
        eloAfter: s.elo,
        eloChange: delta,
      });
      const summary = players.get(p.userId)!;
      summary.newElo = s.elo;
      summary.newGames = s.games;
    };
    home.forEach((p, i) => apply(p, deltas.home[i]));
    away.forEach((p, i) => apply(p, deltas.away[i]));

    matchIds.push(m.id);
    matchPreviews.push({
      id: m.id,
      tournamentName: m.tournamentName,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
      playedAt: m.playedAt,
    });
  }

  // ── Award bonuses ── honours granted since the last reveal pay a one-off
  // Elo boost, applied AFTER the matches (the ceremony follows the games).
  // Scoped by the lastRevealAt watermark, so each grant pays exactly once.
  const grants = await db
    .select({
      userId: userAwards.userId,
      awardName: awards.name,
      awardIcon: awards.icon,
    })
    .from(userAwards)
    .innerJoin(awards, eq(userAwards.awardId, awards.id))
    .where(lastRevealAt ? gt(userAwards.awardedAt, lastRevealAt) : undefined)
    .orderBy(asc(userAwards.awardedAt));

  const awardGrants: RevealAwardPreview[] = [];
  const bonusByUser = new Map<string, { total: number; rows: { awardName: string; awardIcon: string | null; bonus: number }[] }>();
  for (const g of grants) {
    const bonus = awardBonusForName(g.awardName);
    if (bonus === 0) continue;
    const entry = bonusByUser.get(g.userId) ?? { total: 0, rows: [] };
    entry.total += bonus;
    entry.rows.push({ awardName: g.awardName, awardIcon: g.awardIcon, bonus });
    bonusByUser.set(g.userId, entry);
  }

  if (bonusByUser.size > 0) {
    // Winners who have no pending match this reveal still need seeding.
    const missing = [...bonusByUser.keys()].filter(id => !state.has(id));
    if (missing.length > 0) {
      const rows = await db
        .select({
          userId: users.discordId,
          elo: users.elo,
          gamesPlayed: users.gamesPlayed,
          provisional: users.provisional,
          publicId: users.publicId,
          displayName: users.displayName,
        })
        .from(users)
        .where(inArray(users.discordId, missing));
      rows.forEach(seed);
    }

    for (const [userId, entry] of bonusByUser) {
      const s = state.get(userId);
      const summary = players.get(userId);
      if (!s || !summary) continue; // award row without a users row — skip
      // Capped per reveal so a full sweep can't run away with the ladder.
      const applied = Math.min(entry.total, AWARD_BONUS_CAP_PER_REVEAL);
      const scale = applied / entry.total;
      s.elo = Math.round((s.elo + applied) * 100) / 100;
      summary.newElo = s.elo;
      summary.awardBonus = Math.round(applied * 100) / 100;
      for (const r of entry.rows) {
        awardGrants.push({
          displayName: summary.displayName,
          awardName: r.awardName,
          awardIcon: r.awardIcon,
          bonus: Math.round(r.bonus * scale * 100) / 100,
        });
      }
    }
  }

  return { cfg, lastRevealAt, matchIds, matchPreviews, participantUpdates, awardGrants, players };
}

export async function previewReveal(): Promise<RevealPreview> {
  const result = await computeReveal(getDb());
  const players = [...result.players.values()]
    .map(p => ({
      publicId: p.publicId,
      displayName: p.displayName,
      oldElo: p.oldElo,
      newElo: p.newElo,
      delta: Math.round((p.newElo - p.oldElo) * 100) / 100,
      oldGames: p.oldGames,
      newGames: p.newGames,
      wasProvisional: p.wasProvisional,
      nowProvisional: p.newGames < result.cfg.placementGames,
      awardBonus: p.awardBonus,
    }))
    .sort((a, b) => b.delta - a.delta);

  return {
    matches: result.matchPreviews,
    players,
    awardGrants: result.awardGrants,
    lastRevealAt: result.lastRevealAt,
  };
}

export async function commitReveal(adminId: string): Promise<{ matches: number; players: number }> {
  const db = getDb();

  const counts = await db.transaction(async tx => {
    const result = await computeReveal(tx);
    // Award-only reveals are valid: a ceremony after the last reveal pays its
    // bonuses even when no new matches are pending.
    if (result.matchIds.length === 0 && result.players.size === 0) {
      return { matches: 0, players: 0 };
    }

    const now = new Date();
    const weekOf = now.toISOString().slice(0, 10);

    // Ranks before this reveal, for rank_change in the history rows.
    const before = await tx
      .select({ discordId: users.discordId, rank: users.rank })
      .from(users)
      .where(eq(users.initialised, true));
    const oldRank = new Map(before.map(r => [r.discordId, r.rank]));

    for (const u of result.participantUpdates) {
      await tx
        .update(matchParticipants)
        .set({
          eloBefore: fx2(u.eloBefore),
          eloAfter: fx2(u.eloAfter),
          eloChange: fx2(u.eloChange),
        })
        .where(eq(matchParticipants.id, u.participantId));
    }

    if (result.matchIds.length > 0) {
      await tx
        .update(matches)
        .set({ processed: true, processedAt: now })
        .where(inArray(matches.id, result.matchIds));
    }

    for (const [discordId, p] of result.players) {
      await tx
        .update(users)
        .set({
          elo: fx2(p.newElo),
          gamesPlayed: p.newGames,
          provisional: p.newGames < result.cfg.placementGames,
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(users.discordId, discordId));
    }

    // Re-rank the ladder: every active player (provisional included), best
    // rating first. Standard competition ranking — equal Elo shares the same
    // rank (1,1,1,4), so an untouched league is all #1 until ratings move.
    const ladder = await tx
      .select({
        discordId: users.discordId,
        elo: users.elo,
        gamesPlayed: users.gamesPlayed,
        peakElo: users.peakElo,
        peakRank: users.peakRank,
      })
      .from(users)
      .where(and(
        eq(users.initialised, true),
        eq(users.isBlacklisted, false),
        eq(users.isInactive, false),
      ))
      .orderBy(desc(users.elo), desc(users.gamesPlayed), asc(users.discordId));

    const ranks: number[] = [];
    for (let i = 0; i < ladder.length; i++) {
      // Same Elo as the player above → same rank; otherwise position (1-based).
      ranks.push(i > 0 && num(ladder[i].elo) === num(ladder[i - 1].elo) ? ranks[i - 1] : i + 1);
    }

    for (let i = 0; i < ladder.length; i++) {
      const u = ladder[i];
      const rank = ranks[i];
      const elo = num(u.elo);
      const peakElo = u.peakElo == null ? elo : Math.max(num(u.peakElo), elo);
      const peakRank = u.peakRank == null ? rank : Math.min(u.peakRank, rank);
      await tx
        .update(users)
        .set({ rank, peakElo: fx2(peakElo), peakRank })
        .where(eq(users.discordId, u.discordId));
    }

    // One history row per ladder player per reveal — every active player has
    // a rank now, so this covers provisional players who featured too.
    const newRank = new Map(ladder.map((u, i) => [u.discordId, ranks[i]]));
    const historyRows = [
      ...ladder.map((u, i) => {
        const played = result.players.get(u.discordId);
        const prev = oldRank.get(u.discordId) ?? null;
        return {
          userId: u.discordId,
          elo: fx2(played ? played.newElo : num(u.elo)),
          rank: ranks[i],
          gamesPlayed: u.gamesPlayed,
          weekOf,
          eloChange: fx2(played ? played.newElo - played.oldElo : 0),
          rankChange: prev == null ? null : prev - ranks[i],
        };
      }),
      ...[...result.players.entries()]
        .filter(([id, p]) => !newRank.has(id) && p.newGames < result.cfg.placementGames)
        .map(([id, p]) => ({
          userId: id,
          elo: fx2(p.newElo),
          rank: null,
          gamesPlayed: p.newGames,
          weekOf,
          eloChange: fx2(p.newElo - p.oldElo),
          rankChange: null,
        })),
    ];
    if (historyRows.length > 0) {
      await tx.insert(ratingHistory).values(historyRows);
    }

    await tx
      .insert(config)
      .values({ id: 1, lastRevealAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: config.id, set: { lastRevealAt: now, updatedAt: now } });

    return { matches: result.matchIds.length, players: result.players.size };
  });

  if (counts.matches > 0 || counts.players > 0) {
    await getDb().insert(adminActions).values({
      adminId,
      action: 'reveal.commit',
      details: counts,
    });
  }
  return counts;
}

/** Rating history for a public profile graph — safe fields only. */
export async function getRatingHistoryByPublicId(publicId: string): Promise<RatingPoint[]> {
  const rows = await getDb()
    .select({
      weekOf: ratingHistory.weekOf,
      elo: ratingHistory.elo,
      rank: ratingHistory.rank,
      createdAt: ratingHistory.createdAt,
    })
    .from(ratingHistory)
    .innerJoin(users, eq(ratingHistory.userId, users.discordId))
    .where(and(
      eq(users.publicId, publicId),
      eq(users.initialised, true),
      eq(users.isBlacklisted, false),
    ))
    .orderBy(asc(ratingHistory.weekOf), asc(ratingHistory.createdAt));

  return rows.map(r => ({ weekOf: r.weekOf, elo: num(r.elo), rank: r.rank }));
}
