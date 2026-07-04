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

// A stat block: big value over a tiny label, sized to match the ELO number.
// The value font shrinks only on small phones (see .rank-stat-v in globals.css).
function StatBlock({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rank-stat" style={{ textAlign: 'center', flexShrink: 0 }}>
      <div className="rank-stat-v" style={{ fontFamily: FONT_D, color: color ?? T.text, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, letterSpacing: 1, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

/** Everyone shows goals/assists — except keepers, whose stat is clean sheets. */
function roleStat(p: PublicPlayer): { v: number | string; l: string } {
  const pos = !p.hidePositions ? p.position1 : null;
  if (pos === 'GK') return { v: p.cleanSheets ?? 0, l: 'CS' };
  return { v: `${p.goals ?? 0}/${p.assists ?? 0}`, l: 'G/A' };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const RankingsPage = memo(function RankingsPage({ players, onOpen, season }: Props) {
  const accent = REALMS[1].accent;
  const accent2 = REALMS[1].accent2;
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
          The Season {season ?? 1} ladder. Tap a player to open their profile.
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
          const isTop3 = showRank && p.rank! <= 3;
          // Win rate off matches actually recorded, so it's live the moment
          // results are entered — not only after a reveal bumps games_played.
          const decided = (p.played ?? 0) > 0 ? p.played! : p.gamesPlayed;
          const winRate =
            p.wins != null && decided > 0
              ? Math.round((p.wins / decided) * 100)
              : null;
          const rs = roleStat(p);
          return (
            <div
              key={p.publicId ?? p.displayName + i}
              className="rise tap"
              onClick={() => onOpen(p)}
              style={{
                animationDelay: `${Math.min(i, 12) * 45}ms`,
                ...glass({
                  padding: '11px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  borderLeft: `3px solid ${isTop3 ? rc : rgba(accent, 0.4)}`,
                  ...(isTop3
                    ? {
                        background: `linear-gradient(100deg, ${rgba(rc, 0.14)}, rgba(255,255,255,0.05) 58%)`,
                        boxShadow: `0 10px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 22px ${rgba(rc, 0.14)}`,
                      }
                    : {}),
                }),
              }}
            >
              <RankBadge rank={p.rank} />

              <Avatar
                initials={initials(p.displayName)}
                src={p.avatarUrl}
                size={44}
                ring={isTop3 ? rc : null}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* line 1 — identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ color: T.text, fontFamily: FONT_B, fontWeight: 700, fontSize: 15.5 }}>
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
                  {(p.awardBadges?.length ?? 0) > 0 && (
                    <span style={{ display: 'inline-flex', gap: 3, fontSize: 13, lineHeight: 1 }}>
                      {p.awardBadges!.slice(0, 4).map((a, j) =>
                        a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={a.imageUrl} alt={a.name} title={a.name} width={14} height={14} style={{ borderRadius: 3, objectFit: 'cover' }} />
                        ) : (
                          <span key={j} title={a.name}>{a.icon ?? '🏅'}</span>
                        ),
                      )}
                    </span>
                  )}
                </div>
                {/* line 2 — position only; the stats sit in the strip on the right */}
                {!p.hidePositions && p.position1 && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: accent2, letterSpacing: 0.5 }}>
                      {[p.position1, p.position2].filter(Boolean).join('·')}
                    </span>
                  </div>
                )}
              </div>

              {/* stat strip — role stat, games won, win rate and ELO, all one size */}
              <div className="rank-strip" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <StatBlock label={rs.l} value={rs.v} />
                <StatBlock label="GW" value={p.wins ?? 0} color={(p.wins ?? 0) > 0 ? T.win : T.dim} />
                <StatBlock label="WR" value={winRate != null ? `${winRate}%` : '—'} color={winRate != null && winRate >= 50 ? T.win : T.dim} />
                <StatBlock label="ELO" value={Math.round(p.elo)} color={accent2} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
