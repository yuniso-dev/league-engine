import Link from 'next/link';
import { FONT_D, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { BackPill } from '@/components/ui/BackPill';
import AdminNav from '@/components/admin/AdminNav';

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
        padding: '18px 24px 12px',
      }}>
        <Link href="/admin" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: FONT_D, fontSize: 20, letterSpacing: 2, color: T.text }}>
            INAZUMA <span style={{ color: ADMIN_ACCENT }}>ADMIN</span>
          </span>
        </Link>
        <BackPill href="/" label="BACK TO SITE" accent={ADMIN_ACCENT} />
      </header>
      <AdminNav />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 64px' }}>
        {children}
      </main>
    </div>
  );
}
