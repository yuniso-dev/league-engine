// Awards for profile display — publicId in, safe fields out.
import { listAwardsForPlayer } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { publicId: string } },
) {
  const awards = await listAwardsForPlayer(params.publicId);
  return Response.json(awards);
}
