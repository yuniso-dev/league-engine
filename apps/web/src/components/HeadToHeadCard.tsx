'use client';
import type { HeadToHead } from '@inazuma/db';
import { T, FONT_D, FONT_B, FONT_M, glass, rgba, lighten } from '@/lib/realm-colors';

// "YOU vs THEM" — the viewer's Frontier rivalry with the player whose profile
// they're looking at. Only rendered when a logged-in viewer opens SOMEONE
// ELSE's profile (ProfilePage gates it), so "you" is always the viewer.

// One stat compared head-to-head: a value each side of a split bar.
function CompareRow({ label, mine, theirs, accent, targetName }: {
  label: string;
  mine: number;
  theirs: number;
  accent: string;
  targetName: string;
}) {
  const total = mine + theirs;
  const minePct = total > 0 ? (mine / total) * 100 : 50;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: FONT_D, fontSize: 15, color: mine >= theirs ? lighten(accent, 0.3) : T.dim }}>{mine}</span>
        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1.5, color: T.faint }}>{label}</span>
        <span style={{ fontFamily: FONT_D, fontSize: 15, color: theirs > mine ? T.text : T.dim }}>{theirs}</span>
      </div>
      <div
        style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.14)' }}
        title={`You ${mine} — ${theirs} ${targetName}`}
      >
        <div style={{ width: `${minePct}%`, background: rgba(accent, 0.9) }} />
      </div>
    </div>
  );
}

export function HeadToHeadCard({ h2h, targetName, accent }: {
  h2h: HeadToHead;
  targetName: string;
  accent: string;
}) {
  const { meetings, wins, draws, losses } = h2h;

  const verdict =
    meetings === 0 ? null
      : wins > losses ? { text: `You lead ${wins}–${losses}`, c: T.win }
        : losses > wins ? { text: `${targetName} leads ${losses}–${wins}`, c: T.loss }
          : { text: `Dead even, ${wins}–${losses}`, c: T.dim };

  const lm = h2h.lastMeeting;
  const lmColor = lm?.result === 'win' ? T.win : lm?.result === 'loss' ? T.loss : T.dim;
  const lmLetter = lm?.result === 'win' ? 'W' : lm?.result === 'loss' ? 'L' : 'D';

  return (
    <div style={{
      ...glass({ padding: '15px 18px', borderRadius: 16 }),
      marginBottom: 12,
      borderTop: `1px solid ${rgba(accent, 0.4)}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 2, color: lighten(accent, 0.25) }}>
          ⚔ HEAD TO HEAD
        </span>
        {verdict && (
          <span style={{ fontFamily: FONT_D, fontSize: 14, color: verdict.c, letterSpacing: 0.4 }}>
            {verdict.text}
          </span>
        )}
      </div>

      {meetings === 0 ? (
        <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '10px 0 0', lineHeight: 1.6 }}>
          {h2h.teammates.meetings > 0
            ? <>You haven&apos;t faced {targetName} on opposing teams yet — so far you&apos;ve only fought side by side.</>
            : <>You haven&apos;t faced {targetName} on opposing teams yet — get drafted against them to start the rivalry.</>}
        </p>
      ) : (
        <>
          {/* W–D–L bar */}
          <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', gap: 2, marginTop: 12 }}>
            {([
              { n: wins, c: T.win, label: `${wins}W` },
              { n: draws, c: T.dim, label: `${draws}D` },
              { n: losses, c: T.loss, label: `${losses}L` },
            ] as const).filter(seg => seg.n > 0).map((seg, i) => (
              <div key={i} style={{
                flexGrow: seg.n, flexBasis: 0, minWidth: 34,
                background: rgba(seg.c, 0.9),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT_D, fontSize: 12, color: '#0A1018',
              }}>
                {seg.label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: T.faint }}>
            <span>YOU</span>
            <span>{meetings} MEETING{meetings === 1 ? '' : 'S'}</span>
            <span style={{ maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {targetName.toUpperCase()}
            </span>
          </div>

          {/* goals + assists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <CompareRow label="GOALS" mine={h2h.goalsFor} theirs={h2h.goalsAgainst} accent={accent} targetName={targetName} />
            <CompareRow label="ASSISTS" mine={h2h.assistsFor} theirs={h2h.assistsAgainst} accent={accent} targetName={targetName} />
          </div>

          {/* last meeting */}
          {lm && (
            <div style={{
              marginTop: 14, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
            }}>
              <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: T.faint }}>LAST MEETING</span>
              <span style={{ fontFamily: FONT_D, fontSize: 13, color: lmColor }}>
                {lmLetter} {lm.ourGoals}–{lm.theirGoals}
              </span>
              <span style={{
                flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 12, color: T.dim,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {lm.tournamentName}
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                {new Date(lm.playedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
        </>
      )}

      {/* the other half of the story — matches fought side by side */}
      {h2h.teammates.meetings > 0 && (
        <div style={{
          marginTop: 14, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: T.faint }}>🤝 AS TEAMMATES</span>
          <span style={{ fontFamily: FONT_D, fontSize: 13 }}>
            <span style={{ color: T.win }}>{h2h.teammates.wins}W</span>
            <span style={{ color: T.faint }}> · </span>
            <span style={{ color: T.dim }}>{h2h.teammates.draws}D</span>
            <span style={{ color: T.faint }}> · </span>
            <span style={{ color: T.loss }}>{h2h.teammates.losses}L</span>
          </span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 12, color: T.dim }}>
            {h2h.teammates.goalsTogether} goal{h2h.teammates.goalsTogether === 1 ? '' : 's'} together
          </span>
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
            {h2h.teammates.meetings} MATCH{h2h.teammates.meetings === 1 ? '' : 'ES'}
          </span>
        </div>
      )}
    </div>
  );
}
