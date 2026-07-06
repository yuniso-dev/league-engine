// Everything a profile surface needs in one round-trip — publicId in, safe
// fields out. Replaces the separate /api/history and /api/awards endpoints.
// Optional ?vs=<viewerPublicId> adds the head-to-head between the viewer and
// this player (only when they differ).
import {
  getHeadToHead,
  getPlayerMilestones,
  getRatingHistoryByPublicId,
  getRecentMatchesForPlayer,
  listAwardsForPlayer,
  runResilient,
} from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: { publicId: string } },
) {
  const vs = new URL(req.url).searchParams.get('vs');
  const wantH2H = vs != null && vs !== '' && vs !== params.publicId;

  const [history, awards, matches, milestones, headToHead] = await Promise.all([
    getRatingHistoryByPublicId(params.publicId),
    listAwardsForPlayer(params.publicId),
    getRecentMatchesForPlayer(params.publicId),
    getPlayerMilestones(params.publicId),
    // Non-essential — never let it fail the whole profile payload.
    wantH2H
      ? runResilient(() => getHeadToHead(vs!, params.publicId)).catch(() => null)
      : Promise.resolve(null),
  ]);
  return Response.json({ history, awards, matches, milestones, headToHead });
}
