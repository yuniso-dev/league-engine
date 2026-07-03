import {
  getAllTimeStats,
  getCurrentSeason,
  getRankings,
  getTournaments,
  getVoiceNow,
  toPublicPlayer,
} from '@inazuma/db';
import type { PublicPlayer, PublicTournament, StatLeaderboards, VoiceNowEntry } from '@inazuma/db';
import { auth } from '@/auth';
import { getCachedUserByDiscordId } from '@/lib/user';
import StormShell from '@/components/StormShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Headroom over the DB's 15s statement_timeout so a query can fail cleanly.
export const maxDuration = 30;

// Resolve a promise, but never wait longer than `ms`. On timeout OR rejection
// we report ok:false instead of hanging — so an unreachable / paused / pooled-
// out database can never wedge the homepage on the loading spinner forever.
// It renders (with an "offline" banner) within `ms` no matter what.
// Failures are logged with the query's name so the Vercel function logs say
// exactly WHICH query struggled, not just that "something" did.
function settle<T>(
  name: string,
  p: Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      console.error(`[home] ${name} timed out after ${ms}ms`);
      resolve({ ok: false });
    }, ms);
    p.then(
      value => { clearTimeout(timer); resolve({ ok: true, value }); },
      err => {
        clearTimeout(timer);
        console.error(`[home] ${name} failed:`, err instanceof Error ? err.message : err);
        resolve({ ok: false });
      },
    );
  });
}

const NO_RECORDS: StatLeaderboards = { topScorers: [], topAssisters: [], topCleanSheets: [] };

export default async function HomePage() {
  // Budgets sit just under the DB's 15s statement_timeout: a cold serverless
  // start pays connection setup + several query waves, and giving up at 8s
  // was tripping the "reconnecting" banner on renders that would have made it.
  const [r, t, v, s, se, re] = await Promise.all([
    settle('rankings', getRankings(), 14_000),
    settle('tournaments', getTournaments(), 14_000),
    settle('voice', getVoiceNow(), 8000),
    settle('auth', auth(), 8000),
    settle('season', getCurrentSeason(), 8000),
    settle('records', getAllTimeStats(), 8000),
  ]);

  const rankings: PublicPlayer[] = r.ok ? r.value : [];
  const tournaments: PublicTournament[] = t.ok ? t.value : [];
  const voice: VoiceNowEntry[] = v.ok ? v.value : [];
  const session = s.ok ? s.value : null;
  const season = se.ok ? se.value : 1;
  const records: StatLeaderboards = re.ok ? re.value : NO_RECORDS;
  // True only when core data failed/timed out — lets the UI say "reconnecting"
  // rather than misleadingly showing an empty league.
  const dataOffline = !r.ok || !t.ok;

  let isLoggedIn = false;
  let isAdmin = false;
  let currentUser: PublicPlayer | null = null;

  if (session?.user?.discordId) {
    isLoggedIn = true;
    const user = await settle('viewer', getCachedUserByDiscordId(session.user.discordId), 8000)
      .then(res => (res.ok ? res.value : null));
    // Only the viewer's own staff flag — never another user's role.
    isAdmin = user?.role === 'owner' || user?.role === 'admin';
    if (user?.initialised) currentUser = toPublicPlayer(user);
  }

  return (
    <StormShell
      rankings={rankings}
      tournaments={tournaments}
      voice={voice}
      season={season}
      records={records}
      dataOffline={dataOffline}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      currentUser={currentUser}
    />
  );
}
