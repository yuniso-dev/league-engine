import { listPlayersDirectory } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import PlayerDirectory from '@/components/admin/PlayerDirectory';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function AdminPlayersPage() {
  // Role gate + data in one concurrent pass — no request waterfall.
  const [, players] = await Promise.all([requireAdmin(), listPlayersDirectory()]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          PLAYERS
          <span style={{ color: T.faint, fontSize: 15, marginLeft: 12, letterSpacing: 1 }}>
            {players.length}
          </span>
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Open a player to edit their profile, grant awards and set their title.
        </p>
      </div>

      <PlayerDirectory players={players} />
    </>
  );
}
