import { unstable_cache, revalidateTag } from 'next/cache';
import {
  getCasualLeaderboard,
  getConfig,
  getFrontierStatBoards,
  getRankings,
  getTournaments,
  listLinkedCasualPlayers,
} from '@inazuma/db';

// Short-lived caching for the PUBLIC read surfaces. Every page used to be
// force-dynamic, so each click re-ran the full query wave against Supabase in
// London — that's the loading everyone felt. These wrappers serve the shared,
// non-personalised data from Next's data cache (≤60s old), so repeat visits
// render instantly instead of waiting on a round trip. Per-user data (auth,
// "who am I", live voice presence) is deliberately NOT cached.
//
// Freshness: admin edits call revalidatePublicData() (below) to flush the tag
// immediately, so only background changes (the bot's EA auto-ingest) can be up
// to 60s behind — everything an admin does shows at once.

const TAG = 'public-data';
const opts = { revalidate: 60, tags: [TAG] };

/** The season ladder (rankings realm + home). */
export const cachedRankings = unstable_cache(() => getRankings(), ['public:rankings'], opts);

/** The tournaments list (Frontier realm + home). */
export const cachedTournaments = unstable_cache(() => getTournaments(), ['public:tournaments'], opts);

/** All-time record boards (season = null). */
export const cachedAllTimeBoards = unstable_cache(() => getFrontierStatBoards(null), ['public:boards:all'], opts);

/** Season-scoped stat boards, keyed by season number. */
export const cachedSeasonBoards = unstable_cache(
  (season: number) => getFrontierStatBoards(season),
  ['public:boards:season'],
  opts,
);

/** Just the primitives the public pages need off the config row (avoids
 *  caching Date fields, and never exposes admin-only settings to the cache). */
export const cachedSeasonInfo = unstable_cache(
  async () => {
    const c = await getConfig();
    return { currentSeason: c.currentSeason, placementGames: c.placementGames };
  },
  ['public:season-info'],
  opts,
);

/** CASUAL realm bootstrap — the shared leaderboard + linked-player picker. */
export const cachedCasualLeaderboard = unstable_cache(() => getCasualLeaderboard(), ['public:casual:leaderboard'], opts);
export const cachedCasualPlayers = unstable_cache(() => listLinkedCasualPlayers(), ['public:casual:players'], opts);

/** Flush every public cache at once. Call from admin write actions so an edit
 *  shows immediately rather than waiting out the 60s window. Coarse on purpose:
 *  edits are infrequent and the next read simply repopulates. Server-action /
 *  route-handler context only. */
export function revalidatePublicData(): void {
  revalidateTag(TAG);
}
