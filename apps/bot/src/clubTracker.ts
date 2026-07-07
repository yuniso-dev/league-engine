import {
  getConfig,
  listTrackedClubIds,
  markTrackedClubError,
  updateTrackedClubSnapshot,
  type TrackedClubMatch,
  type TrackedClubMember,
  type TrackedClubOverall,
} from '@inazuma/db';
import {
  eaNum,
  fetchClubMatches,
  fetchClubMembers,
  fetchClubOverall,
  fetchClubsInfo,
  type EaRawMatch,
} from './eaClient.js';

// Club tracker: keeps snapshots of every tracked community club fresh.
// Round-robin — a few of the stalest clubs per pass — so 30+ clubs stay under
// ~25 minutes old while EA sees a trickle of requests, never a burst. Each
// section (info/overall/members/matches) is fetched independently: one failed
// endpoint degrades that section only, and the last good data is kept.

const CLUB_REFRESH_MS = 20 * 60_000; // a club is "due" after 20 min
const BATCH_PER_PASS = 3;            // ≈15 EA requests per 2-min pass, worst case

const optNum = (v: unknown): number | null => (v == null ? null : eaNum(v as string | number));

function normalizeOverall(raw: Record<string, unknown>): TrackedClubOverall {
  return {
    wins: eaNum(raw.wins as string | number),
    ties: eaNum(raw.ties as string | number),
    losses: eaNum(raw.losses as string | number),
    gamesPlayed: eaNum(raw.gamesPlayed as string | number),
    goals: eaNum(raw.goals as string | number),
    goalsAgainst: eaNum(raw.goalsAgainst as string | number),
    skillRating: optNum(raw.skillRating),
    bestDivision: optNum(raw.bestDivision),
    currentDivision: optNum(raw.currentDivision),
    bestFinishGroup: optNum(raw.bestFinishGroup),
    promotions: eaNum(raw.promotions as string | number),
    relegations: eaNum(raw.relegations as string | number),
    playoffGames: eaNum(raw.gamesPlayedPlayoff as string | number),
    winStreak: eaNum(raw.wstreak as string | number),
    unbeatenStreak: eaNum(raw.unbeatenstreak as string | number),
    leagueAppearances: optNum(raw.leagueAppearances),
    reputationTier: optNum(raw.reputationtier),
    titlesWon: optNum(raw.titlesWon),
  };
}

function normalizeMember(raw: Record<string, unknown>): TrackedClubMember | null {
  const name = raw.name != null ? String(raw.name).trim() : '';
  if (!name) return null;
  return {
    name,
    gamesPlayed: eaNum(raw.gamesPlayed as string | number),
    goals: eaNum(raw.goals as string | number),
    assists: eaNum(raw.assists as string | number),
    cleanSheets: eaNum(raw.cleanSheetsDef as string | number) + eaNum(raw.cleanSheetsGK as string | number),
    avgRating: optNum(raw.ratingAve),
    motm: eaNum(raw.manOfTheMatch as string | number),
    winRate: optNum(raw.winRate),
    passSuccessRate: optNum(raw.passSuccessRate),
    tackles: eaNum(raw.tacklesMade as string | number),
    favoritePosition: raw.favoritePosition != null ? String(raw.favoritePosition).toLowerCase() : null,
    proOverall: optNum(raw.proOverall),
    proHeightCm: optNum(raw.proHeight),
  };
}

