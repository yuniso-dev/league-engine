import type { CSSProperties } from 'react';

export const T = {
  text:  '#EEF3FF',
  dim:   '#94A3C4',
  faint: '#5C6A8C',
  win:   '#3DDC97',
  loss:  '#FF6B6B',
  gold:  '#FFD24A',
} as const;

export type Realm = {
  id: string;
  label: string;
  top: string;
  bottom: string;
  accent: string;
  accent2: string;
};

export const REALMS: Realm[] = [
  { id: 'frontier', label: 'Frontier', top: '#04060D', bottom: '#0B3270', accent: '#3D8BFF', accent2: '#7FB4FF' },
  { id: 'rankings', label: 'Rankings', top: '#070611', bottom: '#281C56', accent: '#8B5CF6', accent2: '#C4A6FF' },
  { id: 'profile',  label: 'Profile',  top: '#120703', bottom: '#5A2708', accent: '#FF7A1A', accent2: '#FFB066' },
];

// Resolved from next/font/google CSS variables — see layout.tsx
export const FONT_D = 'var(--font-display)';
export const FONT_B = 'var(--font-body)';
export const FONT_M = 'var(--font-mono)';

export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const hx = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const mixHex = (h1: string, h2: string, t: number): string => {
  const a = hx(h1), b = hx(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
};

export const lighten = (h: string, t = 0.4): string => mixHex(h, '#FFFFFF', t);

export const rgba = (h: string, a: number | string): string => {
  const [r, g, b] = hx(h);
  return `rgba(${r},${g},${b},${a})`;
};

export type RealmResult = {
  top: string;
  bottom: string;
  accent: string;
  accent2: string;
  accentHex: string;
};

export function realmAt(f: number): RealmResult {
  const i0 = Math.floor(clamp(f, 0, 2));
  const i1 = Math.min(i0 + 1, 2);
  const t = clamp(f - i0, 0, 1);
  const A = REALMS[i0], B = REALMS[i1];
  return {
    top:      mixHex(A.top,    B.top,    t),
    bottom:   mixHex(A.bottom, B.bottom, t),
    accent:   mixHex(A.accent, B.accent, t),
    accent2:  mixHex(A.accent2, B.accent2, t),
    accentHex: t < 0.5 ? A.accent : B.accent,
  };
}

export const rankColor = (r: number | null): string =>
  r === 1 ? '#FFD24A' : r === 2 ? '#C8D2E0' : r === 3 ? '#E0915A' : T.dim;

export const glass = (extra: CSSProperties = {}): CSSProperties => ({
  background:            'rgba(255,255,255,0.05)',
  backdropFilter:        'blur(22px) saturate(1.3)',
  WebkitBackdropFilter:  'blur(22px) saturate(1.3)',
  border:                '1px solid rgba(255,255,255,0.11)',
  borderRadius:          18,
  boxShadow:             '0 10px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
  ...extra,
});
