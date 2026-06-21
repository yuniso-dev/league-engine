'use client';
import type { CSSProperties } from 'react';
import { T } from '@/lib/realm-colors';

type Props = { size?: number; color?: string; style?: CSSProperties };

export function Bolt({ size = 20, color = T.gold, style }: Props) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 20 28"
      fill={color}
      style={style}
    >
      <path d="M12 1L2 16h8l-2 11L20 12h-8.5L12 1z" />
    </svg>
  );
}
