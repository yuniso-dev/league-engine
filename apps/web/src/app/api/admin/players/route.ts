// Player options for admin pickers — fetched once by the browser instead of
// being re-serialized into every admin page render. publicId only, no discordId.
import { listPlayersForAdmin } from '@inazuma/db';
import { auth } from '@/auth';
import { getCachedUserByDiscordId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Fetch the role check and the player list concurrently; the list is only
  // ever sent after the role check passes.
  const [user, players] = await Promise.all([
    getCachedUserByDiscordId(session.user.discordId),
    listPlayersForAdmin(),
  ]);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    // 404, not 403 — the back-office stays invisible to non-staff.
    return new Response('Not found', { status: 404 });
  }
  return Response.json(players);
}
