import { notFound } from 'next/navigation';
import { getUserByPublicId } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { glass, T, FONT_D, FONT_B, FONT_M, rankColor } from '@/lib/realm-colors';

export const dynamic = 'force-dynamic';

type Props = { params: { publicId: string } };

export default async function PublicProfilePage({ params }: Props) {
  const player = await getUserByPublicId(params.publicId);
  if (!player) notFound();

  const initials = player.displayName.slice(0, 2).toUpperCase();
  const showRank = player.rank !== null && !player.provisional;
  const rankLabel = showRank ? `#${player.rank}` : player.provisional ? `${player.gamesPlayed}/5` : '—';
  const rankCaption = showRank ? 'RANK' : player.provisional ? 'PLACEMENT' : 'RANK';

  const positions = !player.hidePositions
    ? `${player.position1 ?? '??'} / ${player.position2 ?? '??'}`
    : null;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 70%, #3A1A08 0%, #120703 55%, #04050c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <header style={{ width: '100%', maxWidth: 460, marginBottom: 24 }}>
        <a href="/" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, textDecoration: 'none', letterSpacing: '0.02em' }}>
          ← INAZUMA FC
        </a>
      </header>

      <div style={{ ...glass({ padding: 32, borderRadius: 22 }), width: '100%', maxWidth: 460 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Avatar initials={initials} src={player.avatarUrl} size={64} ring="#FF7A1A" />
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 24, color: T.text, letterSpacing: 1 }}>
              {player.displayName}
            </div>
            {positions && (
              <div style={{ fontFamily: FONT_M, fontSize: 13, color: '#FF7A1A', marginTop: 2 }}>
                {positions}
              </div>
            )}
            {player.country && (
              <div style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint, marginTop: 2 }}>
                {player.country}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginBottom: 24 }}>
          {[
            { label: rankCaption, value: rankLabel, color: showRank ? rankColor(player.rank) : T.dim },
            { label: 'ELO', value: Math.round(player.elo).toString(), color: T.text },
            { label: 'PLAYED', value: player.gamesPlayed.toString(), color: T.text },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: '14px 0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: FONT_D, fontSize: 22, color, letterSpacing: 1 }}>{value}</div>
              <div style={{ fontFamily: FONT_B, fontSize: 10, color: T.faint, letterSpacing: 1, marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {player.provisional && (
          <div style={{
            background: 'rgba(255,122,26,0.1)',
            border: '1px solid rgba(255,122,26,0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: FONT_B,
            fontSize: 13,
            color: '#FF7A1A',
            marginBottom: 20,
          }}>
            Provisional — {player.gamesPlayed}/5 placement games
          </div>
        )}

        {/* Bio / quote */}
        {player.quote && (
          <blockquote style={{
            margin: '0 0 16px',
            paddingLeft: 14,
            borderLeft: '3px solid rgba(255,122,26,0.5)',
            fontFamily: FONT_B,
            fontSize: 14,
            color: T.dim,
            fontStyle: 'italic',
          }}>
            "{player.quote}"
          </blockquote>
        )}

        {player.bio && (
          <p style={{
            margin: 0,
            fontFamily: FONT_B,
            fontSize: 14,
            color: T.dim,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {player.bio}
          </p>
        )}

        {/* Tier badge */}
        {player.tier === 'premium' && (
          <div style={{
            marginTop: 20,
            display: 'inline-block',
            padding: '4px 10px',
            background: 'rgba(255,210,74,0.15)',
            border: '1px solid rgba(255,210,74,0.35)',
            borderRadius: 6,
            fontFamily: FONT_B,
            fontSize: 11,
            color: T.gold,
            letterSpacing: 1,
          }}>
            PREMIUM
          </div>
        )}
      </div>
    </div>
  );
}
