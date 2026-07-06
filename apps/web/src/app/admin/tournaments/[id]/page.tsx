import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeGroupTable, getAdminTournament } from '@inazuma/db';
import { requireAdmin } from '@/lib/admin';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, STAGE_LABELS, STATUS_COLORS } from '@/components/admin/ui';
import StatusControls from '@/components/admin/StatusControls';
import TeamForm from '@/components/admin/TeamForm';
import TeamClubLink from '@/components/admin/TeamClubLink';
import MatchEntryForm from '@/components/admin/MatchEntryForm';
import DeleteButton from '@/components/admin/DeleteButton';
import BracketControls from '@/components/admin/BracketControls';
import FixtureResultForm from '@/components/admin/FixtureResultForm';
import MatchStatsForm from '@/components/admin/MatchStatsForm';
import { LeagueTable } from '@/components/LeagueTable';
import { deleteMatchAction, deleteTeamAction, deleteTournamentAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_D,
  fontSize: 18,
  letterSpacing: 2,
  color: T.text,
  margin: '36px 0 14px',
};

export default async function AdminTournamentPage({ params }: { params: { id: string } }) {
  // Role gate + tournament in one concurrent pass — no request waterfall.
  const [, detail] = await Promise.all([requireAdmin(), getAdminTournament(params.id)]);
  if (!detail) notFound();

  const { tournament, teams, matches } = detail;
  const winnerName = tournament.winnerTeamId
    ? teams.find(t => t.id === tournament.winnerTeamId)?.name ?? null
    : null;
  const takenPublicIds = teams.flatMap(t => t.members.map(m => m.publicId));

  const fixtures = matches.filter(m => m.homeScore === null || m.awayScore === null);
  const results = matches.filter(m => m.homeScore !== null && m.awayScore !== null);
  const membersOf = (teamId: string) => teams.find(t => t.id === teamId)?.members ?? [];

  const groupMatches = matches.filter(m => m.stage === 'group');
  const hasKnockout = matches.some(m => m.stage !== 'group' && m.stage !== 'friendly');
  const groupComplete = groupMatches.length > 0 &&
    groupMatches.every(m => m.homeScore !== null && m.awayScore !== null);
  const table = groupMatches.length > 0 ? await computeGroupTable(tournament.id) : null;

  return (
    <>
      <Link href="/admin" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
        ← All tournaments
      </Link>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontFamily: FONT_D, fontSize: 26, letterSpacing: 2, color: T.text, margin: 0 }}>
            {tournament.name}
          </h1>
          <p style={{ fontFamily: FONT_B, fontSize: 14, color: T.faint, margin: '4px 0 0' }}>
            Season {tournament.season}
            {!tournament.ranked && ' · Friendly'}
            {tournament.startDate && ` · ${tournament.startDate}`}
            {winnerName && ` · 🏆 ${winnerName}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
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
          <Link
            href={`/admin/tournaments/${tournament.id}/draft`}
            style={{
              fontFamily: FONT_D,
              fontSize: 13,
              letterSpacing: 1,
              color: ADMIN_ACCENT,
              border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`,
              borderRadius: 8,
              padding: '6px 14px',
              textDecoration: 'none',
            }}
          >
            🧢 DRAFT BOARD
          </Link>
          <Link
            href={`/admin/tournaments/${tournament.id}/edit`}
            style={{
              fontFamily: FONT_B,
              fontSize: 13,
              color: T.dim,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 7,
              padding: '6px 14px',
              textDecoration: 'none',
            }}
          >
            Edit
          </Link>
          <DeleteButton
            action={deleteTournamentAction}
            hidden={{ tournamentId: tournament.id }}
            confirmText={`Delete tournament "${tournament.name}"? This also removes its teams and match results.`}
            label="Delete"
          />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <StatusControls
          tournamentId={tournament.id}
          status={tournament.status}
          winnerTeamId={tournament.winnerTeamId}
          teams={teams.map(t => ({ id: t.id, name: t.name }))}
        />
      </div>

      {/* ── Teams ── */}
      <h2 style={sectionTitle}>TEAMS</h2>
      {teams.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
          No teams yet — create the drafted teams below, then enter matches.
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}>
          {teams.map(team => (
            <div key={team.id} style={glass({ padding: 16 })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1, color: T.text }}>
                  {team.name}
                </span>
                {team.matchCount === 0 && (
                  <DeleteButton
                    action={deleteTeamAction}
                    hidden={{ teamId: team.id, tournamentId: tournament.id }}
                    confirmText={`Delete team "${team.name}"?`}
                  />
                )}
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
                        {m.position1 && (
                          <span style={{ color: T.faint, fontFamily: FONT_M, fontSize: 11 }}>
                            {' '}{m.position1}{m.position2 ? `/${m.position2}` : ''}
                          </span>
                        )}
                      </div>
                    ))}
              </div>
              {team.matchCount > 0 && (
                <div style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, marginTop: 8 }}>
                  {team.matchCount} match{team.matchCount === 1 ? '' : 'es'}
                </div>
              )}
              <TeamClubLink teamId={team.id} tournamentId={tournament.id} eaClubId={team.eaClubId} />
            </div>
          ))}
        </div>
      )}
      <TeamForm
        tournamentId={tournament.id}
        takenPublicIds={takenPublicIds}
      />

      {/* ── Fixtures ── */}
      <h2 style={sectionTitle}>FIXTURES</h2>
      {matches.length === 0 ? (
        teams.length >= 2 ? (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 12px' }}>
              <strong style={{ color: T.dim }}>Group stage</strong> gives every team a game against every
              other team and builds a league table, then the knockout is seeded from the standings —
              the usual Frontier format. <strong style={{ color: T.dim }}>Random knockout</strong> skips
              straight to a cup draw (needs 2, 4, 8 or 16 teams).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teams.length >= 3 && (
                <BracketControls tournamentId={tournament.id} mode="group" teamCount={teams.length} />
              )}
              <BracketControls tournamentId={tournament.id} mode="draw" teamCount={teams.length} />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
            Add the teams first, then generate the fixtures here.
          </p>
        )
      ) : (
        <>
          {fixtures.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {fixtures.map(m => (
                <FixtureResultForm
                  key={m.id}
                  tournamentId={tournament.id}
                  match={m}
                  homeMembers={membersOf(m.homeTeamId)}
                  awayMembers={membersOf(m.awayTeamId)}
                />
              ))}
            </div>
          )}
          {fixtures.length === 0 && groupComplete && !hasKnockout && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 12px' }}>
                The group stage is complete — draw the knockout from the standings
                ({teams.length >= 5 ? 'top 4 → semi-finals' : 'top 2 → straight final'}).
              </p>
              <BracketControls tournamentId={tournament.id} mode="knockout" teamCount={teams.length} />
            </div>
          )}
          {fixtures.length === 0 && hasKnockout && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 12px' }}>
                Every fixture in the current round has a result.
              </p>
              <BracketControls tournamentId={tournament.id} mode="next" teamCount={teams.length} />
            </div>
          )}
        </>
      )}

      {/* ── League table (group stage) ── */}
      {table && table.length > 0 && (
        <>
          <h2 style={sectionTitle}>
            TABLE
            {!groupComplete && (
              <span style={{ color: T.faint, fontSize: 12, marginLeft: 10, letterSpacing: 0.5 }}>
                live — updates as group results go in
              </span>
            )}
          </h2>
          <div style={{ marginBottom: 16 }}>
            <LeagueTable
              rows={table}
              accent={ADMIN_ACCENT}
              qualifyCount={hasKnockout || groupComplete ? (teams.length >= 5 ? 4 : 2) : 0}
            />
          </div>
        </>
      )}

      {/* ── Results ── */}
      <h2 style={sectionTitle}>RESULTS</h2>
      {results.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14, margin: '0 0 16px' }}>
          No results entered yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {results.map(m => (
            <div key={m.id} style={glass({
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            })}>
              <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, minWidth: 86 }}>
                {STAGE_LABELS[m.stage]}
              </span>
              <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 200 }}>
                {m.homeTeamName}
                <span style={{ fontFamily: FONT_M, color: T.gold, margin: '0 8px' }}>
                  {m.homeScore} – {m.awayScore}
                </span>
                {m.awayTeamName}
              </span>
              {!m.ranked && (
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>UNRANKED</span>
              )}
              {m.playedAt && (
                <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>
                  {m.playedAt.toISOString().slice(0, 10)}
                </span>
              )}
              {m.processed ? (
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.win }}>PROCESSED</span>
              ) : (
                <DeleteButton
                  action={deleteMatchAction}
                  hidden={{ matchId: m.id, tournamentId: tournament.id }}
                  confirmText="Delete this match result?"
                />
              )}
              {/* goals / assists / clean sheets — feeds leaderboards + milestones */}
              <MatchStatsForm matchId={m.id} tournamentId={tournament.id} />
            </div>
          ))}
        </div>
      )}
      {teams.length >= 2 ? (
        <MatchEntryForm
          tournamentId={tournament.id}
          teams={teams}
          defaultRanked={tournament.ranked}
        />
      ) : (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 14 }}>
          Add at least two teams to enter match results.
        </p>
      )}
    </>
  );
}
