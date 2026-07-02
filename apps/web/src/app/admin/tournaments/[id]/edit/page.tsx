import { notFound } from 'next/navigation';
import { getTournamentById } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import TournamentForm from '@/components/admin/TournamentForm';

export const dynamic = 'force-dynamic';

export default async function EditTournamentPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const tournament = await getTournamentById(params.id);
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
