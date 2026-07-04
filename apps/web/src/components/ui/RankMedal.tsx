import { FONT_D, rankColor, T } from '@/lib/realm-colors';

// Gold / silver / bronze hexagon medal for the top 3, a plain number below.
// Shared by the rankings ladder and every stat leaderboard.
const MEDAL: Record<number, { from: string; to: string; glow: string }> = {
  1: { from: '#FFE9A3', to: '#D4A017', glow: 'rgba(255,210,74,0.55)' },
  2: { from: '#F1F5FB', to: '#8E9DB5', glow: 'rgba(200,210,224,0.45)' },
  3: { from: '#F0B27E', to: '#A05A2C', glow: 'rgba(224,145,90,0.5)' },
};

export function RankMedal({ place, size = 24 }: { place: number; size?: number }) {
  const m = MEDAL[place];
  if (m) {
    return (
      <span style={{
        width: size, height: size * 1.12, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(160deg, ${m.from}, ${m.to})`,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        fontFamily: FONT_D, fontSize: size * 0.52, color: '#101319',
        filter: `drop-shadow(0 0 6px ${m.glow})`,
      }}>
        {place}
      </span>
    );
  }
  return (
    <span style={{
      width: size, textAlign: 'center', flexShrink: 0,
      fontFamily: FONT_D, fontSize: size * 0.58, color: rankColor(place),
    }}>
      {place}
    </span>
  );
}
