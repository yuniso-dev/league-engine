import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminTournament } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import DraftBoard from '@/components/admin/DraftBoard';

export const dynamic = 'force-dynamic';

export default async function DraftPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const detail = await getAdminTournament(params.id);
  if (!detail) notFound();

  return (
    <>
      <Link
        href={`/admin/tournaments/${detail.tournament.id}`}
        style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}
      >
        ← {detail.tournament.name}
      </Link>

      <div style={{ margin: '10px 0 18px' }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          DRAFT BOARD
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Select a team, then click players in the pool to draft them onto it.
          ☆ marks a member as captain; ✕ sends them back to the pool.
        </p>
      </div>

      <DraftBoard tournamentId={detail.tournament.id} teams={detail.teams} />
    </>
  );
}
