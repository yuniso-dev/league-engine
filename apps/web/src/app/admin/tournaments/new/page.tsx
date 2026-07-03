import { getCurrentSeason } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import TournamentForm from '@/components/admin/TournamentForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function NewTournamentPage() {
  // Role gate + season in one concurrent pass — no request waterfall.
  const [, season] = await Promise.all([requireAdmin(), getCurrentSeason()]);

  return <TournamentForm mode="create" defaultSeason={season} />;
}
