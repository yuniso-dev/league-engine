import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { matchDeltas, DEFAULT_ELO_CONFIG, type EloConfig } from '@inazuma/core';
import { getDb } from '../client';
import {
  adminActions,
  config,
  matches,
  matchParticipants,
  ratingHistory,
  teams,
  tournaments,
  users,
} from '../schema';

// Weekly reveal: apply the Elo engine to every unprocessed ranked match in
// chronological order, then re-rank the ladder. previewReveal() and
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
};

export type RevealPreview = {
  matches: RevealMatchPreview[];
  players: RevealPlayerPreview[];
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
  /** Final per-player state after all pending matches, keyed by discordId. */
  players: Map<string, {
    publicId: string | null;
    displayName: string;
    oldElo: number;
    newElo: number;
    oldGames: number;
    newGames: number;
    wasProvisional: boolean;
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
  const seed = (p: (typeof parts)[number]) => {
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

    const deltas = matchDeltas(
      {
        home: home.map(p => ({ elo: state.get(p.userId)!.elo, gamesPlayed: state.get(p.userId)!.games })),
        away: away.map(p => ({ elo: state.get(p.userId)!.elo, gamesPlayed: state.get(p.userId)!.games })),
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

  return { cfg, lastRevealAt, matchIds, matchPreviews, participantUpdates, players };
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
    }))
    .sort((a, b) => b.delta - a.delta);

  return { matches: result.matchPreviews, players, lastRevealAt: result.lastRevealAt };
}

export async function commitReveal(adminId: string): Promise<{ matches: number; players: number }> {
  const db = getDb();

  const counts = await db.transaction(async tx => {
    const result = await computeReveal(tx);
    if (result.matchIds.length === 0) return { matches: 0, players: 0 };

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

    await tx
      .update(matches)
      .set({ processed: true, processedAt: now })
      .where(inArray(matches.id, result.matchIds));

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

    // Re-rank the ladder: established players only, best rating first.
    await tx
      .update(users)
      .set({ rank: null })
      .where(and(eq(users.provisional, true), isNotNull(users.rank)));

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
        eq(users.provisional, false),
      ))
      .orderBy(desc(users.elo), desc(users.gamesPlayed), asc(users.discordId));

    for (let i = 0; i < ladder.length; i++) {
      const u = ladder[i];
      const rank = i + 1;
      const elo = num(u.elo);
      const peakElo = u.peakElo == null ? elo : Math.max(num(u.peakElo), elo);
      const peakRank = u.peakRank == null ? rank : Math.min(u.peakRank, rank);
      await tx
        .update(users)
        .set({ rank, peakElo: fx2(peakElo), peakRank })
        .where(eq(users.discordId, u.discordId));
    }

    // One history row per ladder player per reveal, plus provisional players
    // who featured this week — that keeps profile graphs continuous.
    const newRank = new Map(ladder.map((u, i) => [u.discordId, i + 1]));
    const historyRows = [
      ...ladder.map((u, i) => {
        const played = result.players.get(u.discordId);
        const prev = oldRank.get(u.discordId) ?? null;
        return {
          userId: u.discordId,
          elo: fx2(played ? played.newElo : num(u.elo)),
          rank: i + 1,
          gamesPlayed: u.gamesPlayed,
          weekOf,
          eloChange: fx2(played ? played.newElo - played.oldElo : 0),
          rankChange: prev == null ? null : prev - (i + 1),
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

  if (counts.matches > 0) {
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
