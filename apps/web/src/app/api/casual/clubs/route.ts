// CASUAL → CLUBS grid: every tracked community club as a light card. Reads
// only the bot-maintained snapshots — never EA — so it's fast and outage-proof.
import { listTrackedClubs, runResilient } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export type TrackedClubCard = {
  clubId: string;
  name: string | null;
  teamId: string | null;
  crestAssetId: string | null;
  wins: number | null;
  ties: number | null;
  losses: number | null;
  skillRating: number | null;
  bestDivision: number | null;
  squadSize: number | null;
  goalsPerMatch: number | null;
  againstPerMatch: number | null;
  fetchedAt: string | null;
};

export async function GET() {
  try {
    const clubs = await runResilient(() => listTrackedClubs());
    const cards: TrackedClubCard[] = clubs.map(c => {
      const o = c.overall;
      const gp = o && o.gamesPlayed > 0 ? o.gamesPlayed : null;
      return {
        clubId: c.clubId,
        name: c.name,
        teamId: c.info?.teamId ?? null,
        crestAssetId: c.info?.crestAssetId ?? null,
        wins: o?.wins ?? null,
        ties: o?.ties ?? null,
        losses: o?.losses ?? null,
        skillRating: o?.skillRating ?? null,
        bestDivision: o?.bestDivision ?? null,
        squadSize: c.members?.length ?? null,
        goalsPerMatch: o && gp ? Math.round((o.goals / gp) * 100) / 100 : null,
        againstPerMatch: o && gp ? Math.round((o.goalsAgainst / gp) * 100) / 100 : null,
        fetchedAt: c.fetchedAt?.toISOString() ?? null,
      };
    });
    return Response.json({ clubs: cards });
  } catch (e) {
    console.error('[api/casual/clubs] failed:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Club data is unavailable right now.' }, { status: 503 });
  }
}
