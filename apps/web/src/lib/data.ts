import { unstable_cache } from 'next/cache';
import { getRankings, getTournaments } from '@inazuma/db';

// Tag-cached reads for the public home page. The page itself stays dynamic
// (it calls auth()), but the ladder and tournament list only change when a
// mutation revalidates their tag — or every 5 minutes as a safety net.
//
// Tag map:
//   'rankings'    → commitRevealAction, saveSettings, initialise, admin player-profile edits
//   'tournaments' → tournament create/update/delete/status actions

export const getCachedRankings = unstable_cache(
  () => getRankings(),
  ['rankings'],
  { tags: ['rankings'], revalidate: 300 },
);

export const getCachedTournaments = unstable_cache(
  () => getTournaments(),
  ['tournaments'],
  { tags: ['tournaments'], revalidate: 300 },
);
