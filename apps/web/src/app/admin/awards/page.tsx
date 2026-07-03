import { getCurrentSeason, listAdminTournaments, listAwardsWithHolders } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import AwardsHub from '@/components/admin/AwardsHub';
import AwardForm from '@/components/admin/AwardForm';
import AwardPresets from '@/components/admin/AwardPresets';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function AdminAwardsPage() {
  // Role gate + all page data in one concurrent pass — no request waterfall.
  const [, awardsList, tournaments, season] = await Promise.all([
    requireAdmin(),
    listAwardsWithHolders(),
    listAdminTournaments(),
    getCurrentSeason(),
  ]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          AWARDS
          <span style={{ color: T.faint, fontSize: 15, marginLeft: 12, letterSpacing: 1 }}>
            {awardsList.length}
          </span>
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Grant straight from a card, or open MANAGE to edit and revoke.
        </p>
      </div>

      <AwardsHub awards={awardsList} tournaments={tournaments} defaultSeason={season} />
      <AwardPresets existingNames={awardsList.map(a => a.name)} />
      <AwardForm />
    </>
  );
}
