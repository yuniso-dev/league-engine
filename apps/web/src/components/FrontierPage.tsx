'use client';
import { memo } from 'react';
import Link from 'next/link';
import type { PublicTournament } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rgba, glass } from '@/lib/realm-colors';

type Props = { tournaments: PublicTournament[] };

export const FrontierPage = memo(function FrontierPage({ tournaments }: Props) {
  const accent = REALMS[0].accent;

  return (
    <div style={{ padding: '28px 18px 96px', maxWidth: 680, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            THE FRONTIER
          </h1>
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          Every server draft, archived in full.
        </p>
      </div>

      {tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: T.faint }}>
          <Bolt size={40} color={T.faint} style={{ opacity: 0.3 }} />
          <div style={{ fontFamily: FONT_B, fontSize: 14, marginTop: 16 }}>
            First season coming soon.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tournaments.map((f, i) => (
            <Link
              key={f.id}
              href={`/frontier/${f.id}`}
              className="rise"
              style={{
                textDecoration: 'none',
                animationDelay: `${i * 70}ms`,
                ...glass({
                  padding: 20,
                  borderLeft: `3px solid ${f.status === 'live' ? REALMS[2].accent : accent}`,
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'block',
                }),
              }}
            >
              {f.status === 'live' && (
                <div style={{
                  position: 'absolute', top: -30, right: -30,
                  width: 120, height: 120,
                  background: `radial-gradient(circle,${rgba(REALMS[2].accent, 0.2)},transparent 70%)`,
                }} />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 26, letterSpacing: '0.02em' }}>
                      SEASON {f.season}
                    </span>
                    {f.status === 'live' && (
                      <span style={{
                        background: rgba(REALMS[2].accent, 0.18),
                        color: REALMS[2].accent,
                        fontSize: 9, fontWeight: 800,
                        padding: '3px 7px', borderRadius: 5,
                        letterSpacing: 1.5, fontFamily: FONT_B,
                      }}>
                        ● LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 11, marginTop: 4 }}>
                    {f.name}
                  </div>
                </div>

                {f.winnerName ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 9, letterSpacing: '0.14em' }}>
                      CHAMPION
                    </div>
                    <div style={{ color: T.gold, fontFamily: FONT_D, fontSize: 20, marginTop: 2 }}>
                      🏆 {f.winnerName}
                    </div>
                  </div>
                ) : f.status === 'upcoming' ? (
                  <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 12 }}>
                    UPCOMING
                  </div>
                ) : (
                  <div style={{ color: REALMS[2].accent, fontFamily: FONT_M, fontSize: 12 }}>
                    IN PROGRESS…
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
