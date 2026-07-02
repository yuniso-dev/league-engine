import Link from 'next/link';
import { listAdminTournaments } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, STATUS_COLORS } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  await requireAdmin();
  const tournaments = await listAdminTournaments();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
            TOURNAMENTS
          </h1>
          <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
            Create tournaments, build teams and enter results.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/admin/reveal"
            style={{
              padding: '10px 18px',
              background: 'none',
              border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`,
              borderRadius: 10,
              color: ADMIN_ACCENT,
              fontFamily: FONT_D,
              fontSize: 14,
              letterSpacing: 1.5,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ⚡ REVEAL
          </Link>
          <Link
            href="/admin/tournaments/new"
            style={{
              padding: '10px 18px',
              background: ADMIN_ACCENT,
              borderRadius: 10,
              color: '#fff',
              fontFamily: FONT_D,
              fontSize: 14,
              letterSpacing: 1.5,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 18px ${rgba(ADMIN_ACCENT, 0.35)}`,
            }}
          >
            + NEW
          </Link>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div style={glass({ padding: 36, textAlign: 'center' })}>
          <p style={{ fontFamily: FONT_B, color: T.dim, margin: 0 }}>
            No tournaments yet — create the first Frontier.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tournaments.map(t => (
            <Link
              key={t.id}
              href={`/admin/tournaments/${t.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={glass({
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              })}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 17, letterSpacing: 1, color: T.text }}>
                    {t.name}
                  </div>
                  <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, marginTop: 2 }}>
                    Season {t.season}
                    {t.startDate && ` · ${t.startDate}`}
                  </div>
                </div>
                {!t.ranked && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 11, color: T.dim,
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '3px 8px',
                  }}>
                    FRIENDLY
                  </span>
                )}
                <span style={{
                  fontFamily: FONT_M,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: STATUS_COLORS[t.status],
                  border: `1px solid ${rgba(STATUS_COLORS[t.status], 0.4)}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                }}>
                  {t.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
