import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../client';
import { adminActions, eaPendingMatches, matches, matchParticipants, teams, tournaments, users, voidedEaMatches } from '../schema';

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

/** Fast dedup: EA matchIds we've already ingested, an admin has VOIDed, or
 *  that sit in the captured-games queue — each is handled exactly once. */
export async function isEaMatchIngested(eaMatchId: string): Promise<boolean> {
  const db = getDb();
  const [ingested] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.eaMatchId, eaMatchId))
    .limit(1);
  if (ingested) return true;
  const [voided] = await db
    .select({ id: voidedEaMatches.eaMatchId })
    .from(voidedEaMatches)
    .where(eq(voidedEaMatches.eaMatchId, eaMatchId))
    .limit(1);
  if (voided) return true;
  const [pending] = await db
    .select({ id: eaPendingMatches.eaMatchId })
    .from(eaPendingMatches)
    .where(eq(eaPendingMatches.eaMatchId, eaMatchId))
    .limit(1);
  return pending != null;
}

/** VOID a bad auto-recorded result (kickoff back-out, half-time glitch):
 *  clears the fixture back to unscored, wipes its stat lines, and blacklists
 *  the junk EA match ID — so the REAL replayed game auto-records onto the
 *  reopened fixture within a couple of minutes of finishing. Blocked once the
 *  match has been processed for Elo (correct that via the reveal, not here). */
export async function voidMatchResult(
  adminId: string,
  matchId: string,
  reason: string | null,
): Promise<void> {
  const db = getDb();
  const [match] = await db
    .select({
      id: matches.id,
      homeScore: matches.homeScore,
      processed: matches.processed,
      eaMatchId: matches.eaMatchId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) throw new Error('Unknown match.');
  if (match.homeScore === null) throw new Error('This fixture has no result to void.');
  if (match.processed) throw new Error('Already processed for Elo — void is blocked to protect ratings.');

  await db.transaction(async tx => {
    if (match.eaMatchId) {
      await tx
        .insert(voidedEaMatches)
        .values({ eaMatchId: match.eaMatchId, matchId, voidedBy: adminId, reason })
        .onConflictDoNothing();
    }
    await tx.delete(matchParticipants).where(eq(matchParticipants.matchId, matchId));
    await tx
      .update(matches)
      .set({ homeScore: null, awayScore: null, playedAt: null, eaMatchId: null, dnf: false })
      .where(eq(matches.id, matchId));
  });

  await db.insert(adminActions).values({
    adminId,
    action: 'match.void',
    details: { matchId, eaMatchId: match.eaMatchId, reason },
  });
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

  // Guard on the fixture ledger + void ledger only — NOT the captured-games
  // queue (applying a captured game routes through here deliberately).
  const [ingested] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.eaMatchId, input.eaMatchId))
    .limit(1);
  if (ingested) return { ok: false, reason: 'already-ingested' };
  const [voided] = await db
    .select({ id: voidedEaMatches.eaMatchId })
    .from(voidedEaMatches)
    .where(eq(voidedEaMatches.eaMatchId, input.eaMatchId))
    .limit(1);
  if (voided) return { ok: false, reason: 'already-ingested' };

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

// ── Captured games (the bug workaround) ───────────────────────────────────────
// The admin is usually PLAYING when a game glitches and gets replayed — they
// can't void the junk result before the replay finishes. So the sync never
// discards a game: anything between linked clubs with no open fixture is
// CAPTURED here in full, and the admin resolves it afterwards.

export type PendingPlayer = FrontierIngestPlayer & { secondsPlayed: number };

export type PendingMatchInput = {
  eaMatchId: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  dnf: boolean;
  durationMin: number | null;
  playedAt: Date;
  players: PendingPlayer[];
};

/** Store a captured game. Idempotent — returns false if already known. */
export async function addPendingMatch(input: PendingMatchInput): Promise<boolean> {
  const rows = await getDb()
    .insert(eaPendingMatches)
    .values({
      eaMatchId: input.eaMatchId,
      tournamentId: input.tournamentId,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      dnf: input.dnf,
      durationMin: input.durationMin,
      playedAt: input.playedAt,
      players: input.players,
    })
    .onConflictDoNothing()
    .returning({ id: eaPendingMatches.eaMatchId });
  return rows.length > 0;
}

export type PendingMatch = {
  eaMatchId: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  dnf: boolean;
  durationMin: number | null;
  playedAt: Date;
};

