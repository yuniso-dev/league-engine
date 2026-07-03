import { notFound } from 'next/navigation';
import { getTournamentById } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import TournamentForm from '@/components/admin/TournamentForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function EditTournamentPage({ params }: { params: { id: string } }) {
  // Role gate + tournament in one concurrent pass — no request waterfall.
  const [, tournament] = await Promise.all([requireAdmin(), getTournamentById(params.id)]);
  if (!tournament) notFound();

  return (
    <TournamentForm
      mode="edit"
      tournament={{
        id: tournament.id,
        name: tournament.name,
        season: tournament.season,
        ranked: tournament.ranked,
        date: tournament.startDate,
      }}
    />
  );
}
