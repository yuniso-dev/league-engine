import Link from 'next/link';
import { previewReveal } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import RevealConfirm from '@/components/admin/RevealConfirm';

export const dynamic = 'force-dynamic';

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 18,
  letterSpacing: 2,
  color: T.text,
  margin: '32px 0 14px',
};

const deltaColor = (d: number): string => (d > 0 ? T.win : d < 0 ? T.loss : T.dim);
const fmtDelta = (d: number): string => `${d > 0 ? '+' : ''}${d.toFixed(1)}`;

export default async function RevealPage() {
  await requireAdmin();
  const preview = await previewReveal();

  return (
    <>
      <Link href="/admin" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <div style={{ marginTop: 10 }}>
        <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
          WEEKLY REVEAL
        </h1>
        <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '4px 0 0' }}>
          Preview of every pending ranked result. Nothing changes until you commit.
          {preview.lastRevealAt && (
            <span style={{ color: T.faint }}>
              {' '}Last reveal: {preview.lastRevealAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.
            </span>
          )}
        </p>
      </div>

      {preview.matches.length === 0 ? (
        <div style={glass({ padding: 36, textAlign: 'center', marginTop: 28 })}>
          <p style={{ fontFamily: FONT_B, color: T.dim, margin: 0 }}>
            No pending ranked matches. Enter results on a tournament page first.
          </p>
        </div>
      ) : (
        <>
          {/* ── Rating movement ── */}
          <h2 style={sectionTitle}>RATING MOVEMENT</h2>
          <div style={glass({ padding: '6px 0', overflow: 'hidden' })}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['PLAYER', 'ELO', 'Δ', 'GAMES', ''].map((h, i) => (
                    <th
                      key={h + i}
                      style={{
                        fontFamily: FONT_M,
                        fontSize: 10,
                        letterSpacing: 1,
                        color: T.faint,
                        textAlign: i === 0 ? 'left' : 'right',
                        padding: '8px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.players.map(p => (
                  <tr key={p.publicId ?? p.displayName}>
                    <td style={{
                      fontFamily: FONT_B, fontSize: 14, color: T.text,
                      padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {p.displayName}
                    </td>
                    <td style={{
                      fontFamily: FONT_M, fontSize: 13, color: T.dim, textAlign: 'right',
                      padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      whiteSpace: 'nowrap',
                    }}>
                      {Math.round(p.oldElo)} → <span style={{ color: T.text }}>{Math.round(p.newElo)}</span>
                    </td>
                    <td style={{
                      fontFamily: FONT_M, fontSize: 13, color: deltaColor(p.delta), textAlign: 'right',
                      padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {fmtDelta(p.delta)}
                    </td>
                    <td style={{
                      fontFamily: FONT_M, fontSize: 13, color: T.dim, textAlign: 'right',
                      padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {p.oldGames} → {p.newGames}
                    </td>
                    <td style={{
                      fontFamily: FONT_M, fontSize: 10, textAlign: 'right',
                      padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {p.wasProvisional && !p.nowProvisional && (
                        <span style={{ color: ADMIN_ACCENT }}>PLACES ⚡</span>
                      )}
                      {p.nowProvisional && (
                        <span style={{ color: T.faint }}>PROVISIONAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Matches in this reveal ── */}
          <h2 style={sectionTitle}>
            MATCHES IN THIS REVEAL
            <span style={{ color: T.faint, fontSize: 13, marginLeft: 10 }}>{preview.matches.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {preview.matches.map(m => (
              <div key={m.id} style={glass({
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              })}>
                <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, minWidth: 110 }}>
                  {m.tournamentName}
                </span>
                <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 200 }}>
                  {m.homeTeamName}
                  <span style={{ fontFamily: FONT_M, color: T.gold, margin: '0 8px' }}>
                    {m.homeScore} – {m.awayScore}
                  </span>
                  {m.awayTeamName}
                </span>
                {m.playedAt && (
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>
                    {m.playedAt.toISOString().slice(0, 10)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Commit ── */}
          <div style={{ ...glass({ padding: 24 }), marginTop: 32 }}>
            <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.dim, margin: '0 0 16px', lineHeight: 1.6 }}>
              Committing applies the ratings above, re-ranks the ladder, writes this week&apos;s
              rating history and locks these matches. This cannot be undone from the admin panel.
            </p>
            <RevealConfirm matchCount={preview.matches.length} playerCount={preview.players.length} />
          </div>
        </>
      )}
    </>
  );
}
