'use client';
import { memo, useState } from 'react';
import type { PublicPlayer } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { Avatar } from '@/components/ui/Avatar';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rankColor, rgba, lighten, glass } from '@/lib/realm-colors';

type Props = {
  players: PublicPlayer[];
  onOpen: (player: PublicPlayer) => void;
  season?: number;
};

const MEDAL: Record<number, { from: string; to: string; glow: string }> = {
  1: { from: '#FFE9A3', to: '#D4A017', glow: 'rgba(255,210,74,0.55)' },
  2: { from: '#F1F5FB', to: '#8E9DB5', glow: 'rgba(200,210,224,0.45)' },
  3: { from: '#F0B27E', to: '#A05A2C', glow: 'rgba(224,145,90,0.5)' },
};

/** Top-3 get a glowing hexagon medal; everyone else a plain number.
 *  Ranks are tie-aware (equal Elo shares a rank), so several players can
 *  legitimately wear the same medal. */
function RankBadge({ rank }: { rank: number | null }) {
  const show = rank != null;
  const medal = show ? MEDAL[rank!] : undefined;

  if (medal) {
    return (
      <span style={{
        width: 38, height: 42, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(160deg, ${medal.from}, ${medal.to})`,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        fontFamily: FONT_D, fontSize: 19, color: '#101319',
        filter: `drop-shadow(0 0 8px ${medal.glow})`,
      }}>
        {rank}
      </span>
    );
  }

  return (
    <span style={{
      fontFamily: FONT_D, fontSize: 20,
      color: show ? rankColor(rank) : T.faint,
      width: 38, textAlign: 'center', flexShrink: 0,
    }}>
      {show ? rank : '~'}
    </span>
  );
}

function Num({ v, l, c }: { v: number | string; l: string; c?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 36 }}>
      <div style={{ color: c ?? T.text, fontFamily: FONT_D, fontSize: 17 }}>{v}</div>
      <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 8 }}>{l}</div>
    </div>
  );
}

const DEFENDERS = ['CB', 'LB', 'RB'];
const MIDFIELDERS = ['CDM', 'CM', 'CAM', 'LM', 'RM'];

/** The stat that matters for the player's role: keepers → clean sheets,
 *  defenders → games won, midfielders → goals/assists, attackers → goals. */
function roleStat(p: PublicPlayer): { v: number | string; l: string } {
  const pos = !p.hidePositions ? p.position1 : null;
  if (pos === 'GK') return { v: p.cleanSheets ?? 0, l: 'CS' };
  if (pos && DEFENDERS.includes(pos)) return { v: p.wins ?? 0, l: 'WON' };
  if (pos && MIDFIELDERS.includes(pos)) return { v: `${p.goals ?? 0}/${p.assists ?? 0}`, l: 'G/A' };
  return { v: p.goals ?? 0, l: 'GOALS' }; // ST / LW / RW / no position
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const RankingsPage = memo(function RankingsPage({ players, onOpen, season }: Props) {
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
    <div className="rank-wrap" style={{ padding: '28px 18px 96px', margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 18 }}>
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

      {/* season banner */}
      <div style={{
        ...glass({ padding: '13px 18px', borderRadius: 14 }),
        marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        background: `linear-gradient(100deg, ${rgba(accent, 0.2)}, rgba(255,255,255,0.04) 55%)`,
        border: `1px solid ${rgba(accent, 0.35)}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -30, width: 150, height: 150,
          background: `radial-gradient(circle, ${rgba(accent, 0.22)}, transparent 70%)`,
        }} />
        <Bolt size={18} color={lighten(accent, 0.3)} />
        <div>
          <div style={{ fontFamily: FONT_D, fontSize: 19, letterSpacing: 2.5, color: T.text, lineHeight: 1.1 }}>
            SEASON {season ?? 1}
          </div>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: T.dim }}>
            INAZUMA FRONTIER · {players.length} PLAYERS
          </div>
        </div>
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
          const showRank = p.rank != null;
          const winRate =
            p.wins != null && p.gamesPlayed > 0
              ? Math.round((p.wins / p.gamesPlayed) * 100)
              : null;
          const rs = roleStat(p);
          return (
            <div
              key={p.publicId ?? p.displayName + i}
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
              <RankBadge rank={p.rank} />

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
                  <FlagIcon code={p.country} size={17} />
                  {p.tier === 'premium' && <Bolt size={9} color={T.gold} />}
                  {p.title && (
                    <span style={{
                      color: T.gold, fontSize: 9, fontFamily: FONT_M,
                      letterSpacing: 1.5, textTransform: 'uppercase',
                    }}>
                      {p.title}
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: T.dim, fontFamily: FONT_M, fontSize: 10, marginTop: 2,
                }}>
                  {!p.hidePositions && p.position1 && (
                    <span>{[p.position1, p.position2].filter(Boolean).join(' · ')}</span>
                  )}
                  {(p.awardBadges?.length ?? 0) > 0 && (
                    <span style={{ display: 'inline-flex', gap: 3, fontSize: 13, lineHeight: 1 }}>
                      {p.awardBadges!.slice(0, 4).map((a, j) =>
                        a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={a.imageUrl} alt={a.name} title={a.name} width={14} height={14} style={{ borderRadius: 3, objectFit: 'cover' }} />
                        ) : a.icon ? (
                          <span key={j} title={a.name}>{a.icon}</span>
                        ) : (
                          <span key={j} title={a.name}>🏅</span>
                        ),
                      )}
                      {p.awardBadges!.length > 4 && (
                        <span style={{ color: T.faint, fontSize: 9, fontFamily: FONT_M }}>
                          +{p.awardBadges!.length - 4}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
                <Num v={rs.v} l={rs.l} c={T.dim} />
                <Num v={winRate != null ? `${winRate}%` : '—'} l="WR %" c={winRate != null && winRate >= 50 ? T.win : T.dim} />
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