function normalizeMatches(
  clubId: string,
  league: EaRawMatch[],
  playoff: EaRawMatch[],
): TrackedClubMatch[] {
  const one = (m: EaRawMatch, matchType: 'league' | 'playoff'): TrackedClubMatch | null => {
    const ours = m.clubs[clubId];
    if (!ours) return null;
    const oppId = Object.keys(m.clubs).find(id => id !== clubId) ?? null;
    const opp = oppId ? m.clubs[oppId] : undefined;
    const ourGoals = eaNum(ours.goals);
    const oppGoals = eaNum(ours.goalsAgainst ?? opp?.goals);
    const performers = Object.values(m.players?.[clubId] ?? {})
      .map(p => ({
        name: p.playername != null ? String(p.playername) : '?',
        rating: eaNum(p.rating),
        goals: eaNum(p.goals),
        assists: eaNum(p.assists),
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    return {
      matchId: String(m.matchId),
      matchType,
      playedAt: new Date(eaNum(m.timestamp) * 1000).toISOString(),
      ourGoals,
      oppGoals,
      result: ourGoals > oppGoals ? 'win' : ourGoals < oppGoals ? 'loss' : 'draw',
      opponentName: opp?.details?.name ?? opp?.name ?? null,
      performers,
    };
  };

  return [
    ...league.map(m => one(m, 'league')),
    ...playoff.map(m => one(m, 'playoff')),
  ]
    .filter((m): m is TrackedClubMatch => m !== null)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, 10);
}

/** Full refresh of one club — every section fetched in parallel, failures
 *  degrade to "keep the old data for that section". */
export async function refreshTrackedClub(
  clubId: string,
  platform: string,
): Promise<{ ok: boolean; name: string | null; failed: string[] }> {
  const [info, overall, members, league, playoff] = await Promise.allSettled([
    fetchClubsInfo([clubId], platform),
    fetchClubOverall(clubId, platform),
    fetchClubMembers(clubId, platform),
    fetchClubMatches(clubId, platform, 'leagueMatch'),
    fetchClubMatches(clubId, platform, 'playoffMatch'),
  ]);

  const failed: string[] = [];
  const update: Parameters<typeof updateTrackedClubSnapshot>[1] = {
    fetchedAt: new Date(),
    fetchError: null,
  };

  let name: string | null = null;
  if (info.status === 'fulfilled' && info.value.has(clubId)) {
    const i = info.value.get(clubId)!;
    name = i.name;
    update.name = i.name;
    update.info = { name: i.name, teamId: i.teamId, crestAssetId: i.crestAssetId };
  } else {
    failed.push('info');
  }

  if (overall.status === 'fulfilled' && overall.value !== null) {
    update.overall = normalizeOverall(overall.value);
  } else {
    failed.push('overall');
  }

  if (members.status === 'fulfilled') {
    update.members = members.value
      .map(normalizeMember)
      .filter((m): m is TrackedClubMember => m !== null)
      .sort((a, b) => (b.proOverall ?? 0) - (a.proOverall ?? 0));
  } else {
    failed.push('members');
  }

  // Matches: only write when at least one type answered — merging a real
  // league list with a failed playoff fetch is still better than stale both.
  if (league.status === 'fulfilled' || playoff.status === 'fulfilled') {
    update.recentMatches = normalizeMatches(
      clubId,
      league.status === 'fulfilled' ? league.value : [],
      playoff.status === 'fulfilled' ? playoff.value : [],
    );
  } else {
    failed.push('matches');
  }

  if (failed.length >= 4) {
    // Nothing came back at all — record the outage, keep the old snapshot AND
    // the old fetched_at so this club stays first in the round-robin queue.
    const reason = [info, overall, members, league, playoff]
      .find((r): r is PromiseRejectedResult => r.status === 'rejected')
      ?.reason;
    await markTrackedClubError(clubId, reason instanceof Error ? reason.message : 'EA unreachable');
    return { ok: false, name: null, failed };
  }

  update.fetchError = failed.length > 0 ? `partial: ${failed.join(', ')} failed` : null;
  await updateTrackedClubSnapshot(clubId, update);
  return { ok: true, name, failed };
}

/** 2-min tick: refresh the stalest few clubs that are due. */
export async function pollClubTracker(): Promise<void> {
  const clubs = await listTrackedClubIds();
  if (clubs.length === 0) return;

  const now = Date.now();
  const due = clubs
    .filter(c => c.fetchedAt === null || now - c.fetchedAt.getTime() > CLUB_REFRESH_MS)
    .sort((a, b) => (a.fetchedAt?.getTime() ?? 0) - (b.fetchedAt?.getTime() ?? 0))
    .slice(0, BATCH_PER_PASS);
  if (due.length === 0) return;

  const platform = (await getConfig()).eaPlatform || 'common-gen5';
  for (const club of due) {
    const r = await refreshTrackedClub(club.clubId, platform);
    if (r.ok) {
      console.log(
        `[clubs] refreshed ${r.name ?? club.clubId}` +
        (r.failed.length > 0 ? ` (partial — ${r.failed.join(', ')} failed)` : ''),
      );
    } else {
      console.warn(`[clubs] refresh failed for ${club.clubId} — EA unreachable`);
    }
  }
}
