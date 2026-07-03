import { getRankings, getTournaments, getVoiceNow, toPublicPlayer } from '@inazuma/db';
import type { PublicPlayer } from '@inazuma/db';
import { auth } from '@/auth';
import { getCachedUserByDiscordId } from '@/lib/user';
import StormShell from '@/components/StormShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Give the serverless function more budget than the DB's 15s statement_timeout.
// Otherwise a cold/slow DB round-trip is killed mid-stream at Vercel's ~10s
// default, truncating the RSC stream and leaving the client stuck on the
// loading.tsx spinner forever. With headroom the query either completes or
// fails cleanly into error.tsx — never an eternal spinner.
export const maxDuration = 30;

export default async function HomePage() {
  const [rankings, tournaments, voice, session] = await Promise.all([
    getRankings(),
    getTournaments(),
    // Tolerate the voice_presence table not existing yet (migration 0004).
    getVoiceNow().catch(() => []),
    auth(),
  ]);

  let isLoggedIn = false;
  let isAdmin = false;
  let currentUser: PublicPlayer | null = null;

  if (session?.user?.discordId) {
    isLoggedIn = true;
    const user = await getCachedUserByDiscordId(session.user.discordId);
    // Only the viewer's own staff flag — never another user's role.
    isAdmin = user?.role === 'owner' || user?.role === 'admin';
    if (user?.initialised) currentUser = toPublicPlayer(user);
  }

  return (
    <StormShell
      rankings={rankings}
      tournaments={tournaments}
      voice={voice}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      currentUser={currentUser}
    />
  );
}
