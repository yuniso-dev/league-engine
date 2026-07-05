import {
  getCurrentSeason,
  getFrontierStatBoards,
  getRankings,
  getTournaments,
  getVoiceNow,
  resetDb,
  toPublicPlayer,
} from '@inazuma/db';
import type { FrontierStatBoards, PublicPlayer, PublicTournament, VoiceNowEntry } from '@inazuma/db';
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

const NO_BOARDS: FrontierStatBoards = {
  goals: [], assists: [], tackles: [], cleanSheets: [], motm: [], gamesWon: [],
};

// Before any match stats exist the all-time record boards are empty, so the
// layout can't be seen. Fill them with real players + sample numbers so the
// design is visible; the UI tags it "EXAMPLE" and it flips to real data the
// moment match stats are recorded.
function buildSampleBoards(players: PublicPlayer[]): FrontierStatBoards {
  const pool = players.slice(0, 10);
  // Rotate the order per column so a different name tops each, and give
  // descending sample values so it reads like a real leaderboard.
  const column = (rot: number, top: number) =>
    pool.map((_, i) => pool[(i + rot) % pool.length]).map((p, i) => ({
      publicId: p.publicId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      value: Math.max(1, top - i),
    }));
  return {
    goals: column(0, 14),
    assists: column(3, 11),
    tackles: column(5, 19),
    cleanSheets: column(6, 8),
    motm: column(8, 6),
    gamesWon: column(2, 12),
  };
}

export default async function HomePage() {
  // Budgets sit just under the DB's 15s statement_timeout: a cold serverless
  // start pays connection setup + several query waves, and giving up at 8s
  // was tripping the "reconnecting" banner on renders that would have made it.
  const [r, t, v, s, se, re, li] = await Promise.all([
    settle('rankings', getRankings(), 14_000),
    settle('tournaments', getTournaments(), 14_000),
    settle('voice', getVoiceNow(), 8000),
    settle('auth', auth(), 8000),
    settle('season', getCurrentSeason(), 8000),
    settle('allTimeStats', getFrontierStatBoards(null), 9000),
    // Season-scoped boards need the season number first — one chained trip.
    settle('liveStats', getCurrentSeason().then(sn => getFrontierStatBoards(sn)), 9000),
  ]);

  const rankings: PublicPlayer[] = r.ok ? r.value : [];
  const tournaments: PublicTournament[] = t.ok ? t.value : [];
  const voice: VoiceNowEntry[] = v.ok ? v.value : [];
  const session = s.ok ? s.value : null;
  const season = se.ok ? se.value : 1;
  const liveStats: FrontierStatBoards = li.ok ? li.value : NO_BOARDS;
  const realBoards: FrontierStatBoards = re.ok ? re.value : NO_BOARDS;
  const boardsEmpty = Object.values(realBoards).every(list => list.length === 0);
  const statsPreview = boardsEmpty && rankings.length > 0;
  const allTimeStats: FrontierStatBoards = statsPreview ? buildSampleBoards(rankings) : realBoards;
  // True only when core data failed/timed out — lets the UI say "reconnecting"
  // rather than misleadingly showing an empty league.
  const dataOffline = !r.ok || !t.ok;

  // Core queries timing out means this instance's pooled sockets are likely
  // dead (thawed lambda, pooler dropped them while frozen). Rebuild the pool
  // NOW so the banner's automatic 6s retry — and every other visitor hitting
  // this same warm instance — gets fresh connections instead of the wedge.
  if (dataOffline) resetDb();

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
      liveStats={liveStats}
      allTimeStats={allTimeStats}
      statsPreview={statsPreview}
      dataOffline={dataOffline}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      currentUser={currentUser}
    />
  );
}
