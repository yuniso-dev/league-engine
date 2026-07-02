import Link from 'next/link';
import { listPlayersDirectory } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import PlayerDirectory from '@/components/admin/PlayerDirectory';

export const dynamic = 'force-dynamic';

export default async function AdminPlayersPage() {
  await requireAdmin();
  const players = await listPlayersDirectory();

  return (
    <>
      <Link href="/admin" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <div style={{ margin: '10px 0 20px' }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          PLAYERS
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Open a player to grant awards, set their title and edit their profile sections.
        </p>
      </div>

      <PlayerDirectory players={players} />
    </>
  );
}
