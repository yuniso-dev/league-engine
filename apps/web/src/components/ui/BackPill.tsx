import Link from 'next/link';
import { FONT_D, glass, rgba } from '@/lib/realm-colors';

type Props = { href: string; label: string; accent?: string };

// Prominent back-navigation button — a bordered glass pill instead of a dim
// text link, with client-side navigation via next/link.
export function BackPill({ href, label, accent = '#3D8BFF' }: Props) {
  return (
    <Link
      href={href}
      style={{
        ...glass({
          padding: '9px 18px',
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }),
        border: `1px solid ${rgba(accent, 0.5)}`,
        color: accent,
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      ← {label}
    </Link>
  );
}
