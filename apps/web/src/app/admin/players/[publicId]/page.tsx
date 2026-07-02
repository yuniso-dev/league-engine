import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAdminPlayer,
  getCurrentSeason,
  listAdminTournaments,
  listAwardsForAdmin,
} from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';
import AdminPlayerProfileForm from '@/components/admin/AdminPlayerProfileForm';
import PlayerAwardGrantForm from '@/components/admin/PlayerAwardGrantForm';
import DeleteButton from '@/components/admin/DeleteButton';
import { revokeAwardAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 18,
  letterSpacing: 2,
  color: T.text,
  margin: '32px 0 14px',
};

export default async function AdminPlayerPage({ params }: { params: { publicId: string } }) {
  await requireAdmin();

  const [detail, awards, tournaments, season] = await Promise.all([
    getAdminPlayer(params.publicId),
    listAwardsForAdmin(),
    listAdminTournaments(),
    getCurrentSeason(),
  ]);
  if (!detail) notFound();

  const { player, awards: grants } = detail;

  return (
    <>
      <Link href="/admin/players" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← All players
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
            {player.displayName}
          </h1>
          <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, margin: '4px 0 0' }}>
            @{player.username}
            {' · '}
            {player.provisional ? 'Unranked (placements)' : player.rank != null ? `Rank #${player.rank}` : 'Unranked'}
            {' · '}
            {Math.round(player.elo)} ELO · {player.gamesPlayed} games
          </p>
        </div>
        <Link
          href={`/p/${player.publicId}`}
          style={{
            fontFamily: FONT_B,
            fontSize: 13,
            color: T.dim,
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 7,
            padding: '6px 14px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          View public profile ↗
        </Link>
      </div>

      <h2 style={sectionTitle}>PROFILE</h2>
      <AdminPlayerProfileForm player={player} />

      <h2 style={sectionTitle}>
        AWARDS
        <span style={{ color: T.faint, fontSize: 13, marginLeft: 10 }}>{grants.length}</span>
      </h2>
      {grants.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
          No awards yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {grants.map(g => (
            <div key={g.userAwardId} style={glass({
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 160 }}>
                <AwardBadgeIcon imageUrl={g.imageUrl} icon={g.icon} />
                {g.name}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}>
                {g.tournamentName && `${g.tournamentName} · `}
                {g.season && `Season ${g.season} · `}
                {g.awardedAt.toISOString().slice(0, 10)}
              </span>
              <DeleteButton
                action={revokeAwardAction}
                hidden={{ userAwardId: g.userAwardId, playerPublicId: player.publicId }}
                confirmText={`Revoke "${g.name}" from ${player.displayName}?`}
              />
            </div>
          ))}
        </div>
      )}

      <PlayerAwardGrantForm
        playerPublicId={player.publicId}
        awards={awards}
        tournaments={tournaments}
        defaultSeason={season}
      />
    </>
  );
}
