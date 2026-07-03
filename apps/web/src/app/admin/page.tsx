import Link from 'next/link';
import { getAdminStats, listAdminTournaments } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, STATUS_COLORS } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
// Outlive the DB's 15s statement_timeout so a slow query fails cleanly
// into error.tsx instead of being killed mid-stream (stuck-spinner class).
export const maxDuration = 30;

function StatTile({ label, value, sub, href }: { label: string; value: number; sub?: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', flex: '1 1 130px' }}>
      <div style={glass({ padding: '14px 18px' })}>
        <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: T.faint, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: FONT_D, fontSize: 30, color: T.text, lineHeight: 1.2 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontFamily: FONT_B, fontSize: 11.5, color: T.dim }}>{sub}</div>
        )}
      </div>
    </Link>
  );
}

export default async function AdminDashboard() {
  // No waterfall: the role gate and both data reads run concurrently. If the
  // gate rejects, Next aborts the render — nothing below is ever sent.
  const [, tournaments, stats] = await Promise.all([
    requireAdmin(),
    listAdminTournaments(),
    getAdminStats(),
  ]);

  return (
    <>
      {/* league at a glance */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
        <StatTile
          label="Players"
          value={stats.players}
          sub={stats.provisional > 0 ? `${stats.provisional} in placements` : 'all ranked'}
          href="/admin/players"
        />
        <StatTile
          label="Frontiers"
          value={stats.tournaments}
          sub={stats.liveTournaments > 0 ? `${stats.liveTournaments} live now` : 'none live'}
          href="/admin"
        />
        <StatTile
          label="Awards"
          value={stats.awards}
          sub={`${stats.grants} granted`}
          href="/admin/awards"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
            TOURNAMENTS
          </h1>
          <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
            Create tournaments, draft teams and enter results.
          </p>
        </div>
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
