import Link from 'next/link';
import { getHallOfFame } from '@inazuma/db';
import type { HallTournament } from '@inazuma/db';
import { glass, T, FONT_D, FONT_B, FONT_M, rgba, lighten } from '@/lib/realm-colors';
import { BackPill } from '@/components/ui/BackPill';
import { Bolt } from '@/components/ui/Bolt';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GOLD = T.gold;

function FrontierPlaque({ t }: { t: HallTournament }) {
  return (
    <div style={{
      ...glass({ padding: 24, borderRadius: 20 }),
      border: `1px solid ${rgba(GOLD, 0.28)}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 200, pointerEvents: 'none',
        background: `radial-gradient(circle, ${rgba(GOLD, 0.13)}, transparent 70%)`,
      }} />

      {/* frontier name + date */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <Link href={`/frontier/${t.id}`} style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: FONT_D, fontSize: 22, letterSpacing: 1, color: T.text }}>
            {t.name.toUpperCase()}
          </span>
        </Link>
        {t.startDate && (
          <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>{t.startDate}</span>
        )}
      </div>

      {/* champions */}
      {t.championTeam && (
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint }}>
            🏆 CHAMPIONS
          </div>
          <div style={{
            fontFamily: FONT_D, fontSize: 26, letterSpacing: 1, marginTop: 4,
            background: `linear-gradient(120deg, ${GOLD}, ${lighten(GOLD, 0.35)})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t.championTeam}
          </div>
          {t.championRoster.length > 0 && (
            <div style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.dim, marginTop: 6, lineHeight: 1.7 }}>
              {t.championRoster.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* award plaques */}
      {t.awards.length > 0 && (
        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: T.faint, marginBottom: 8 }}>
            HONOURS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {t.awards.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 12,
                background: rgba(GOLD, 0.06),
                border: `1px solid ${rgba(GOLD, 0.2)}`,
              }}>
                <AwardBadgeIcon imageUrl={a.imageUrl} icon={a.icon} size={22} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: rgba(GOLD, 0.85),
                    textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.name}
                  </div>
                  {a.playerPublicId ? (
                    <Link href={`/p/${a.playerPublicId}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontFamily: FONT_B, fontSize: 13.5, fontWeight: 700, color: T.text }}>
                        {a.playerName}
                      </span>
                    </Link>
                  ) : (
                    <span style={{ fontFamily: FONT_B, fontSize: 13.5, fontWeight: 700, color: T.text }}>
                      {a.playerName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function HallOfFamePage() {
  const hall = await getHallOfFame();

  // Group by season, newest first (query is already sorted).
  const seasons = new Map<number, HallTournament[]>();
  for (const t of hall) {
    const list = seasons.get(t.season) ?? [];
    list.push(t);
    seasons.set(t.season, list);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 50% 0%, #221604 0%, #0c0803 45%, #04050c 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 64px',
    }}>
      <header style={{ width: '100%', maxWidth: 760, marginBottom: 28 }}>
        <BackPill href="/" label="INAZUMA FC" accent={GOLD} />
      </header>

      <div style={{ width: '100%', maxWidth: 760 }}>
        {/* title */}
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div style={{ fontSize: 34, lineHeight: 1 }}>🏛️</div>
          <h1 style={{
            fontFamily: FONT_D, fontSize: 40, letterSpacing: 6, margin: '10px 0 0',
            background: `linear-gradient(120deg, ${GOLD}, ${lighten(GOLD, 0.4)}, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            HALL OF FAME
          </h1>
          <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.dim, margin: '8px 0 0' }}>
            Every champion. Every honour. Written in gold, forever.
          </p>
        </div>

        {hall.length === 0 ? (
          <div style={{
            ...glass({ padding: 44, borderRadius: 22, textAlign: 'center' }),
            border: '1px dashed rgba(255,210,74,0.25)',
          }}>
            <Bolt size={36} color={GOLD} style={{ opacity: 0.4 }} />
            <div style={{ fontFamily: FONT_D, fontSize: 18, letterSpacing: 3, color: T.dim, marginTop: 14 }}>
              THE HALL AWAITS ITS FIRST LEGENDS
            </div>
            <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: '10px 0 0', lineHeight: 1.8, letterSpacing: 0.5 }}>
              No Frontier has been completed yet.
              <br />Someone will lift the first trophy. Their name starts this wall.
            </p>
          </div>
        ) : (
          [...seasons.entries()].map(([season, list]) => (
            <div key={season} style={{ marginBottom: 36 }}>
              {/* season divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${rgba(GOLD, 0.4)})` }} />
                <span style={{ fontFamily: FONT_D, fontSize: 17, letterSpacing: 4, color: rgba(GOLD, 0.9) }}>
                  SEASON {season}
                </span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${rgba(GOLD, 0.4)}, transparent)` }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {list.map(t => <FrontierPlaque key={t.id} t={t} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
