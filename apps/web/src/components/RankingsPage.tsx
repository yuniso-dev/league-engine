'use client';
import { memo, useState } from 'react';
import type { PublicPlayer } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { Avatar } from '@/components/ui/Avatar';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rankColor, rgba, glass } from '@/lib/realm-colors';
import { flagEmoji, countryName } from '@/lib/countries';

type Props = {
  players: PublicPlayer[];
  onOpen: (player: PublicPlayer) => void;
};

function Num({ v, l }: { v: number | string; l: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: T.text, fontFamily: FONT_D, fontSize: 17 }}>{v}</div>
      <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 8 }}>{l}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const RankingsPage = memo(function RankingsPage({ players, onOpen }: Props) {
  const accent = REALMS[1].accent;
  const [q, setQ] = useState('');

  // Client-side filter — /api/rankings?q= exists for external use but is not called here
  const list = q
    ? players.filter(p =>
        p.displayName.toLowerCase().includes(q.toLowerCase()) ||
        (p.showUsername && p.username.toLowerCase().includes(q.toLowerCase())),
      )
    : players;

  return (
    <div style={{ padding: '28px 18px 96px', maxWidth: 680, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            RANKINGS
          </h1>
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          The Frontier ladder. Tap a player to open their profile.
        </p>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="◍ Search players…"
        style={{
          width: '100%', padding: '13px 16px', marginBottom: 16,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14, color: T.text,
          fontFamily: FONT_B, fontSize: 14, outline: 'none',
          backdropFilter: 'blur(10px)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.length === 0 && q === '' && (
          <div style={{ color: T.faint, fontFamily: FONT_B, fontSize: 14, textAlign: 'center', padding: '48px 0' }}>
            <Bolt size={32} color={T.faint} style={{ opacity: 0.3 }} />
            <div style={{ marginTop: 12 }}>The ladder is empty. Season is loading.</div>
          </div>
        )}

        {list.length === 0 && q !== '' && (
          <div style={{ color: T.faint, fontFamily: FONT_B, fontSize: 14, textAlign: 'center', padding: 36 }}>
            No players match &ldquo;{q}&rdquo;.
          </div>
        )}

        {list.map((p, i) => {
          const rc = rankColor(p.rank);
          const showRank = !p.provisional && p.rank != null;
          return (
            <div
              key={p.displayName + i}
              className="rise"
              onClick={() => onOpen(p)}
              style={{
                animationDelay: `${i * 55}ms`,
                ...glass({
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 13,
                  cursor: 'pointer',
                }),
              }}
            >
              {/* rank / provisional badge */}
              <span style={{
                fontFamily: FONT_D, fontSize: 22,
                color: showRank ? rc : T.faint,
                width: 34, textAlign: 'center',
                textShadow: showRank && p.rank! <= 3 ? `0 0 14px ${rc}` : 'none',
                flexShrink: 0,
              }}>
                {showRank ? p.rank : '~'}
              </span>

              <Avatar
                initials={initials(p.displayName)}
                src={p.avatarUrl}
                size={42}
                ring={showRank && p.rank! <= 3 ? rc : null}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ color: T.text, fontFamily: FONT_B, fontWeight: 700, fontSize: 15 }}>
                    {p.displayName}
                  </span>
                  {flagEmoji(p.country) && (
                    <span style={{ fontSize: 15 }} title={countryName(p.country) ?? undefined}>
                      {flagEmoji(p.country)}
                    </span>
                  )}
                  {p.tier === 'premium' && <Bolt size={9} color={T.gold} />}
                  {p.provisional && (
                    <span style={{ color: T.faint, fontSize: 9, fontFamily: FONT_M, letterSpacing: 1 }}>
                      PROVISIONAL
                    </span>
                  )}
                </div>
                <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 10, marginTop: 2 }}>
                  {!p.hidePositions && p.position1
                    ? [p.position1, p.position2].filter(Boolean).join(' · ')
                    : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Num v={Math.round(p.elo)} l="ELO" />
                <Num v={p.gamesPlayed} l="GP" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
