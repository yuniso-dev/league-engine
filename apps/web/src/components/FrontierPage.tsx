'use client';
import { memo, useState } from 'react';
import Link from 'next/link';
import type { FrontierStatBoards, PublicTournament, VoiceNowEntry } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { VoiceNowCard } from '@/components/VoiceNowCard';
import { StatBoardCard } from '@/components/StatBoardCard';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rgba, lighten, glass } from '@/lib/realm-colors';

// The Frontier realm, split into three sub-tabs:
//  · FRONTIERS — every draft as a portrait banner, one shelf per season
//  · LIVE STATS — this season's leaders, six categories
//  · ALL-TIME  — the record books across every season
// Stat cards show the top 3 with a "show top 25" expansion (see StatBoardCard).

type Props = {
  tournaments: PublicTournament[];
  voice: VoiceNowEntry[];
  liveStats?: FrontierStatBoards;
  allTimeStats?: FrontierStatBoards;
  statsPreview?: boolean;
  season?: number;
};

type SubTab = 'frontiers' | 'live' | 'alltime';

const EMPTY_BOARDS: FrontierStatBoards = {
  goals: [], assists: [], tackles: [], cleanSheets: [], motm: [], gamesWon: [],
};

const LIVE_COLOR = REALMS[2].accent; // the orange "live" glow used on cards

function boardsEmpty(b: FrontierStatBoards): boolean {
  return Object.values(b).every(list => list.length === 0);
}

/** The six stat categories, FotMob-style. */
function StatBoards({ boards, accent }: { boards: FrontierStatBoards; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      <StatBoardCard title="GOALS" emoji="⚽" leaders={boards.goals} unit="G" accent={accent} />
      <StatBoardCard title="ASSISTS" emoji="🎯" leaders={boards.assists} unit="A" accent={accent} />
      <StatBoardCard title="TACKLES" emoji="🛡️" leaders={boards.tackles} unit="TKL" accent={accent} />
      <StatBoardCard title="CLEAN SHEETS" emoji="🧤" leaders={boards.cleanSheets} unit="CS" accent={accent} />
      <StatBoardCard title="MAN OF THE MATCH" emoji="⭐" leaders={boards.motm} unit="MOTM" accent={accent} />
      <StatBoardCard title="GAMES WON" emoji="🏅" leaders={boards.gamesWon} unit="W" accent={accent} />
    </div>
  );
}

/** One frontier as a portrait banner. */
function FrontierBanner({ f, accent, delay }: { f: PublicTournament; accent: string; delay: number }) {
  const live = f.status === 'live';
  const edge = live ? LIVE_COLOR : accent;
  return (
    <Link
      href={`/frontier/${f.id}`}
      className="rise tap"
      style={{
        textDecoration: 'none',
        animationDelay: `${delay}ms`,
        flexShrink: 0,
        width: 168,
        height: 236,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        ...glass({
          padding: 14,
          borderRadius: 18,
          borderTop: `3px solid ${edge}`,
          background: `linear-gradient(180deg, ${rgba(edge, 0.16)}, rgba(255,255,255,0.03) 55%)`,
        }),
      }}
    >
      {/* backdrop bolt watermark */}
      <div style={{ position: 'absolute', right: -18, bottom: -14, opacity: 0.1, pointerEvents: 'none' }}>
        <Bolt size={110} color={edge} />
      </div>

      {/* status */}
      {live ? (
        <span style={{
          alignSelf: 'flex-start',
          background: rgba(LIVE_COLOR, 0.18), color: LIVE_COLOR,
          fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 5,
          letterSpacing: 1.5, fontFamily: FONT_B,
        }}>
          ● LIVE
        </span>
      ) : (
        <span style={{ fontFamily: FONT_M, fontSize: 9.5, letterSpacing: 1.5, color: T.faint }}>
          {f.status === 'upcoming' ? 'UPCOMING' : f.startDate ?? `SEASON ${f.season}`}
        </span>
      )}

      {/* name — the poster headline */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', position: 'relative', minHeight: 0,
      }}>
        <span style={{
          fontFamily: FONT_D, color: T.text, fontSize: 24, lineHeight: 1.12,
          letterSpacing: '0.03em', overflowWrap: 'anywhere',
        }}>
          {f.name.toUpperCase()}
        </span>
      </div>

      {/* footer — champion / signups / in progress */}
      {f.winnerName ? (
        <div style={{ position: 'relative' }}>
          <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 8.5, letterSpacing: '0.16em' }}>
            CHAMPION
          </div>
          <div style={{
            color: T.gold, fontFamily: FONT_D, fontSize: 15, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            🏆 {f.winnerName}
          </div>
        </div>
      ) : f.status === 'upcoming' ? (
        <div style={{
          position: 'relative',
          color: T.gold, fontFamily: FONT_M, fontSize: 10.5,
          border: `1px solid ${rgba(T.gold, 0.35)}`, borderRadius: 7, padding: '4px 8px',
          alignSelf: 'flex-start',
        }}>
          ⚡ {f.signupCount ?? 0} SIGNED UP
        </div>
      ) : (
        <div style={{ position: 'relative', color: LIVE_COLOR, fontFamily: FONT_M, fontSize: 11 }}>
          IN PROGRESS…
        </div>
      )}
    </Link>
  );
}

