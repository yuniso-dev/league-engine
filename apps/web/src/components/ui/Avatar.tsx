'use client';
import Image from 'next/image';
import { FONT_D } from '@/lib/realm-colors';

type Props = { initials: string; src?: string | null; size?: number; ring?: string | null };

export function Avatar({ initials, src, size = 44, ring }: Props) {
  const border = ring ? `2px solid ${ring}` : '1px solid rgba(255,255,255,0.18)';
  const shape: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, border,
  };

  if (src) {
    return (
      <div style={{ ...shape, overflow: 'hidden' }}>
        <Image src={src} alt={initials} width={size} height={size} style={{ objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        ...shape,
        background: 'linear-gradient(135deg,rgba(150,170,230,0.5),rgba(70,90,160,0.35))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_D, color: '#fff', fontSize: size * 0.34, letterSpacing: 1,
      }}
    >
      {initials}
    </div>
  );
}
