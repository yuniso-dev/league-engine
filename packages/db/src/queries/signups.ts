import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { eventSignups, tournaments, users, voicePresence } from '../schema';
import { SANCTION_LABELS, getActiveSanction } from './sanctions';

// Frontier signups — uses the event_signups table that has existed since the
// original schema. Signing up says "I want in"; the draft board then cross-
// references who is ACTUALLY in voice (mirrored live by the Discord bot) so
// admins draft people who showed up, not just people who clicked.

export type PublicSignup = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
  /** True when the bot currently sees them in a voice channel. */
  inVoice: boolean;
};

/** Sign the player up for an upcoming tournament. Idempotent. */
export async function signUpForTournament(discordId: string, tournamentId: string): Promise<void> {
  const db = getDb();

  const [tournament] = await db
    .select({ status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');
  if (tournament.status !== 'upcoming') throw new Error('Signups are closed — this Frontier is underway.');

  const [player] = await db
    .select({ initialised: users.initialised, isBlacklisted: users.isBlacklisted })
    .from(users)
    .where(eq(users.discordId, discordId))
    .limit(1);
  if (!player || player.isBlacklisted) throw new Error('Unknown player.');
  if (!player.initialised) throw new Error('Complete your profile first.');

  const ban = await getActiveSanction(discordId);
  if (ban) {
    const n = ban.frontiersRemaining;
    throw new Error(
      `Suspended — you're sitting out ${n === 1 ? 'the next Frontier' : `the next ${n} Frontiers`} ` +
      `(${SANCTION_LABELS[ban.type].toLowerCase()}${ban.reason ? `: ${ban.reason}` : ''}). ` +
      `Talk to an admin if you think this is wrong.`,
    );
  }

  const [existing] = await db
    .select({ id: eventSignups.id })
    .from(eventSignups)
    .where(and(eq(eventSignups.tournamentId, tournamentId), eq(eventSignups.userId, discordId)))
    .limit(1);
  if (existing) return; // already in — idempotent

  await db.insert(eventSignups).values({ tournamentId, userId: discordId, source: 'web' });
  await db
    .update(users)
    .set({ eventsSignedUp: sql`${users.eventsSignedUp} + 1` })
    .where(eq(users.discordId, discordId));
}

/** Withdraw from an upcoming tournament. Idempotent. */
export async function withdrawSignup(discordId: string, tournamentId: string): Promise<void> {
  const db = getDb();

  const [tournament] = await db
    .select({ status: tournaments.status })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error('Unknown tournament.');
  if (tournament.status !== 'upcoming') throw new Error('The Frontier is underway — talk to an admin.');

  const removed = await db
    .delete(eventSignups)
    .where(and(eq(eventSignups.tournamentId, tournamentId), eq(eventSignups.userId, discordId)))
    .returning({ id: eventSignups.id });

  if (removed.length > 0) {
    await db
      .update(users)
      .set({ eventsSignedUp: sql`greatest(${users.eventsSignedUp} - 1, 0)` })
      .where(eq(users.discordId, discordId));
  }
}

/** Is this player signed up? (button state on the public page) */
export async function isSignedUp(discordId: string, tournamentId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: eventSignups.id })
    .from(eventSignups)
    .where(and(eq(eventSignups.tournamentId, tournamentId), eq(eventSignups.userId, discordId)))
    .limit(1);
  return row != null;
}

/** The signup roster with live voice status — in-voice players first. */
export async function getSignupsForTournament(tournamentId: string): Promise<PublicSignup[]> {
  const rows = await getDb()
    .select({
      publicId: users.publicId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      country: users.country,
      position1: users.position1,
      position2: users.position2,
      hidePositions: users.hidePositions,
      inVoiceChannel: voicePresence.channelName,
      signedUpAt: eventSignups.signedUpAt,
    })
    .from(eventSignups)
    .innerJoin(users, eq(eventSignups.userId, users.discordId))
    .leftJoin(voicePresence, eq(voicePresence.discordId, users.discordId))
    .where(and(eq(eventSignups.tournamentId, tournamentId), eq(users.isBlacklisted, false)))
    .orderBy(desc(sql`${voicePresence.channelName} is not null`), asc(eventSignups.signedUpAt));

  // Deduplicate defensively (event_signups has no unique constraint).
  const seen = new Set<string>();
  const out: PublicSignup[] = [];
  for (const r of rows) {
    if (!r.publicId || seen.has(r.publicId)) continue;
    seen.add(r.publicId);
    out.push({
      publicId: r.publicId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      country: r.country,
      position1: r.position1,
      position2: r.position2,
      hidePositions: r.hidePositions,
      inVoice: r.inVoiceChannel != null,
    });
  }
  return out;
}

/** discordIds signed up for a tournament — feeds the bot's signup-role mirror. */
export async function getSignupDiscordIds(tournamentId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ userId: eventSignups.userId })
    .from(eventSignups)
    .where(eq(eventSignups.tournamentId, tournamentId));
  return [...new Set(rows.map(r => r.userId))];
}

/** publicIds of everyone currently in voice — the draft board's live layer. */
export async function getInVoicePublicIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ publicId: users.publicId })
    .from(voicePresence)
    .innerJoin(users, eq(voicePresence.discordId, users.discordId))
    .where(eq(users.isBlacklisted, false));
  return rows.map(r => r.publicId).filter((p): p is string => p != null);
}

/** Mark drafted signups as attended (called when a player lands on a team). */
export async function markAttendedIfSignedUp(
  tournamentIds: string[],
  discordId: string,
): Promise<void> {
  if (tournamentIds.length === 0) return;
  const db = getDb();
  const updated = await db
    .update(eventSignups)
    .set({ attended: true })
    .where(and(
      inArray(eventSignups.tournamentId, tournamentIds),
      eq(eventSignups.userId, discordId),
      sql`${eventSignups.attended} is distinct from true`,
    ))
    .returning({ id: eventSignups.id });

  if (updated.length > 0) {
    await db
      .update(users)
      .set({ eventsAttended: sql`${users.eventsAttended} + ${updated.length}` })
      .where(eq(users.discordId, discordId));
  }
}
