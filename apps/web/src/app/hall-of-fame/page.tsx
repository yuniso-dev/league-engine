import { getHallOfFame, getLegacyHall, runResilient } from '@inazuma/db';
import type { HallTournament } from '@inazuma/db';
import { T, FONT_D, FONT_B, lighten } from '@/lib/realm-colors';
import { BackPill } from '@/components/ui/BackPill';
import HallOfFameView from '@/components/HallOfFameView';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GOLD = T.gold;

export default async function HallOfFamePage() {
  // Timeout → rebuild the pool → retry once, instead of the error page.
  const [hall, legacy] = await Promise.all([
    runResilient(() => getHallOfFame()),
    runResilient(() => getLegacyHall()).catch(() => []),
  ]);

  // Group real tournaments by season, newest first (query is already sorted).
  const bySeason = new Map<number, HallTournament[]>();
  for (const t of hall) {
    const list = bySeason.get(t.season) ?? [];
    list.push(t);
    bySeason.set(t.season, list);
  }
  const real = [...bySeason.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([season, tournaments]) => ({ season, tournaments }));

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
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
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

        <HallOfFameView real={real} legacy={legacy} />
      </div>
    </div>
  );
}
