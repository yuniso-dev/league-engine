import Link from 'next/link';
import { listAwardsForAdmin } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import AwardForm from '@/components/admin/AwardForm';

export const dynamic = 'force-dynamic';

export default async function AdminAwardsPage() {
  await requireAdmin();
  const awardsList = await listAwardsForAdmin();

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          AWARDS
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Define awards and grant them to players.
        </p>
      </div>

      {awardsList.length === 0 ? (
        <div style={glass({ padding: 36, textAlign: 'center', marginBottom: 20 })}>
          <p style={{ fontFamily: FONT_B, color: T.dim, margin: 0 }}>
            No awards yet — create the first one below.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          {awardsList.map(a => (
            <Link key={a.id} href={`/admin/awards/${a.id}`} style={{ textDecoration: 'none' }}>
              <div style={glass({ padding: 16 })}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.icon && <span style={{ fontSize: 20 }}>{a.icon}</span>}
                  <span style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1, color: T.text }}>
                    {a.name}
                  </span>
                </div>
                {a.description && (
                  <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, marginTop: 8 }}>
                    {a.description}
                  </div>
                )}
                <div style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint, marginTop: 8 }}>
                  {a.grantCount} player{a.grantCount === 1 ? '' : 's'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AwardForm />
    </>
  );
}
