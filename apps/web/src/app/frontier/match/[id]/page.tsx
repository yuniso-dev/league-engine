import Link from 'next/link';
import { notFound } from 'next/navigation';
import { POSITION_BUCKET_LABEL } from '@inazuma/core';
import { getMatchDetail, runResilient, type MatchDetailPlayer } from '@inazuma/db';
import { glass, REALMS, T, FONT_D, FONT_B, FONT_M, rgba } from '@/lib/realm-colors';
import { STAGE_LABELS } from '@/lib/tournament-ui';
import { Avatar } from '@/components/ui/Avatar';
import { PitchLineup, ratingColor } from '@/components/PitchLineup';

// The match centre: one recorded game, both lineups drawn on a pitch, every
// stat the EA ingest captured — the browsable archive behind each result row.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: { id: string } };

function PlayerRow({ p }: { p: MatchDetailPlayer }) {
  const bits = [
    p.goals > 0 ? `⚽ ${p.goals}` : null,
    p.assists > 0 ? `🎯 ${p.assists}` : null,
    p.tackles > 0 ? `🛡 ${p.tackles}` : null,
    p.saves > 0 ? `🧤 ${p.saves} sv` : null,
    p.cleanSheet ? 'CS' : null,
    p.redCards > 0 ? '🟥' : null,
  ].filter(Boolean);

  const guest = p.publicId == null; // played the game, no site account
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    borderRadius: 10, textDecoration: 'none',
    background: p.mom ? rgba('#FFD24A', 0.08) : 'transparent',
    border: p.mom ? `1px solid ${rgba('#FFD24A', 0.3)}` : '1px solid transparent',
    ...(guest ? { opacity: 0.75 } : {}),
  };
  const body = (
    <>
      <Avatar initials={p.displayName.slice(0, 2).toUpperCase()} src={p.avatarUrl} size={26} />
      <span style={{
        flex: 1, fontFamily: FONT_B, fontSize: 13.5, color: guest ? T.dim : T.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {p.displayName}
        {p.mom && <span title="Man of the Match" style={{ marginLeft: 6 }}>⭐</span>}
        {p.excluded && (
          <span title="Excluded from this Frontier's honours (rule violation)" style={{ marginLeft: 6 }}>⚠</span>
        )}
      </span>
      {p.position && (
        <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, minWidth: 28, textAlign: 'center' }}>
          {POSITION_BUCKET_LABEL[p.position]}
        </span>
      )}
      <span style={{ fontFamily: FONT_M, fontSize: 12, color: T.dim, whiteSpace: 'nowrap' }}>
        {bits.join(' · ') || '—'}
      </span>
      <span style={{
        fontFamily: FONT_M, fontSize: 12.5, minWidth: 40, textAlign: 'right',
        color: ratingColor(p.rating),
      }}>
        {p.rating != null ? p.rating.toFixed(1) : '—'}
      </span>
    </>
  );

  return p.publicId != null
    ? <Link href={`/p/${p.publicId}`} style={rowStyle}>{body}</Link>
    : <div title="No site account yet — stats shown by EA name" style={rowStyle}>{body}</div>;
}

export default async function MatchCentrePage({ params }: Props) {
  const match = await runResilient(() => getMatchDetail(params.id));
  if (!match) notFound();

  const accent = REALMS[0].accent;
  const scored = match.home.score !== null;

  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 50% 70%, ${REALMS[0].bottom} 0%, #04060D 55%, #04050c 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <Link
          href={`/frontier/${match.tournamentId}`}
          style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}
        >
          ← {match.tournamentName}
        </Link>

        {/* ── Scoreline header ── */}
        <div style={{ ...glass({ padding: '22px 20px' }), marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: 2, color: accent, marginBottom: 10 }}>
            {STAGE_LABELS[match.stage]}
            {match.playedAt && ` · ${match.playedAt.toISOString().slice(0, 10)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_D, fontSize: 21, letterSpacing: 1, color: T.text, flex: 1, textAlign: 'right', minWidth: 120 }}>
              {match.home.name}
            </span>
            <span style={{ fontFamily: FONT_D, fontSize: 30, color: scored ? T.gold : T.faint, whiteSpace: 'nowrap' }}>
              {scored ? `${match.home.score} – ${match.away.score}` : 'vs'}
            </span>
            <span style={{ fontFamily: FONT_D, fontSize: 21, letterSpacing: 1, color: T.text, flex: 1, textAlign: 'left', minWidth: 120 }}>
              {match.away.name}
            </span>
          </div>
          {match.dnf && (
            <div
              title="Decided by a side quitting — the score may be a forfeit"
              style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: 1.5, color: T.loss, marginTop: 8 }}
            >
              ⚠ DNF — a side did not finish this match
            </div>
          )}
        </div>

        {/* ── Lineups ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 14, marginTop: 14,
        }}>
          {[match.home, match.away].map(side => (
            <div key={side.teamId} style={glass({ padding: 16 })}>
              <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.text, marginBottom: 10 }}>
                {side.name}
              </div>
              {side.players.length === 0 ? (
                <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: 0 }}>
                  No player stats on record — players need their EA ID linked for stats to attach.
                </p>
              ) : (
                <>
                  {/* the lineup, drawn where EA said everyone played */}
                  <PitchLineup players={side.players} accent={accent} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontFamily: FONT_M, fontSize: 9, color: T.faint, padding: '0 10px 2px' }}>
                      RATING
                    </div>
                    {side.players.map(p => <PlayerRow key={p.publicId ?? p.displayName} p={p} />)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, textAlign: 'center', marginTop: 16 }}>
          ⭐ Man of the Match · ratings and positions come from EA FC · tap a player for their full profile
          · dimmed players haven&apos;t linked a site account yet
        </p>
      </div>
    </div>
  );
}
