'use client';
import { memo } from 'react';
import type { PublicPlayer } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp } from '@/components/ui/CountUp';
import { Tilt } from '@/components/ui/Tilt';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rankColor, lighten, rgba, glass } from '@/lib/realm-colors';

type Props = { player: PublicPlayer | null; isOwn?: boolean };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const ProfilePage = memo(function ProfilePage({ player, isOwn = false }: Props) {
  const accent = REALMS[2].accent;
  const aGlow  = lighten(accent, 0.35);

  if (!player) {
    return (
      <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bolt size={20} color={accent} />
            <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
              PROFILE
            </h1>
          </div>
        </div>
        <div style={{ textAlign: 'center', paddingTop: 80, color: T.faint }}>
          <Bolt size={40} color={T.faint} style={{ opacity: 0.3 }} />
          <div style={{ fontFamily: FONT_B, fontSize: 14, marginTop: 16 }}>
            Tap a player in Rankings to view their profile.
          </div>
        </div>
      </div>
    );
  }

  const rc       = rankColor(player.rank);
  const showRank = !player.provisional && player.rank != null;

  const rankLabel = showRank
    ? `#${player.rank}`
    : `Provisional — ${player.gamesPlayed}/5 placement games`;

  const stats: { l: string; v: number; s: string; c: string }[] = [
    { l: 'RANK',   v: player.rank ?? 0,   s: '',  c: showRank ? rc : T.faint },
    { l: 'ELO',    v: Math.round(player.elo), s: '', c: T.text },
    { l: 'PLAYED', v: player.gamesPlayed,  s: '',  c: aGlow   },
  ];

  const positions = !player.hidePositions
    ? [player.position1, player.position2].filter(Boolean).join(' / ')
    : null;

  return (
    <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            {isOwn ? 'YOUR PROFILE' : 'PROFILE'}
          </h1>
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          {isOwn ? 'This is how the server sees you.' : `Viewing ${player.displayName}`}
        </p>
      </div>

      {/* hero card */}
      <Tilt style={{ marginBottom: 12 }}>
        <div style={glass({ padding: 24, position: 'relative', overflow: 'hidden' })}>
          <div style={{
            position: 'absolute', top: -50, right: -50,
            width: 180, height: 180,
            background: `radial-gradient(circle,${rgba(accent, 0.25)},transparent 70%)`,
          }} />

          <div style={{ display: 'flex', gap: 18, alignItems: 'center', position: 'relative' }}>
            <Avatar initials={initials(player.displayName)} size={82} ring={showRank ? rc : null} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 32, letterSpacing: '0.02em' }}>
                  {player.displayName.toUpperCase()}
                </span>
                {player.country && <span style={{ fontSize: 22 }}>{player.country}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT_D, fontSize: 18, color: showRank ? rc : T.faint }}>
                  {rankLabel}
                </span>
                {positions && positions.split(' / ').map(pos => (
                  <span key={pos} style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: T.text, padding: '3px 10px',
                    borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: FONT_M,
                  }}>
                    {pos}
                  </span>
                ))}
                {player.tier === 'premium' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: rgba(T.gold, 0.14), padding: '3px 9px', borderRadius: 7,
                  }}>
                    <Bolt size={9} color={T.gold} />
                    <span style={{ color: T.gold, fontSize: 9, fontWeight: 800, fontFamily: FONT_M, letterSpacing: 1 }}>
                      PREMIUM
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {player.quote && (
            <div style={{
              marginTop: 18, padding: '14px 18px',
              background: 'rgba(255,255,255,0.035)',
              borderLeft: `2px solid ${accent}`, borderRadius: 10,
            }}>
              <span style={{ color: T.text, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 16 }}>
                &ldquo;{player.quote}&rdquo;
              </span>
            </div>
          )}
        </div>
      </Tilt>

      {/* stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 8, marginBottom: 12 }}>
        {stats.map(s => (
          <div key={s.l} style={glass({ padding: '16px 4px', textAlign: 'center' })}>
            <div style={{ fontFamily: FONT_D, fontSize: 26, color: s.c, lineHeight: 1 }}>
              {s.l === 'RANK' && !showRank ? '—' : <CountUp end={s.v} suffix={s.s} />}
            </div>
            <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 8, letterSpacing: '0.06em', marginTop: 4 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* bio / scouting report */}
      {player.bio && (
        <div style={glass({ padding: 22, borderLeft: `3px solid ${accent}` })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <Bolt size={13} color={accent} />
            <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
              SCOUTING REPORT
            </h3>
          </div>
          <p style={{ color: T.text, fontFamily: FONT_B, fontSize: 14.5, lineHeight: 1.75, margin: 0, opacity: 0.92 }}>
            {player.bio}
          </p>
        </div>
      )}
    </div>
  );
});
