import { getRankings, getTournaments, getUserByDiscordId, toPublicPlayer } from '@inazuma/db';
import type { PublicPlayer } from '@inazuma/db';
import { auth } from '@/auth';
import StormShell from '@/components/StormShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const [rankings, tournaments, session] = await Promise.all([
    getRankings(),
    getTournaments(),
    auth(),
  ]);

  let isLoggedIn = false;
  let currentUser: PublicPlayer | null = null;

  if (session?.user?.discordId) {
    isLoggedIn = true;
    const user = await getUserByDiscordId(session.user.discordId);
    if (user?.initialised) currentUser = toPublicPlayer(user);
  }

  return (
    <StormShell
      rankings={rankings}
      tournaments={tournaments}
      isLoggedIn={isLoggedIn}
      currentUser={currentUser}
    />
  );
}
