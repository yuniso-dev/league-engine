import { getCurrentSeason } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import TournamentForm from '@/components/admin/TournamentForm';

export const dynamic = 'force-dynamic';

export default async function NewTournamentPage() {
  await requireAdmin();
  const season = await getCurrentSeason();

  return <TournamentForm mode="create" defaultSeason={season} />;
}
