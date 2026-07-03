import { notFound } from 'next/navigation';
import { getTournamentDetail } from '@inazuma/db';
import type { StatLeader } from '@inazuma/db';
import { glass, REALMS, T, FONT_D, FONT_B, FONT_M, rgba } from '@/lib/realm-colors';
import { STAGE_LABELS, STATUS_COLORS } from '@/lib/tournament-ui';
import { BackPill } from '@/components/ui/BackPill';
import { Avatar } from '@/components/ui/Avatar';
import { LeagueTable } from '@/components/LeagueTable';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: { id: string } };

const sectionHead: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 16,
  letterSpacing: 1.5,
  color: T.text,
  margin: '24px 0 12px',
};

function LeaderList({ title, emoji, leaders, unit, accent }: {
  title: string; emoji: string; leaders: StatLeader[]; unit: string; accent: string;
}) {
  if (leaders.length === 0) return null;
  return (
    <div style={glass({ padding: 16 })}>
      <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: accent, marginBottom: 10 }}>
        {emoji} {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {leaders.map((l, i) => (
          <div key={l.publicId} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: FONT_D, fontSize: 12, color: i === 0 ? T.gold : T.faint, width: 13 }}>
              {i + 1}
            </span>
            <Avatar initials={l.displayName.slice(0, 2).toUpperCase()} src={l.avatarUrl} size={24} />
            <span style={{
              fontFamily: FONT_B, fontSize: 13.5, color: T.text, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {l.displayName}
            </span>
            <span style={{ fontFamily: FONT_D, fontSize: 15, color: i === 0 ? T.gold : T.dim }}>
              {l.value}
              <span style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, marginLeft: 2 }}>{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function FrontierDetailPage({ params }: Props) {
  const detail = await getTournamentDetail(params.id);
  if (!detail) notFound();

  const { tournament, teams, matchesByStage, table, stats } = detail;
  const accent = REALMS[0].accent;

  const groupStages = matchesByStage.filter(s => s.stage === 'group');
  const knockoutStages = matchesByStage.filter(s => s.stage !== 'group');
  const hasLeaders =
    stats.topScorers.length > 0 || stats.topAssisters.length > 0 || stats.topCleanSheets.length > 0;

  const renderStage = (stage: (typeof matchesByStage)[number]) => (
    <div key={stage.stage} style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: FONT_M, fontSize: 11, letterSpacing: 1.5,
        textTransform: 'uppercase', color: accent, marginBottom: 8,
      }}>
        {STAGE_LABELS[stage.stage]}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stage.matches.map(m => (
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
  );

  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 50% 70%, ${REALMS[0].bottom} 0%, #04060D 55%, #04050c 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <header className="fr-wrap" style={{ width: '100%', maxWidth: 640, marginBottom: 24 }}>
        <BackPill href="/" label="INAZUMA FC" accent={accent} />
      </header>

      <div className="fr-wrap" style={{ width: '100%', maxWidth: 640 }}>
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

        {/* two columns on PC: table + group fixtures left, knockout + leaders right */}
        <div className="fr-grid">
          <div className="fr-col">
            {table && table.length > 0 && (
              <>
                <div style={sectionHead}>TABLE</div>
                <LeagueTable
                  rows={table}
                  accent={accent}
                  qualifyCount={knockoutStages.length > 0 ? (table.length >= 5 ? 4 : 2) : 0}
                />
              </>
            )}

            {groupStages.length > 0 && (
              <>
                <div style={sectionHead}>GROUP FIXTURES</div>
                {groupStages.map(renderStage)}
              </>
            )}
          </div>

          <div className="fr-col">
            {knockoutStages.length > 0 && (
              <>
                <div style={sectionHead}>KNOCKOUT</div>
                {knockoutStages.map(renderStage)}
              </>
            )}

            {hasLeaders && (
              <>
                <div style={sectionHead}>LEADERS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <LeaderList title="TOP SCORERS" emoji="⚽" leaders={stats.topScorers} unit="G" accent={accent} />
                  <LeaderList title="TOP ASSISTS" emoji="🎯" leaders={stats.topAssisters} unit="A" accent={accent} />
                  <LeaderList title="CLEAN SHEETS" emoji="🧤" leaders={stats.topCleanSheets} unit="CS" accent={accent} />
                </div>
              </>
            )}
          </div>
        </div>

        {matchesByStage.length === 0 && (
          <div style={glass({ padding: 28, textAlign: 'center' })}>
            <p style={{ fontFamily: FONT_B, color: T.faint, margin: 0 }}>
              Fixtures haven&apos;t been drawn yet.
            </p>
          </div>
        )}

        {/* teams */}
        {teams.length > 0 && (
          <>
            <div style={sectionHead}>TEAMS</div>
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
      </div>
    </div>
  );
}
