import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SANCTION_LABELS,
  getAdminPlayer,
  getCurrentSeason,
  listAdminTournaments,
  listAwardsForAdmin,
  listSanctionsForPlayer,
} from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';
import { Avatar } from '@/components/ui/Avatar';
import { FlagIcon } from '@/components/ui/FlagIcon';
import AdminPlayerProfileForm from '@/components/admin/AdminPlayerProfileForm';
import AdminPlayerIdentityForm from '@/components/admin/AdminPlayerIdentityForm';
import PlayerEloForm from '@/components/admin/PlayerEloForm';
import PlayerAwardGrantForm from '@/components/admin/PlayerAwardGrantForm';
import SanctionForm from '@/components/admin/SanctionForm';
import DeleteButton from '@/components/admin/DeleteButton';
import { liftSanctionAction, revokeAwardAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 18,
  letterSpacing: 2,
  color: T.text,
  margin: '32px 0 14px',
};

const chip: React.CSSProperties = {
  fontFamily: FONT_M,
  fontSize: 11,
  color: T.dim,
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 6,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
};

export default async function AdminPlayerPage({ params }: { params: { publicId: string } }) {
  // Role gate + all page data in one concurrent pass — no request waterfall.
  const [, detail, awards, tournaments, season, sanctions] = await Promise.all([
    requireAdmin(),
    getAdminPlayer(params.publicId),
    listAwardsForAdmin(),
    listAdminTournaments(),
    getCurrentSeason(),
    listSanctionsForPlayer(params.publicId),
  ]);
  if (!detail) notFound();

  const { player, awards: grants } = detail;
  const activeBans = sanctions.filter(s => s.active);

  return (
    <>
      <Link href="/admin/players" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← All players
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar
            initials={player.displayName.slice(0, 2).toUpperCase()}
            src={player.avatarUrl}
            size={52}
            ring={player.accentColor}
          />
          <div>
            <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
              <FlagIcon code={player.country} size={22} style={{ marginRight: 8 }} />
              {player.displayName}
            </h1>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={chip}>@{player.username}</span>
              <span style={chip}>
                {player.provisional ? 'PLACEMENTS' : player.rank != null ? `RANK #${player.rank}` : 'UNRANKED'}
              </span>
              <span style={chip}>{Math.round(player.elo)} ELO</span>
              <span style={chip}>{player.gamesPlayed} GAMES</span>
              {player.position1 && (
                <span style={chip}>{player.position1}{player.position2 ? `/${player.position2}` : ''}</span>
              )}
            </div>
          </div>
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

      <h2 style={sectionTitle}>ELO</h2>
      <PlayerEloForm publicId={player.publicId} elo={player.elo} gamesPlayed={player.gamesPlayed} />

      <h2 style={sectionTitle}>PROFILE</h2>
      <AdminPlayerProfileForm player={player} />

      <h2 style={sectionTitle}>IDENTITY</h2>
      <AdminPlayerIdentityForm player={player} />

      <h2 style={sectionTitle}>
        SUSPENSIONS
        {activeBans.length > 0 && (
          <span style={{ color: T.loss, fontSize: 13, marginLeft: 10 }}>
            🚫 SUSPENDED — {activeBans[0].frontiersRemaining} FRONTIER{activeBans[0].frontiersRemaining === 1 ? '' : 'S'} LEFT
          </span>
        )}
      </h2>
      {sanctions.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
          Clean record — no sanctions.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {sanctions.map(s => (
            <div
              key={s.id}
              style={glass({
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                ...(s.active ? { border: '1px solid rgba(255,107,107,0.35)' } : { opacity: 0.65 }),
              })}
            >
              <span style={{ fontFamily: FONT_B, fontSize: 14, color: s.active ? T.loss : T.dim, flex: 1, minWidth: 180 }}>
                {s.active ? '🚫' : '·'} {SANCTION_LABELS[s.type]}
                {s.reason && <span style={{ color: T.dim }}> — {s.reason}</span>}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}>
                {s.tournamentName && `${s.tournamentName} · `}
                {s.active
                  ? `${s.frontiersRemaining} Frontier${s.frontiersRemaining === 1 ? '' : 's'} left`
                  : s.liftedAt ? 'PARDONED' : 'SERVED'}
                {' · '}{s.issuedAt.toISOString().slice(0, 10)}
              </span>
              {s.active && (
                <DeleteButton
                  action={liftSanctionAction}
                  hidden={{ sanctionId: s.id, playerPublicId: player.publicId }}
                  confirmText={`Lift this suspension? ${player.displayName} can sign up again immediately.`}
                  label="LIFT"
                />
              )}
            </div>
          ))}
        </div>
      )}
      <SanctionForm playerPublicId={player.publicId} />

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
