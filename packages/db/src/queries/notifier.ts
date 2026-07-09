import { asc, eq, gt, inArray, lte, ne, and, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { awards, eventSignups, teamMembers, teams, tournaments, userAwards, users } from '../schema';

/** Site owners/admins — the alert targets for anything needing a human call
 *  (DNF forfeits, stale fixtures). */
export async function getAdminDiscordIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ discordId: users.discordId })
    .from(users)
    .where(and(inArray(users.role, ['owner', 'admin']), eq(users.isBlacklisted, false)));
  return rows.map(r => r.discordId);
}

// Feed queries for the bot's DM notifier. Each returns rows AFTER a watermark
// the bot holds in memory (seeded to boot time, so restarts never replay
// history into people's DMs).

export type NewAwardGrant = {
  discordId: string;
  awardName: string;
  awardIcon: string | null;
  /** For the trophy-cabinet link; null when the winner has no public profile. */
  publicId: string | null;
  awardedAt: Date;
};

/** Award grants after `since`, oldest first. Deliberately NOT scoped to an
 *  open tournament — ceremonies run after a Frontier completes. */
export async function getNewAwardGrants(since: Date): Promise<NewAwardGrant[]> {
  return getDb()
    .select({
      discordId: userAwards.userId,
      awardName: awards.name,
      awardIcon: awards.icon,
      publicId: users.publicId,
      awardedAt: userAwards.awardedAt,
    })
    .from(userAwards)
    .innerJoin(awards, eq(userAwards.awardId, awards.id))
    .innerJoin(users, eq(userAwards.userId, users.discordId))
    .where(gt(userAwards.awardedAt, since))
    .orderBy(asc(userAwards.awardedAt));
}

export type NewSignup = {
  signupId: string;
  /** event_signups.user_id IS the discordId. */
  discordId: string;
  tournamentName: string;
  /** False → the confirmation DM nudges them to link their EA ID so stats attach. */
  eaLinked: boolean;
};

/** Signups that still need a confirmation DM (notified = false) on a
 *  non-completed tournament. A per-row flag — not a timestamp watermark — so a
 *  signup is DM'd exactly once ever, even across bot restarts. */
export async function getUnnotifiedSignups(): Promise<NewSignup[]> {
  return getDb()
    .select({
      signupId: eventSignups.id,
      discordId: eventSignups.userId,
      tournamentName: tournaments.name,
      eaLinked: sql<boolean>`(${users.eaName} is not null and length(trim(${users.eaName})) > 0)`,
    })
    .from(eventSignups)
    .innerJoin(tournaments, eq(eventSignups.tournamentId, tournaments.id))
    .innerJoin(users, eq(eventSignups.userId, users.discordId))
    .where(and(eq(eventSignups.notified, false), ne(tournaments.status, 'completed')))
    .orderBy(asc(eventSignups.signedUpAt));
}

/** Mark signups as DM'd — called right after the confirmations go out. */
export async function markSignupsNotified(signupIds: string[]): Promise<void> {
  if (signupIds.length === 0) return;
  await getDb()
    .update(eventSignups)
    .set({ notified: true })
    .where(inArray(eventSignups.id, signupIds));
}

export type DueReminder = {
  tournamentId: string;
  tournamentName: string;
  /** Kickoff time — used to render a live Discord timestamp so the DM shows the
   *  right "in N minutes" per reader even if it fires late. Non-null (the query
   *  filters start_time > now). */
  startTime: Date;
  discordIds: string[];
};

/** Tournaments whose kickoff is within the next 15 minutes and haven't sent
 *  their reminder yet — one "starts soon" DM to everyone signed up. The lower
 *  bound (start_time > now) means a reminder never fires for a Frontier that
 *  already kicked off (e.g. after a bot restart). */
export async function getDueReminders(): Promise<DueReminder[]> {
  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60_000);

  const due = await db
    .select({ id: tournaments.id, name: tournaments.name, startTime: tournaments.startTime })
    .from(tournaments)
    .where(and(
      eq(tournaments.reminderSent, false),
      ne(tournaments.status, 'completed'),
      gt(tournaments.startTime, now),
      lte(tournaments.startTime, soon),
    ));
  if (due.length === 0) return [];

  const out: DueReminder[] = [];
  for (const t of due) {
    const rows = await db
      .select({ userId: eventSignups.userId })
      .from(eventSignups)
      .where(eq(eventSignups.tournamentId, t.id));
    out.push({
      tournamentId: t.id,
      tournamentName: t.name,
      startTime: t.startTime!, // non-null: filtered by start_time > now above
      discordIds: [...new Set(rows.map(r => r.userId))],
    });
  }
  return out;
}

/** Flip a tournament's reminder flag so it only ever fires once. */
export async function markReminderSent(tournamentId: string): Promise<void> {
  await getDb()
    .update(tournaments)
    .set({ reminderSent: true })
    .where(eq(tournaments.id, tournamentId));
}

export type TeamMemberKey = {
  teamId: string;
  userId: string; // discordId
  teamName: string;
};

/** Full roster snapshot of every non-completed tournament. team_members has
 *  no timestamp column, so the bot diffs consecutive snapshots to spot new
 *  drafts (which also catches mid-tournament sub swaps). */
export async function getTeamMemberKeys(): Promise<TeamMemberKey[]> {
  return getDb()
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      teamName: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(tournaments, eq(teams.tournamentId, tournaments.id))
    .where(ne(tournaments.status, 'completed'));
}
