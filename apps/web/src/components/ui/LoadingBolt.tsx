import { Bolt } from '@/components/ui/Bolt';
import { FONT_M, T } from '@/lib/realm-colors';

// Instant feedback while a server-rendered page loads (route loading.tsx).
// Without this, clicking a link gives zero response until the queries finish —
// which reads as "nothing happened".
export function LoadingBolt({ accent = '#3D8BFF', label = 'LOADING' }: { accent?: string; label?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: '110px 0',
    }}>
      <span style={{ animation: 'boltPulse 0.9s ease-in-out infinite' }}>
        <Bolt size={34} color={accent} />
      </span>
      <span style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: 3, color: T.faint }}>
        {label}
      </span>
      <style>{'@keyframes boltPulse{0%,100%{opacity:0.35;transform:scale(0.92)}50%{opacity:1;transform:scale(1.06)}}'}</style>
    </div>
  );
}
