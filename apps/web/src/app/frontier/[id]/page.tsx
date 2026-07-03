import { notFound } from 'next/navigation';
import { getTournamentDetail } from '@inazuma/db';
import { glass, REALMS, T, FONT_D, FONT_B, FONT_M, rgba } from '@/lib/realm-colors';
import { STAGE_LABELS, STATUS_COLORS } from '@/lib/tournament-ui';
import { BackPill } from '@/components/ui/BackPill';

export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

export default async function FrontierDetailPage({ params }: Props) {
  const detail = await getTournamentDetail(params.id);
  if (!detail) notFound();

  const { tournament, teams, matchesByStage } = detail;
  const accent = REALMS[0].accent;

  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 50% 70%, ${REALMS[0].bottom} 0%, #04060D 55%, #04050c 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <header style={{ width: '100%', maxWidth: 640, marginBottom: 24 }}>
        <BackPill href="/" label="INAZUMA FC" accent={accent} />
      </header>

      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* header card */}
        <div style={{ ...glass({ padding: 28, borderRadius: 22 }), marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: FONT_D, fontSize: 28, color: T.text, letterSpacing: 1 }}>
                {tournament.name}
              </div>
              <div style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, marginTop: 4 }}>
                Season {tournament.season}
                {tournament.startDate && ` · ${tournament.startDate}`}
                {tournament.winnerName && ` · 🏆 ${tournament.winnerName}`}
              </div>
            </div>
            <span style={{
              fontFamily: FONT_M,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: STATUS_COLORS[tournament.status],
              border: `1px solid ${rgba(STATUS_COLORS[tournament.status], 0.4)}`,
              borderRadius: 6,
              padding: '4px 10px',
            }}>
              {tournament.status}
            </span>
          </div>
        </div>

        {/* teams */}
        {teams.length > 0 && (
          <>
            <div style={{ fontFamily: FONT_D, fontSize: 16, letterSpacing: 1.5, color: T.text, margin: '24px 0 12px' }}>
              TEAMS
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 8,
            }}>
              {teams.map(team => (
                <div key={team.id} style={glass({ padding: 16 })}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1, color: T.text }}>
                    {team.name}
                  </div>
                  <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, marginTop: 8, lineHeight: 1.7 }}>
                    {team.members.length === 0
                      ? <span style={{ color: T.faint }}>No players</span>
                      : team.members.map(m => (
                          <div key={m.publicId}>
                            {team.captainPublicId === m.publicId && (
                              <span style={{ color: T.gold, fontFamily: FONT_M, fontSize: 11 }} title="Captain">© </span>
                            )}
                            {m.displayName}
                            {!m.hidePositions && m.position1 && (
                              <span style={{ color: T.faint, fontFamily: FONT_M, fontSize: 11 }}>
                                {' '}{m.position1}{m.position2 ? `/${m.position2}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* fixtures by stage */}
        <div style={{ fontFamily: FONT_D, fontSize: 16, letterSpacing: 1.5, color: T.text, margin: '24px 0 12px' }}>
          FIXTURES
        </div>
        {matchesByStage.length === 0 ? (
          <div style={glass({ padding: 28, textAlign: 'center' })}>
            <p style={{ fontFamily: FONT_B, color: T.faint, margin: 0 }}>
              Fixtures haven&apos;t been drawn yet.
            </p>
          </div>
        ) : (
          matchesByStage.map(({ stage, matches }) => (
            <div key={stage} style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: FONT_M, fontSize: 11, letterSpacing: 1.5,
                textTransform: 'uppercase', color: accent, marginBottom: 8,
              }}>
                {STAGE_LABELS[stage]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matches.map(m => (
                  <div key={m.id} style={glass({
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  })}>
                    <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, textAlign: 'right' }}>
                      {m.homeTeamName}
                    </span>
                    <span style={{
                      fontFamily: FONT_M, fontSize: 15, color: m.homeScore != null ? T.gold : T.faint,
                      minWidth: 64, textAlign: 'center',
                    }}>
                      {m.homeScore != null ? `${m.homeScore} – ${m.awayScore}` : 'vs'}
                    </span>
                    <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1 }}>
                      {m.awayTeamName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
