// Public JSON endpoint — for external use / API consumers.
// The Rankings page itself uses client-side filtering on the prop data (no fetch needed).
import { searchRankings } from '@inazuma/db';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const players = await searchRankings(q);
  return Response.json(players);
}
