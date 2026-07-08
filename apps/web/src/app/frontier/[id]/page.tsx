import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTournamentDetail, isSignedUp, runResilient } from '@inazuma/db';
import { auth } from '@/auth';
import { glass, REALMS, T, FONT_D, FONT_B, FONT_M, rgba } from '@/lib/realm-colors';
import { STAGE_LABELS, STATUS_COLORS } from '@/lib/tournament-ui';
import { BackPill } from '@/components/ui/BackPill';
import { LocalTime } from '@/components/ui/LocalTime';
import { LeagueTable } from '@/components/LeagueTable';
import { StatLeaderList } from '@/components/StatLeaderList';
import { SignupCard } from '@/components/SignupCard';

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

export default async function FrontierDetailPage({ params }: Props) {
  // runResilient: timeout → rebuild the pool → retry once, so a dead pooled
  // socket surfaces as a beat of latency instead of the error page.
  const [detail, session] = await Promise.all([
    runResilient(() => getTournamentDetail(params.id)),
    auth(),
  ]);
  if (!detail) notFound();

  const { tournament, teams, matchesByStage, table, stats, signups, startTime } = detail;
  const accent = REALMS[0].accent;

  const isLoggedIn = Boolean(session?.user?.discordId);
  // Button state only — never let it take the page down.
  const signedUp = session?.user?.discordId
    ? await runResilient(() => isSignedUp(session.user.discordId!, tournament.id)).catch(() => false)
    : false;

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
        {stage.matches.map(m => {
          const row = (
            <>
              <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, textAlign: 'right' }}>
                {m.homeTeamName}
              </span>
              <span style={{
                fontFamily: FONT_M, fontSize: 15, color: m.homeScore != null ? T.gold : T.faint,
                minWidth: 64, textAlign: 'center',
              }}>
                {m.homeScore != null ? `${m.homeScore} – ${m.awayScore}` : 'vs'}
                {m.dnf && (
                  <span
                    title="Decided by a side quitting — score may be a forfeit"
                    style={{ display: 'block', fontSize: 9, letterSpacing: 1, color: T.loss }}
                  >
                    DNF
                  </span>
                )}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1 }}>
                {m.awayTeamName}
              </span>
            </>
          );
          const rowStyle = glass({ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 });
          // Recorded games open the match centre (lineups + full stats).
          return m.homeScore != null ? (
            <Link key={m.id} href={`/frontier/match/${m.id}`} title="Match centre — lineups & stats"
              style={{ ...rowStyle, textDecoration: 'none' }}>
              {row}
            </Link>
          ) : (
            <div key={m.id} style={rowStyle}>{row}</div>
          );
        })}
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
                {tournament.winnerName && ` · 🏆 ${tournament.winnerName}`}
              </div>
              {startTime && tournament.status !== 'completed' && (
                <div style={{ fontFamily: FONT_M, fontSize: 12.5, color: accent, marginTop: 8, letterSpacing: 0.3 }}>
                  🗓️ Kicks off <LocalTime iso={startTime.toISOString()} />
                </div>
              )}
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

        {/* signup roster — who's in, and who's actually in voice right now */}
        <SignupCard
          tournamentId={tournament.id}
          status={tournament.status}
          isLoggedIn={isLoggedIn}
          signedUp={signedUp}
          signups={signups}
        />

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
                {/* The honours races — same stats, framed as what's at stake. */}
                <div style={sectionHead}>THE RACES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {stats.topScorers.length > 0 && (
                    <div style={glass({ padding: 16 })}>
                      <StatLeaderList title="BLAZE'S BOOT RACE" emoji="🥇" leaders={stats.topScorers} unit="G" accent={accent} maxVisible={5} />
                    </div>
                  )}
                  {stats.topAssisters.length > 0 && (
                    <div style={glass({ padding: 16 })}>
                      <StatLeaderList title="SHARP'S AWARD RACE" emoji="👑" leaders={stats.topAssisters} unit="A" accent={accent} maxVisible={5} />
                    </div>
                  )}
                  {stats.topCleanSheets.length > 0 && (
                    <div style={glass({ padding: 16 })}>
                      <StatLeaderList title="CLEAN SHEETS" emoji="🧤" leaders={stats.topCleanSheets} unit="CS" accent={accent} maxVisible={5} />
                    </div>
                  )}
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
