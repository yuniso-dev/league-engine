import { getConfig } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import SettingsForm from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin();
  const config = await getConfig();

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          SETTINGS
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Tune the league. Changes apply to the next weekly reveal, not existing history.
        </p>
      </div>

      <SettingsForm config={config} />
    </>
  );
}
