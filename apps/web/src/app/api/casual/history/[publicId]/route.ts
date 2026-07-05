// Per-player casual data: career aggregates + recent match history.
// Public-safe — keyed by publicId, joined via the player's linked EA name.
import { getCasualCareer, getCasualHistory, runResilient } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: { publicId: string } },
) {
  try {
    const [career, matches] = await Promise.all([
      runResilient(() => getCasualCareer(params.publicId)),
      runResilient(() => getCasualHistory(params.publicId)),
    ]);
    return Response.json({ career, matches });
  } catch (e) {
    console.error('[api/casual/history] failed:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Casual data is unavailable right now.' }, { status: 503 });
  }
}
