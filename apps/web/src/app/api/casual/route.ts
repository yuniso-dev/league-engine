// CASUAL realm bootstrap: the leaderboard, the linked-player picker list, and
// who "you" are (so history/performance preselect yourself). Fetched by the
// Casual tab when it's first opened — keeps the homepage payload untouched.
import {
  getCasualLeaderboard,
  getUserByDiscordId,
  listLinkedCasualPlayers,
  runResilient,
} from '@inazuma/db';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await auth();
    const [leaderboard, players, me] = await Promise.all([
      runResilient(() => getCasualLeaderboard()),
      runResilient(() => listLinkedCasualPlayers()),
      session?.user?.discordId
        ? runResilient(() => getUserByDiscordId(session.user.discordId!)).catch(() => null)
        : Promise.resolve(null),
    ]);

    return Response.json({
      leaderboard,
      players,
      me: me?.publicId ? { publicId: me.publicId, eaName: me.eaName ?? null } : null,
    });
  } catch (e) {
    console.error('[api/casual] failed:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Casual data is unavailable right now.' }, { status: 503 });
  }
}
