import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminAward, getCurrentSeason, listAdminTournaments } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import DeleteButton from '@/components/admin/DeleteButton';
import AwardGrantForm from '@/components/admin/AwardGrantForm';
import AwardEditForm from '@/components/admin/AwardEditForm';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';
import { deleteAwardAction, revokeAwardAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 18,
  letterSpacing: 2,
  color: T.text,
  margin: '32px 0 14px',
};

export default async function AdminAwardDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const [detail, tournaments, season] = await Promise.all([
    getAdminAward(params.id),
    listAdminTournaments(),
    getCurrentSeason(),
  ]);
  if (!detail) notFound();

  const { award, grants } = detail;

  return (
    <>
      <Link href="/admin/awards" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← All awards
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AwardBadgeIcon imageUrl={award.imageUrl} icon={award.icon} size={28} />
            {award.name}
          </h1>
          {award.description && (
            <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, margin: '4px 0 0' }}>
              {award.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AwardEditForm award={award} />
          {grants.length === 0 && (
            <DeleteButton
              action={deleteAwardAction}
              hidden={{ awardId: award.id }}
              confirmText={`Delete award "${award.name}"?`}
              label="Delete"
            />
          )}
        </div>
      </div>

      <h2 style={sectionTitle}>GRANTED TO</h2>
      {grants.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
          Not granted to anyone yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {grants.map(g => (
            <div key={g.id} style={glass({
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            })}>
              <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 160 }}>
                {g.displayName}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}>
                {g.tournamentName && `${g.tournamentName} · `}
                {g.season && `Season ${g.season} · `}
                {g.awardedAt.toISOString().slice(0, 10)}
              </span>
              <DeleteButton
                action={revokeAwardAction}
                hidden={{ userAwardId: g.id, awardId: award.id }}
                confirmText={`Revoke this award from ${g.displayName}?`}
              />
            </div>
          ))}
        </div>
      )}

      <AwardGrantForm
        awardId={award.id}
        tournaments={tournaments}
        defaultSeason={season}
      />
    </>
  );
}
