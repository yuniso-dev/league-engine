// Rating history for profile graphs — publicId in, safe points out.
import { getRatingHistoryByPublicId } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { publicId: string } },
) {
  const points = await getRatingHistoryByPublicId(params.publicId);
  return Response.json(points);
}
