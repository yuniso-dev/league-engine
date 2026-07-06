import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, matches, matchParticipants, teams, tournaments, users } from '../schema';

// Frontier automation: teams link the captain's fresh EA club, and the bot
// fills unscored fixtures from the EA API — scores AND per-player stats — so
// nobody types results mid-tournament. The manual forms remain the fallback
// and always win: a fixture that already has a score is never overwritten.

// ── What the bot polls against ────────────────────────────────────────────────

export type LinkedLiveTournament = {
  tournamentId: string;
  tournamentName: string;
  /** Teams with an EA club bound (clubId → team). */
  clubs: { clubId: string; teamId: string; teamName: string }[];
  /** Fixtures still waiting for a result, oldest first. */
  unscoredFixtures: { matchId: string; homeTeamId: string; awayTeamId: string; createdAt: Date }[];
};

/** Live tournaments with ≥2 linked clubs — the only time polling makes sense. */
export async function getLinkedLiveTournaments(): Promise<LinkedLiveTournament[]> {
  const db = getDb();

  const liveTournaments = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.status, 'live'));
  if (liveTournaments.length === 0) return [];
  const ids = liveTournaments.map(t => t.id);
  const nameOf = new Map(liveTournaments.map(t => [t.id, t.name]));

  const [teamRows, fixtureRows] = await Promise.all([
    db
      .select({
        teamId: teams.id,
        tournamentId: teams.tournamentId,
        name: teams.name,
        eaClubId: teams.eaClubId,
      })
      .from(teams)
      .where(inArray(teams.tournamentId, ids)),
    db
      .select({
        matchId: matches.id,
        tournamentId: matches.tournamentId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        createdAt: matches.createdAt,
      })
      .from(matches)
      .where(and(inArray(matches.tournamentId, ids), isNull(matches.homeScore)))
      .orderBy(matches.createdAt),
  ]);

  return ids
    .map(tournamentId => ({
      tournamentId,
      tournamentName: nameOf.get(tournamentId) ?? '?',
      clubs: teamRows
        .filter(t => t.tournamentId === tournamentId && t.eaClubId != null)
        .map(t => ({ clubId: t.eaClubId!, teamId: t.teamId, teamName: t.name })),
      unscoredFixtures: fixtureRows
        .filter(f => f.tournamentId === tournamentId)
        .map(f => ({ matchId: f.matchId, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, createdAt: f.createdAt })),
    }))
    .filter(t => t.clubs.length >= 2);
}

/** Fast dedup: EA matchIds we've already ingested (checked before any work). */
export async function isEaMatchIngested(eaMatchId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.eaMatchId, eaMatchId))
    .limit(1);
  return row != null;
}

// ── The ingest itself ─────────────────────────────────────────────────────────

export type FrontierIngestPlayer = {
  teamId: string;
  eaName: string;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheet: boolean;
  saves: number;
  redCards: number;
  mom: boolean;
  rating: number | null;
  position: string | null;
};

export type FrontierIngestInput = {
  matchId: string; // OUR fixture id
  eaMatchId: string;
  playedAt: Date;
  homeScore: number;
  awayScore: number;
  /** Decided by a side quitting — the score may be an EA forfeit. */
  dnf: boolean;
  players: FrontierIngestPlayer[];
};

export type FrontierIngestOutcome =
  | { ok: true; participants: number; unmatched: string[] }
  | { ok: false; reason: 'already-ingested' | 'already-scored' | 'unknown-fixture' };

/**
 * Fill one fixture from an EA match. Idempotent by eaMatchId; never touches a
 * fixture that already has a score (the admin's manual entry wins). Players
 * are resolved via lower(users.ea_name) — EA names with no linked site
 * account are reported back in `unmatched` so the log says who's invisible.
 */
export async function ingestFrontierResult(input: FrontierIngestInput): Promise<FrontierIngestOutcome> {
  const db = getDb();

  if (await isEaMatchIngested(input.eaMatchId)) return { ok: false, reason: 'already-ingested' };

  const [match] = await db
    .select({ id: matches.id, homeTeamId: matches.homeTeamId, homeScore: matches.homeScore })
    .from(matches)
    .where(eq(matches.id, input.matchId))
    .limit(1);
  if (!match) return { ok: false, reason: 'unknown-fixture' };
  if (match.homeScore !== null) return { ok: false, reason: 'already-scored' };

  // Resolve EA personas → site accounts, case-insensitively (parameterised).
  const names = input.players.map(p => p.eaName.toLowerCase());
  const userRows = names.length
    ? await db
        .select({
          discordId: users.discordId,
          eaName: sql<string>`lower(${users.eaName})`,
        })
        .from(users)
        .where(and(inArray(sql`lower(${users.eaName})`, names), eq(users.isBlacklisted, false)))
    : [];
  const idOf = new Map(userRows.map(r => [r.eaName, r.discordId]));

  const matched = input.players.filter(p => idOf.has(p.eaName.toLowerCase()));
  const unmatched = input.players
    .filter(p => !idOf.has(p.eaName.toLowerCase()))
    .map(p => p.eaName);

  const resultOf = (teamId: string): 'win' | 'loss' | 'draw' => {
    const isHome = teamId === match.homeTeamId;
    const us = isHome ? input.homeScore : input.awayScore;
    const them = isHome ? input.awayScore : input.homeScore;
    return us > them ? 'win' : us < them ? 'loss' : 'draw';
  };

  await db.transaction(async tx => {
    await tx
      .update(matches)
      .set({
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        playedAt: input.playedAt,
        eaMatchId: input.eaMatchId,
        dnf: input.dnf,
      })
      .where(eq(matches.id, input.matchId));

    if (matched.length > 0) {
      await tx.insert(matchParticipants).values(
        matched.map(p => ({
          matchId: input.matchId,
          userId: idOf.get(p.eaName.toLowerCase())!,
          teamId: p.teamId,
          result: resultOf(p.teamId),
          goals: p.goals,
          assists: p.assists,
          tackles: p.tackles,
          cleanSheet: p.cleanSheet,
          saves: p.saves,
          redCards: p.redCards,
          mom: p.mom,
          rating: p.rating != null ? p.rating.toFixed(2) : null,
          position: p.position,
        })),
      );
    }
  });

  return { ok: true, participants: matched.length, unmatched };
}

// ── Admin: bind a club to a team ──────────────────────────────────────────────

/** Set (or clear) the EA club linked to a team. */
export async function setTeamEaClub(
  adminId: string,
  teamId: string,
  eaClubId: string | null,
): Promise<void> {
  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new Error('Unknown team.');

  await db.update(teams).set({ eaClubId }).where(eq(teams.id, teamId));
  await db.insert(adminActions).values({
    adminId,
    action: 'team.eaclub',
    details: { teamId, eaClubId },
  });
}
