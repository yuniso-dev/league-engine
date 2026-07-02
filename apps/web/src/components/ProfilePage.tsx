'use client';
import { memo, useEffect, useState } from 'react';
import type { PublicAward, PublicPlayer, RatingPoint } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp } from '@/components/ui/CountUp';
import { RatingGraph } from '@/components/RatingGraph';
import { AwardsBadgeRow } from '@/components/AwardsBadgeRow';
import { Tilt } from '@/components/ui/Tilt';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rankColor, lighten, rgba, glass } from '@/lib/realm-colors';

type Props = {
  player: PublicPlayer | null;
  isOwn?: boolean;
  isLoggedIn?: boolean;
  currentUser?: PublicPlayer | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export const ProfilePage = memo(function ProfilePage({ player, isOwn = false, isLoggedIn = false, currentUser = null }: Props) {
  const accent = REALMS[2].accent;
  const aGlow  = lighten(accent, 0.35);

  const [history, setHistory] = useState<RatingPoint[]>([]);
  const [awards, setAwards] = useState<PublicAward[]>([]);
  const publicId = player?.publicId ?? null;

  useEffect(() => {
    setHistory([]);
    if (!publicId) return;
    let alive = true;
    fetch(`/api/history/${publicId}`)
      .then(r => (r.ok ? r.json() : []))
      .then((points: RatingPoint[]) => { if (alive) setHistory(points); })
      .catch(() => { /* graph is optional chrome — profile renders without it */ });
    return () => { alive = false; };
  }, [publicId]);

  useEffect(() => {
    setAwards([]);
    if (!publicId) return;
    let alive = true;
    fetch(`/api/awards/${publicId}`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: PublicAward[]) => { if (alive) setAwards(list); })
      .catch(() => { /* badges are optional chrome — profile renders without them */ });
    return () => { alive = false; };
  }, [publicId]);

  if (!player) {
    const header = (
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            PROFILE
          </h1>
        </div>
      </div>
    );

    if (!isLoggedIn) {
      return (
        <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
          {header}
          <div style={glass({ padding: 32, borderRadius: 20, textAlign: 'center' })}>
            <Bolt size={48} color={accent} style={{ filter: `drop-shadow(0 0 20px ${rgba(accent, 0.6)})` }} />
            <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, marginTop: 16, letterSpacing: 2 }}>
              JOIN THE LEAGUE
            </div>
            <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 24px', lineHeight: 1.65 }}>
              Sign in with Discord to claim your rank<br />and climb the Elo ladder.
            </p>
            <a
              href="/api/auth/signin?callbackUrl=%2Finitialise"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 28px',
                background: '#5865F2',
                borderRadius: 12,
                color: '#fff',
                fontFamily: FONT_D,
                fontSize: 15,
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: '0 0 28px rgba(88,101,242,0.45)',
              }}>
                <svg width="20" height="15" viewBox="0 0 71 55" fill="white">
                  <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.292408 45.3914C0.29800 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
                </svg>
                LOGIN WITH DISCORD
              </div>
            </a>
          </div>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
          {header}
          <div style={glass({ padding: 32, borderRadius: 20, textAlign: 'center' })}>
            <Bolt size={48} color={accent} style={{ filter: `drop-shadow(0 0 20px ${rgba(accent, 0.6)})` }} />
            <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, marginTop: 16, letterSpacing: 2 }}>
              ALMOST THERE
            </div>
            <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 24px', lineHeight: 1.65 }}>
              You&apos;re signed in. Complete your profile<br />to enter the rankings.
            </p>
            <a href="/initialise" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 28px',
                background: accent,
                borderRadius: 12,
                color: '#fff',
                fontFamily: FONT_D,
                fontSize: 15,
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: `0 0 28px ${rgba(accent, 0.5)}`,
              }}>
                SET UP PROFILE
              </div>
            </a>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
        {header}
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

      {/* awards */}
      {awards.length > 0 && (
        <div style={{ ...glass({ padding: 18 }), marginBottom: 12 }}>
          <AwardsBadgeRow awards={awards} />
        </div>
      )}

      {/* rating history */}
      {history.length >= 2 && (
        <div style={{ ...glass({ padding: 18 }), marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Bolt size={13} color={accent} />
            <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
              RATING HISTORY
            </h3>
          </div>
          <RatingGraph points={history} />
        </div>
      )}

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
