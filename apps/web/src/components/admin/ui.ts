import type { CSSProperties } from 'react';
import { FONT_B, T } from '@/lib/realm-colors';

export { STAGE_LABELS, STATUS_COLORS } from '@/lib/tournament-ui';

export const ADMIN_ACCENT = '#3D8BFF';

export const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: FONT_B,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: T.dim,
  marginBottom: 6,
};

export const inputBase: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

