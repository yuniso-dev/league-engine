'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FONT_D, rgba, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';

// Persistent section tabs — every admin surface is one tap away from any other.
// Chrome only: the role gate stays in each page (requireAdmin).

const TABS: { href: string; label: string; match: (p: string) => boolean }[] = [
  {
    href: '/admin',
    label: '🏆 Frontiers',
    match: p => p === '/admin' || p.startsWith('/admin/tournaments'),
  },
  { href: '/admin/players', label: '👥 Players', match: p => p.startsWith('/admin/players') },
  { href: '/admin/clubs', label: '📡 Clubs', match: p => p.startsWith('/admin/clubs') },
  { href: '/admin/awards', label: '🏅 Awards', match: p => p.startsWith('/admin/awards') },
  { href: '/admin/legacy', label: '📜 Legacy', match: p => p.startsWith('/admin/legacy') },
  { href: '/admin/reveal', label: '⚡ Reveal', match: p => p.startsWith('/admin/reveal') },
  { href: '/admin/settings', label: '⚙ Settings', match: p => p.startsWith('/admin/settings') },
];

export default function AdminNav() {
  const pathname = usePathname() ?? '/admin';

  return (
    <nav
      className="ina-scroll"
      style={{
        display: 'flex',
        gap: 6,
        padding: '10px 16px',
        overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {TABS.map(tab => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '8px 15px',
              borderRadius: 9,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              fontFamily: FONT_D,
              fontSize: 13,
              letterSpacing: 1,
              color: active ? '#fff' : T.dim,
              background: active ? rgba(ADMIN_ACCENT, 0.28) : 'transparent',
              border: `1px solid ${active ? rgba(ADMIN_ACCENT, 0.6) : 'transparent'}`,
              boxShadow: active ? `0 0 14px ${rgba(ADMIN_ACCENT, 0.25)}` : 'none',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
