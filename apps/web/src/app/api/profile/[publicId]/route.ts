// Everything a profile surface needs in one round-trip — publicId in, safe
// fields out. Replaces the separate /api/history and /api/awards endpoints.
import {
  getRatingHistoryByPublicId,
  getRecentMatchesForPlayer,
  listAwardsForPlayer,
} from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { publicId: string } },
) {
  const [history, awards, matches] = await Promise.all([
    getRatingHistoryByPublicId(params.publicId),
    listAwardsForPlayer(params.publicId),
    getRecentMatchesForPlayer(params.publicId),
  ]);
  return Response.json({ history, awards, matches });
}
