import { asc, eq, gt, ne, and } from 'drizzle-orm';
import { getDb } from '../client';
import { awards, eventSignups, teamMembers, teams, tournaments, userAwards, users } from '../schema';

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
  /** event_signups.user_id IS the discordId. */
  discordId: string;
  tournamentName: string;
  signedUpAt: Date;
};

/** Signups after `since` on any non-completed tournament, oldest first. */
export async function getNewSignups(since: Date): Promise<NewSignup[]> {
  return getDb()
    .select({
      discordId: eventSignups.userId,
      tournamentName: tournaments.name,
      signedUpAt: eventSignups.signedUpAt,
    })
    .from(eventSignups)
    .innerJoin(tournaments, eq(eventSignups.tournamentId, tournaments.id))
    .where(and(gt(eventSignups.signedUpAt, since), ne(tournaments.status, 'completed')))
    .orderBy(asc(eventSignups.signedUpAt));
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