export const FrontierPage = memo(function FrontierPage({ tournaments, voice, liveStats, allTimeStats, statsPreview, season }: Props) {
  const accent = REALMS[0].accent;
  const [tab, setTab] = useState<SubTab>('frontiers');

  const live = liveStats ?? EMPTY_BOARDS;
  const allTime = allTimeStats ?? EMPTY_BOARDS;

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'frontiers', label: 'Frontiers' },
    { id: 'live', label: 'Live stats' },
    { id: 'alltime', label: 'All-time' },
  ];

  return (
    <div style={{ padding: '28px 18px 96px', maxWidth: 680, margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 16 }}>
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

      {/* sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {subTabs.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setTab(s.id)}
            style={{
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${tab === s.id ? rgba(accent, 0.6) : 'rgba(255,255,255,0.12)'}`,
              background: tab === s.id ? rgba(accent, 0.16) : 'none',
              color: tab === s.id ? lighten(accent, 0.35) : T.dim,
              fontFamily: FONT_B, fontWeight: 700, fontSize: 12.5,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── FRONTIERS ── */}
      {tab === 'frontiers' && (
        <>
          <VoiceNowCard voice={voice} />

          {tournaments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: T.faint }}>
              <Bolt size={40} color={T.faint} style={{ opacity: 0.3 }} />
              <div style={{ fontFamily: FONT_B, fontSize: 14, marginTop: 16 }}>
                First season coming soon.
              </div>
            </div>
          ) : (
            // One shelf per season: label above, the season's frontiers as
            // portrait banners in a sideways-scrolling strip.
            [...tournaments.reduce((bySeason, f) => {
              const list = bySeason.get(f.season) ?? [];
              list.push(f);
              bySeason.set(f.season, list);
              return bySeason;
            }, new Map<number, PublicTournament[]>()).entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([s, list]) => (
                <div key={s} style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Bolt size={13} color={accent} />
                    <span style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 2.5, color: T.text }}>
                      SEASON {s}
                    </span>
                    <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${rgba(accent, 0.4)}, transparent)` }} />
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                      {list.length} FRONTIER{list.length === 1 ? '' : 'S'}
                    </span>
                  </div>

                  <div
                    className="ina-scroll"
                    style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}
                  >
                    {list.map((f, i) => (
                      <FrontierBanner key={f.id} f={f} accent={accent} delay={i * 70} />
                    ))}

                    {/* greyed slots keep the shelf shaped like a season */}
                    {list.length < 3 && Array.from({ length: 3 - list.length }).map((_, i) => (
                      <div
                        key={`slot-${i}`}
                        style={{
                          flexShrink: 0,
                          width: 168,
                          height: 236,
                          borderRadius: 18,
                          border: '1px dashed rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.02)',
                          opacity: 0.55,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: 14,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontFamily: FONT_D, color: T.faint, fontSize: 16, letterSpacing: 1 }}>
                          AWAITING DRAW
                        </div>
                        <div style={{ color: T.faint, fontFamily: FONT_M, fontSize: 9.5, lineHeight: 1.6 }}>
                          The next Frontier of Season {s} hasn&apos;t been announced.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </>
      )}

      {/* ── LIVE STATS (this season) ── */}
      {tab === 'live' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Bolt size={13} color={accent} />
            <h3 style={{ fontFamily: FONT_D, color: lighten(accent, 0.25), fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
              SEASON {season ?? 1} — LIVE STATS
            </h3>
          </div>
          {boardsEmpty(live) ? (
            <div style={{ ...glass({ padding: '30px 24px', textAlign: 'center' }) }}>
              <Bolt size={26} color={accent} style={{ opacity: 0.5 }} />
              <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1.5, color: T.dim, margin: '12px 0 6px' }}>
                THE SEASON HASN&apos;T SPOKEN YET
              </div>
              <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, lineHeight: 1.65 }}>
                Leaders appear here as Season {season ?? 1} match stats are recorded.
              </div>
            </div>
          ) : (
            <StatBoards boards={live} accent={accent} />
          )}
        </>
      )}

      {/* ── ALL-TIME ── */}
      {tab === 'alltime' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Bolt size={13} color={T.gold} />
            <h3 style={{ fontFamily: FONT_D, color: T.gold, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
              ALL-TIME FRONTIER RECORDS
            </h3>
            {statsPreview && (
              <span style={{
                marginLeft: 'auto', fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: T.faint,
                border: `1px solid ${rgba(T.gold, 0.3)}`, borderRadius: 6, padding: '2px 7px',
              }}>
                EXAMPLE
              </span>
            )}
          </div>
          <StatBoards boards={allTime} accent={T.gold} />
          {statsPreview && (
            <p style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, margin: '13px 0 0', letterSpacing: 0.3, lineHeight: 1.6 }}>
              Sample layout — these fill in automatically with real leaders once match stats are recorded.
            </p>
          )}
        </>
      )}
    </div>
  );
});
