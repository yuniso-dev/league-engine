'use client';
import { memo } from 'react';
import Link from 'next/link';
import type { PublicTournament, StatLeaderboards, VoiceNowEntry } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { VoiceNowCard } from '@/components/VoiceNowCard';
import { StatLeaderList } from '@/components/StatLeaderList';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rgba, glass } from '@/lib/realm-colors';

type Props = {
  tournaments: PublicTournament[];
  voice: VoiceNowEntry[];
  records?: StatLeaderboards;
  recordsPreview?: boolean;
};

export const FrontierPage = memo(function FrontierPage({ tournaments, voice, records, recordsPreview }: Props) {
  const accent = REALMS[0].accent;
  const recs = records ?? { topScorers: [], topAssisters: [], topCleanSheets: [] };

  return (
    <div style={{ padding: '28px 18px 96px', maxWidth: 680, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            THE FRONTIER
          </h1>
          <Link
            href="/hall-of-fame"
            style={{
              marginLeft: 'auto',
              padding: '7px 14px',
              borderRadius: 999,
              border: `1px solid ${rgba(T.gold, 0.4)}`,
              background: rgba(T.gold, 0.08),
              color: T.gold,
              textDecoration: 'none',
              fontFamily: FONT_D,
              fontSize: 12,
              letterSpacing: 1.5,
              whiteSpace: 'nowrap',
            }}
          >
            🏛️ HALL OF FAME
          </Link>
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          Every server draft, archived in full.
        </p>
      </div>

      <VoiceNowCard voice={voice} />

      {/* all-time records — always on display; unclaimed columns say so */}
      <div style={{ ...glass({ padding: 18 }), marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Bolt size={13} color={T.gold} />
          <h3 style={{ fontFamily: FONT_D, color: T.gold, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
            ALL-TIME FRONTIER RECORDS
          </h3>
          {recordsPreview && (
            <span style={{
              marginLeft: 'auto', fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: T.faint,
              border: `1px solid ${rgba(T.gold, 0.3)}`, borderRadius: 6, padding: '2px 7px',
            }}>
              EXAMPLE
            </span>
          )}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 18,
        }}>
          <StatLeaderList title="TOP SCORERS" emoji="⚽" leaders={recs.topScorers} unit="G" />
          <StatLeaderList title="TOP ASSISTS" emoji="🎯" leaders={recs.topAssisters} unit="A" />
          <StatLeaderList title="CLEAN SHEETS" emoji="🧤" leaders={recs.topCleanSheets} unit="CS" />
        </div>
        {recordsPreview && (
          <p style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, margin: '13px 0 0', letterSpacing: 0.3, lineHeight: 1.6 }}>
            Sample layout — these fill in automatically with real leaders once match stats are recorded.
          </p>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: T.faint }}>
          <Bolt size={40} color={T.faint} style={{ opacity: 0.3 }} />
          <div style={{ fontFamily: FONT_B, fontSize: 14, marginTop: 16 }}>
            First season coming soon.
          </div>
        </div>
      ) : (
        // One block per season: vertical SEASON banner on the left, the
        // season's frontiers stacked beside it (scrollable when it fills up,
        // greyed placeholder slots when it hasn't).
        [...tournaments.reduce((bySeason, f) => {
          const list = bySeason.get(f.season) ?? [];
          list.push(f);
          bySeason.set(f.season, list);
          return bySeason;
        }, new Map<number, PublicTournament[]>()).entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([season, list]) => (
            <div key={season} style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginBottom: 18 }}>
              {/* season banner */}
              <div style={glass({
                width: 58,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(180deg, ${rgba(accent, 0.22)}, rgba(255,255,255,0.03) 70%)`,
                border: `1px solid ${rgba(accent, 0.35)}`,
              })}>
                <span style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontFamily: FONT_D,
                  fontSize: 19,
                  letterSpacing: 4,
                  color: T.text,
                  whiteSpace: 'nowrap',
                }}>
                  ⚡ SEASON {season}
                </span>
              </div>

              {/* the season's frontiers, scrollable once the strip fills */}
              <div
                className="ina-scroll"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: 430,
                  overflowY: 'auto',
                }}
              >
                {list.map((f, i) => (
                  <Link
                    key={f.id}
                    href={`/frontier/${f.id}`}
                    className="rise tap"
                    style={{
                      textDecoration: 'none',
                      animationDelay: `${i * 70}ms`,
                      flexShrink: 0,
                      ...glass({
                        padding: 18,
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, letterSpacing: '0.02em' }}>
                            {f.name.toUpperCase()}
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
                          {f.startDate ?? `Season ${f.season}`}
                        </div>
                      </div>

                      {f.winnerName ? (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 9, letterSpacing: '0.14em' }}>
                            CHAMPION
                          </div>
                          <div style={{ color: T.gold, fontFamily: FONT_D, fontSize: 18, marginTop: 2 }}>
                            🏆 {f.winnerName}
                          </div>
                        </div>
                      ) : f.status === 'upcoming' ? (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 12 }}>
                            UPCOMING
                          </div>
                          <div style={{
                            color: T.gold, fontFamily: FONT_M, fontSize: 11, marginTop: 3,
                            border: `1px solid ${rgba(T.gold, 0.35)}`, borderRadius: 6, padding: '2px 8px',
                          }}>
                            ⚡ {f.signupCount ?? 0} SIGNED UP
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: REALMS[2].accent, fontFamily: FONT_M, fontSize: 12, flexShrink: 0 }}>
                          IN PROGRESS…
                        </div>
                      )}
                    </div>
                  </Link>
                ))}

                {/* greyed placeholder slots keep the strip shaped like a season */}
                {list.length < 3 && Array.from({ length: 3 - list.length }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    style={{
                      flexShrink: 0,
                      padding: 18,
                      borderRadius: 18,
                      border: '1px dashed rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.02)',
                      opacity: 0.55,
                    }}
                  >
                    <div style={{ fontFamily: FONT_D, color: T.faint, fontSize: 18, letterSpacing: 1 }}>
                      AWAITING DRAW
                    </div>
                    <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 10.5, marginTop: 4 }}>
                      The next Frontier of Season {season} hasn&apos;t been announced.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
});