/** Unresolved captured games for one tournament, oldest first. */
export async function listPendingMatches(tournamentId: string): Promise<PendingMatch[]> {
  const teamA = alias(teams, 'team_a');
  const teamB = alias(teams, 'team_b');
  return getDb()
    .select({
      eaMatchId: eaPendingMatches.eaMatchId,
      teamAId: eaPendingMatches.teamAId,
      teamAName: teamA.name,
      teamBId: eaPendingMatches.teamBId,
      teamBName: teamB.name,
      scoreA: eaPendingMatches.scoreA,
      scoreB: eaPendingMatches.scoreB,
      dnf: eaPendingMatches.dnf,
      durationMin: eaPendingMatches.durationMin,
      playedAt: eaPendingMatches.playedAt,
    })
    .from(eaPendingMatches)
    .innerJoin(teamA, eq(eaPendingMatches.teamAId, teamA.id))
    .innerJoin(teamB, eq(eaPendingMatches.teamBId, teamB.id))
    .where(and(eq(eaPendingMatches.tournamentId, tournamentId), eq(eaPendingMatches.status, 'pending')))
    .orderBy(asc(eaPendingMatches.playedAt));
}

/** APPLY a captured game onto the fixture between its two teams. Targets the
 *  oldest unscored fixture; if every fixture between the pair is scored, the
 *  most recent UNPROCESSED one is voided first and this game takes its place
 *  (the "delete game 1, keep game 2" move). Blocked once Elo has run. */
export async function applyPendingMatch(adminId: string, eaMatchId: string): Promise<string> {
  const db = getDb();

  const [pending] = await db
    .select()
    .from(eaPendingMatches)
    .where(and(eq(eaPendingMatches.eaMatchId, eaMatchId), eq(eaPendingMatches.status, 'pending')))
    .limit(1);
  if (!pending) throw new Error('Captured game not found (already resolved?).');

  // Fixtures between the pair, either orientation.
  const pairFixtures = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      homeScore: matches.homeScore,
      processed: matches.processed,
      eaMatchId: matches.eaMatchId,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(and(
      eq(matches.tournamentId, pending.tournamentId),
      sql`((${matches.homeTeamId} = ${pending.teamAId} and ${matches.awayTeamId} = ${pending.teamBId})
        or (${matches.homeTeamId} = ${pending.teamBId} and ${matches.awayTeamId} = ${pending.teamAId}))`,
    ))
    .orderBy(desc(matches.createdAt));
  if (pairFixtures.length === 0) throw new Error('No fixture exists between these two teams.');

  const unscored = [...pairFixtures].reverse().find(f => f.homeScore === null); // oldest unscored
  const swappable = pairFixtures.find(f => f.homeScore !== null && !f.processed); // most recent unprocessed result
  const target = unscored ?? swappable;
  if (!target) throw new Error('Every fixture between these teams has been processed for Elo — apply is blocked.');

  // Swapping out a result? The old game goes to the void ledger so it can't return.
  if (target.homeScore !== null) {
    await voidMatchResult(adminId, target.id, `superseded by captured game ${eaMatchId}`);
  }

  const players = pending.players as PendingPlayer[];
  const homeIsA = target.homeTeamId === pending.teamAId;
  const outcome = await ingestFrontierResult({
    matchId: target.id,
    eaMatchId,
    playedAt: pending.playedAt,
    homeScore: homeIsA ? pending.scoreA : pending.scoreB,
    awayScore: homeIsA ? pending.scoreB : pending.scoreA,
    dnf: pending.dnf,
    players,
  });
  if (!outcome.ok) throw new Error(`Could not apply — ${outcome.reason}.`);

  await db
    .update(eaPendingMatches)
    .set({ status: 'applied', resolvedBy: adminId, resolvedAt: new Date() })
    .where(eq(eaPendingMatches.eaMatchId, eaMatchId));
  await db.insert(adminActions).values({
    adminId,
    action: 'match.applyPending',
    details: { eaMatchId, matchId: target.id, swapped: target.homeScore !== null },
  });

  return outcome.unmatched.length > 0
    ? `Applied. No site account for: ${outcome.unmatched.join(', ')} — their lines were skipped.`
    : 'Applied — score and every stat line are on the fixture.';
}

/** Bin a captured game (stays on record as discarded; can never re-ingest). */
export async function discardPendingMatch(adminId: string, eaMatchId: string): Promise<void> {
  await getDb()
    .update(eaPendingMatches)
    .set({ status: 'discarded', resolvedBy: adminId, resolvedAt: new Date() })
    .where(and(eq(eaPendingMatches.eaMatchId, eaMatchId), eq(eaPendingMatches.status, 'pending')));
  await getDb().insert(adminActions).values({
    adminId,
    action: 'match.discardPending',
    details: { eaMatchId },
  });
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
