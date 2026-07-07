import Link from 'next/link';
import { listTrackedClubs } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import AddClubsForm from '@/components/admin/AddClubsForm';
import DeleteButton from '@/components/admin/DeleteButton';
import { removeTrackedClubAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Tracked community clubs: registered here (or via /trackclub), synced by the
// bot round-robin, shown publicly under CASUAL → CLUBS.

const chip: React.CSSProperties = {
  fontFamily: FONT_M,
  fontSize: 11,
  color: T.dim,
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 6,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
};

function ago(d: Date | null): string {
  if (!d) return 'never';
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export default async function AdminClubsPage() {
  const [, clubs] = await Promise.all([requireAdmin(), listTrackedClubs()]);

  return (
    <>
      <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: '0 0 6px' }}>
        📡 TRACKED CLUBS
      </h1>
      <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.dim, margin: '0 0 20px', lineHeight: 1.6, maxWidth: 640 }}>
        The community&apos;s EA clubs, shown publicly under <b style={{ color: T.text }}>CASUAL → CLUBS</b>.
        The bot refreshes a few clubs every couple of minutes — with 30 tracked, every club stays
        under ~25 minutes stale. The site never talks to EA directly, so club pages load instantly
        even when EA is down.
      </p>

      <AddClubsForm />

      <h2 style={{ fontFamily: FONT_D, fontSize: 17, letterSpacing: 2, color: T.text, margin: '28px 0 12px' }}>
        TRACKING
        <span style={{ color: T.faint, fontSize: 13, marginLeft: 10 }}>{clubs.length}</span>
      </h2>

      {clubs.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14 }}>
          No clubs tracked yet — paste IDs above or run /trackclub in Discord.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clubs.map(c => (
            <div key={c.clubId} style={glass({
              padding: '11px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            })}>
              <div style={{ flex: 1, minWidth: 180 }}>
                {c.name ? (
                  <Link
                    href={`/casual/club/${c.clubId}`}
                    style={{ fontFamily: FONT_B, fontWeight: 700, fontSize: 14.5, color: T.text, textDecoration: 'none' }}
                  >
                    {c.name} ↗
                  </Link>
                ) : (
                  <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, fontStyle: 'italic' }}>
                    awaiting first sync…
                  </span>
                )}
              </div>
              <span style={chip}>ID {c.clubId}</span>
              {c.overall && <span style={chip}>{c.overall.wins}-{c.overall.ties}-{c.overall.losses}</span>}
              {c.members && <span style={chip}>{c.members.length} MEMBERS</span>}
              <span style={{ ...chip, color: c.fetchedAt ? T.dim : T.faint }}>⟳ {ago(c.fetchedAt)}</span>
              {c.fetchError && (
                <span style={{ ...chip, color: T.loss, borderColor: 'rgba(255,107,107,0.4)' }} title={c.fetchError}>
                  ⚠ {c.fetchError.startsWith('partial') ? 'PARTIAL' : 'EA UNREACHABLE'}
                </span>
              )}
              <DeleteButton
                action={removeTrackedClubAction}
                hidden={{ clubId: c.clubId }}
                confirmText={`Stop tracking ${c.name ?? `club ${c.clubId}`}? Its page disappears from the site (re-adding re-syncs everything).`}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
