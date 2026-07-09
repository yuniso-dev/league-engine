import Link from 'next/link';
import { getLegacyHall } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import LegacyImportForm from '@/components/admin/LegacyImportForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CATEGORY_LABEL: Record<string, string> = {
  champion: '🏆 Champions',
  golden_boot: '⚽ Golden Boot',
  wallside: '🧱 Wallside',
  sharps: '👟 Sharp’s',
  xavier_frost: '❄️ Xavier Frost',
};

export default async function AdminLegacyPage() {
  const [, hall] = await Promise.all([requireAdmin(), getLegacyHall()]);

  const totalWinners = hall.reduce((n, e) => n + e.winners.length, 0);
  const unresolved = hall.reduce((n, e) => n + e.winners.filter(w => !w.displayName).length, 0);

  return (
    <>
      <Link href="/admin" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <div style={{ margin: '10px 0 24px' }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          LEGACY ARCHIVE
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          The pre-website Frontier editions. Imported honours appear in the Hall of Fame under
          &ldquo;Legacy&rdquo;, and everyone in the archive gets the 🏛️ Legacy tag on their profile.
        </p>
      </div>

      <LegacyImportForm />

      {hall.length > 0 && (
        <>
          <h2 style={{ fontFamily: FONT_D, fontSize: 18, letterSpacing: 2, color: T.text, margin: '32px 0 6px' }}>
            STORED
            <span style={{ color: T.faint, fontSize: 13, marginLeft: 10 }}>
              {hall.length} edition{hall.length === 1 ? '' : 's'} · {totalWinners} honour{totalWinners === 1 ? '' : 's'}
              {unresolved > 0 && ` · ${unresolved} unlinked ID${unresolved === 1 ? '' : 's'}`}
            </span>
          </h2>
          <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: '0 0 14px' }}>
            &ldquo;Unlinked&rdquo; = a Discord ID with no site account yet; it shows as an ID until they sign in.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hall.map(e => (
              <div key={e.edition} style={glass({ padding: '10px 16px' })}>
                <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1, color: T.text, marginBottom: 4 }}>
                  {e.label}
                </div>
                <div style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.dim, lineHeight: 1.7 }}>
                  {Object.keys(CATEGORY_LABEL).map(cat => {
                    const names = e.winners
                      .filter(w => w.category === cat)
                      .map(w => w.displayName ?? `id:${w.discordId.slice(-5)}`);
                    if (names.length === 0) return null;
                    return (
                      <div key={cat}>
                        <span style={{ color: T.faint }}>{CATEGORY_LABEL[cat]}:</span> {names.join(', ')}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
