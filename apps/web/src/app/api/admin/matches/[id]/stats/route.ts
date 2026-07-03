// Participants + current goals/assists/clean-sheet for one match — fetched
// on demand when an admin expands a match's stats editor.
import { getMatchStatsEntries } from '@inazuma/db';
import { auth } from '@/auth';
import { getCachedUserByDiscordId } from '@/lib/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return new Response('Unauthorized', { status: 401 });
  }
  const [user, sheet] = await Promise.all([
    getCachedUserByDiscordId(session.user.discordId),
    getMatchStatsEntries(params.id),
  ]);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    // 404, not 403 — the back-office stays invisible to non-staff.
    return new Response('Not found', { status: 404 });
  }
  if (!sheet) return new Response('Not found', { status: 404 });
  return Response.json(sheet);
}
