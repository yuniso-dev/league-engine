import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCeremonySheet } from '@inazuma/db';
import { parseEdition } from '@inazuma/core';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import CeremonyBoard from '@/components/admin/CeremonyBoard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // also covers the GRANT ALL action posted from this route

export default async function CeremonyPage({ params }: { params: { id: string } }) {
  const [, sheet] = await Promise.all([requireAdmin(), getCeremonySheet(params.id)]);
  if (!sheet) notFound();

  return (
    <>
      <Link
        href={`/admin/tournaments/${params.id}`}
        style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}
      >
        ← {sheet.tournament.name}
      </Link>
      <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: '10px 0 4px' }}>
        🏆 CEREMONY — {sheet.tournament.name}
      </h1>
      <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, margin: '0 0 20px' }}>
        Season {sheet.tournament.season} · stat winners computed from recorded results ·
        voted honours come from the Discord polls (/awardpoll).
      </p>
      <CeremonyBoard
        sheet={sheet}
        defaultNumeral={parseEdition(sheet.tournament.name)?.numeral ?? ''}
      />
    </>
  );
}
