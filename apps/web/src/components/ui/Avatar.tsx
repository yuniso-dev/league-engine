'use client';
import { FONT_D } from '@/lib/realm-colors';

type Props = { initials: string; size?: number; ring?: string | null };

export function Avatar({ initials, size = 44, ring }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,rgba(150,170,230,0.5),rgba(70,90,160,0.35))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_D,
        color: '#fff',
        fontSize: size * 0.34,
        flexShrink: 0,
        border: ring ? `2px solid ${ring}` : '1px solid rgba(255,255,255,0.18)',
        letterSpacing: 1,
      }}
    >
      {initials}
    </div>
  );
}
