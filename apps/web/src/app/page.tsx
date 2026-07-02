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
  let isAdmin = false;
  let currentUser: PublicPlayer | null = null;

  if (session?.user?.discordId) {
    isLoggedIn = true;
    const user = await getUserByDiscordId(session.user.discordId);
    // Only the viewer's own staff flag — never another user's role.
    isAdmin = user?.role === 'owner' || user?.role === 'admin';
    if (user?.initialised) currentUser = toPublicPlayer(user);
  }

  return (
    <StormShell
      rankings={rankings}
      tournaments={tournaments}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      currentUser={currentUser}
    />
  );
}
