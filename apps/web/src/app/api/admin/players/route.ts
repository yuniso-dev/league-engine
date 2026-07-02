// Player options for admin pickers — fetched once by the browser instead of
// being re-serialized into every admin page render. publicId only, no discordId.
import { listPlayersForAdmin } from '@inazuma/db';
import { auth } from '@/auth';
import { getCachedUserByDiscordId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return new Response('Unauthorized', { status: 401 });
  }
  const user = await getCachedUserByDiscordId(session.user.discordId);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    // 404, not 403 — the back-office stays invisible to non-staff.
    return new Response('Not found', { status: 404 });
  }
  return Response.json(await listPlayersForAdmin());
}
