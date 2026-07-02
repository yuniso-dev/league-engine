import Link from 'next/link';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';

// Chrome only — the role gate runs in every /admin page (requireAdmin) and
// every mutation (requireAdminAction), so client-side navigation can't skip it.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 0%, #0B3270 0%, #060B18 55%, #04050c 100%)',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Link href="/admin" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: FONT_D, fontSize: 20, letterSpacing: 2, color: T.text }}>
            INAZUMA <span style={{ color: ADMIN_ACCENT }}>ADMIN</span>
          </span>
        </Link>
        <Link
          href="/"
          style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, textDecoration: 'none' }}
        >
          ← Back to site
        </Link>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 64px' }}>
        {children}
      </main>
    </div>
  );
}
