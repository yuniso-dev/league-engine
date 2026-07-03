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
function settle<T>(p: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ ok: false }), ms);
    p.then(
      value => { clearTimeout(timer); resolve({ ok: true, value }); },
      () => { clearTimeout(timer); resolve({ ok: false }); },
    );
  });
}

const NO_RECORDS: StatLeaderboards = { topScorers: [], topAssisters: [], topCleanSheets: [] };

export default async function HomePage() {
  const [r, t, v, s, se, re] = await Promise.all([
    settle(getRankings(), 8000),
    settle(getTournaments(), 8000),
    settle(getVoiceNow(), 4000),
    settle(auth(), 6000),
    settle(getCurrentSeason(), 4000),
    settle(getAllTimeStats(), 4000),
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
    const user = await settle(getCachedUserByDiscordId(session.user.discordId), 6000)
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
