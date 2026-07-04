import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminTournament, getDraftPool } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import DraftBoard from '@/components/admin/DraftBoard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function DraftPage({ params }: { params: { id: string } }) {
  // Role gate + tournament + draft pool in one concurrent pass.
  const [, detail, pool] = await Promise.all([
    requireAdmin(),
    getAdminTournament(params.id),
    getDraftPool(),
  ]);
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
          Run <b style={{ color: T.text }}>/checkvc</b> in Discord to snapshot a voice
          channel into the pool — it grabs everyone in the call, signed up or not.
          Pick a team, then click a player to draft them onto it. ✕ disregards a
          player; use <b style={{ color: T.text }}>＋ Add player</b> to stage anyone by hand.
        </p>
      </div>

      <DraftBoard
        tournamentId={detail.tournament.id}
        teams={detail.teams}
        pool={pool}
      />
    </>
  );
}
