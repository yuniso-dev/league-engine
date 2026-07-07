import { asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, trackedClubs } from '../schema';

// Tracked EA clubs: admins register club IDs (web /admin/clubs, or /trackclub
// by name in Discord); the BOT refreshes snapshots from the EA API round-robin
// and writes them here in a normalized shape the site can render directly.
// EA's raw payloads never cross this boundary — if EA renames a field, only
// the bot's parser changes.

/** Basic identity from clubs/info. teamId picks the in-game crest artwork. */
export type TrackedClubInfo = {
  name: string;
  teamId: string | null;
  crestAssetId: string | null;
};

/** Career club stats from clubs/overallStats. */
export type TrackedClubOverall = {
  wins: number;
  ties: number;
  losses: number;
  gamesPlayed: number;
  goals: number;
  goalsAgainst: number;
  skillRating: number | null;
  bestDivision: number | null;
  currentDivision: number | null;
  bestFinishGroup: number | null;
  promotions: number;
  relegations: number;
  playoffGames: number;
  winStreak: number;
  unbeatenStreak: number;
  leagueAppearances: number | null;
  reputationTier: number | null;
  titlesWon: number | null;
};

/** One squad member's career line from members/stats. */
export type TrackedClubMember = {
  name: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  avgRating: number | null;
  motm: number;
  winRate: number | null;
  passSuccessRate: number | null;
  tackles: number;
  /** EA position bucket: 'forward' | 'midfielder' | 'defender' | 'goalkeeper'. */
  favoritePosition: string | null;
  proOverall: number | null;
  proHeightCm: number | null;
};

/** One recent game (league/playoff) with its stand-out players. */
export type TrackedClubMatch = {
  matchId: string;
  matchType: 'league' | 'playoff';
  playedAt: string; // ISO — jsonb round-trips strings, not Dates
  ourGoals: number;
  oppGoals: number;
  result: 'win' | 'loss' | 'draw';
  opponentName: string | null;
  performers: { name: string; rating: number; goals: number; assists: number }[];
};

export type TrackedClub = {
  clubId: string;
  name: string | null;
  addedAt: Date;
  info: TrackedClubInfo | null;
  overall: TrackedClubOverall | null;
  members: TrackedClubMember[] | null;
  recentMatches: TrackedClubMatch[] | null;
  fetchedAt: Date | null;
  fetchError: string | null;
};

function toClub(r: typeof trackedClubs.$inferSelect): TrackedClub {
  return {
    clubId: r.clubId,
    name: r.name,
    addedAt: r.addedAt,
    info: (r.info as TrackedClubInfo | null) ?? null,
    overall: (r.overall as TrackedClubOverall | null) ?? null,
    members: (r.members as TrackedClubMember[] | null) ?? null,
    recentMatches: (r.recentMatches as TrackedClubMatch[] | null) ?? null,
    fetchedAt: r.fetchedAt,
    fetchError: r.fetchError,
  };
}

/** Register clubs by EA ID. Existing entries are left untouched. Returns how many were new. */
export async function addTrackedClubs(adminId: string, clubIds: string[]): Promise<number> {
  const ids = [...new Set(clubIds.map(id => id.trim()).filter(id => /^\d{1,12}$/.test(id)))];
  if (ids.length === 0) return 0;
  const db = getDb();
  const inserted = await db
    .insert(trackedClubs)
    .values(ids.map(clubId => ({ clubId, addedBy: adminId })))
    .onConflictDoNothing()
    .returning({ clubId: trackedClubs.clubId });

  if (inserted.length > 0) {
    await db.insert(adminActions).values({
      adminId,
      action: 'clubs.track',
      details: { clubIds: inserted.map(i => i.clubId) },
    });
  }
  return inserted.length;
}

export async function removeTrackedClub(adminId: string, clubId: string): Promise<void> {
  const db = getDb();
  await db.delete(trackedClubs).where(eq(trackedClubs.clubId, clubId));
  await db.insert(adminActions).values({ adminId, action: 'clubs.untrack', details: { clubId } });
}

/** Everything, oldest-registered first — admin page and the public grid. */
export async function listTrackedClubs(): Promise<TrackedClub[]> {
  const rows = await getDb().select().from(trackedClubs).orderBy(asc(trackedClubs.addedAt));
  return rows.map(toClub);
}

export async function getTrackedClub(clubId: string): Promise<TrackedClub | null> {
  const [row] = await getDb().select().from(trackedClubs).where(eq(trackedClubs.clubId, clubId)).limit(1);
  return row ? toClub(row) : null;
}

/** The bot's work queue: ids + last-sync stamps only. */
export async function listTrackedClubIds(): Promise<{ clubId: string; fetchedAt: Date | null }[]> {
  return getDb()
    .select({ clubId: trackedClubs.clubId, fetchedAt: trackedClubs.fetchedAt })
    .from(trackedClubs);
}

/** Bot write-back after a sync pass. Only the sections that were fetched
 *  successfully are overwritten — a failed members call keeps the old squad. */
export async function updateTrackedClubSnapshot(
  clubId: string,
  data: {
    name?: string;
    info?: TrackedClubInfo;
    overall?: TrackedClubOverall;
    members?: TrackedClubMember[];
    recentMatches?: TrackedClubMatch[];
    fetchedAt: Date;
    fetchError: string | null;
  },
): Promise<void> {
  await getDb()
    .update(trackedClubs)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.info !== undefined && { info: data.info }),
      ...(data.overall !== undefined && { overall: data.overall }),
      ...(data.members !== undefined && { members: data.members }),
      ...(data.recentMatches !== undefined && { recentMatches: data.recentMatches }),
      fetchedAt: data.fetchedAt,
      fetchError: data.fetchError,
    })
    .where(eq(trackedClubs.clubId, clubId));
}

/** Record a total failure without clobbering the last good snapshot. */
export async function markTrackedClubError(clubId: string, error: string): Promise<void> {
  await getDb()
    .update(trackedClubs)
    .set({ fetchError: error.slice(0, 300) })
    .where(eq(trackedClubs.clubId, clubId));
}

/** Guard for /trackclub double-adds and admin-page feedback. */
export async function areClubsTracked(clubIds: string[]): Promise<Set<string>> {
  if (clubIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ clubId: trackedClubs.clubId })
    .from(trackedClubs)
    .where(inArray(trackedClubs.clubId, clubIds));
  return new Set(rows.map(r => r.clubId));
}
