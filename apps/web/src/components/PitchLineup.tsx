import Link from 'next/link';
import type { MatchDetailPlayer } from '@inazuma/db';
import type { PositionBucket } from '@inazuma/core';
import { FONT_B, FONT_M, T, rgba } from '@/lib/realm-colors';
import { Avatar } from '@/components/ui/Avatar';

// One team's lineup drawn on a football pitch — GK at the bottom, forwards at
// the top, everyone placed on the line EA said they played. Pure server
// component; each player links to their profile and carries their match
// rating as a colour-coded badge. Players with no position data (manual
// entries before the EA link) sit in a bench strip under the pitch.

const MOTM_GOLD = '#FFD24A';

/** Shared rating → colour scale (great / decent / poor). */
export function ratingColor(rating: number | null): string {
  if (rating == null) return T.faint;
  if (rating >= 8) return T.win;
  if (rating >= 6.5) return T.gold;
  return T.loss;
}

/** Bottom (GK) → top (FWD) — rendered top-first, so reverse. */
const LINES: PositionBucket[] = ['forward', 'midfielder', 'defender', 'goalkeeper'];

const line: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, border: '1px solid rgba(255,255,255,0.07)',
  pointerEvents: 'none',
};

/** The pitch markings — border, boxes, centre arc — all faint glass lines. */
function Markings() {
  return (
    <>
      {/* touchline */}
      <div style={{ ...line, top: 10, bottom: 10, left: 10, right: 10, borderRadius: 10 }} />
      {/* centre "half" arc at the top edge */}
      <div style={{
        ...line, top: -36, left: '50%', width: 92, height: 92, marginLeft: -46, borderRadius: '50%',
      }} />
      {/* penalty box + six-yard box in front of the GK */}
      <div style={{ ...line, bottom: 10, left: '22%', right: '22%', height: '19%', borderBottom: 'none' }} />
      <div style={{ ...line, bottom: 10, left: '36%', right: '36%', height: '8%', borderBottom: 'none' }} />
      {/* penalty arc */}
      <div style={{
        ...line, bottom: 'calc(19% - 12px)', left: '50%', width: 56, height: 56, marginLeft: -28,
        borderRadius: '50%',
      }} />
    </>
  );
}

function PlayerChip({ p }: { p: MatchDetailPlayer }) {
  const rc = ratingColor(p.rating);
  const guest = p.publicId == null; // played the game, no site account
  const title = `${p.displayName}${p.rating != null ? ` — rated ${p.rating.toFixed(1)}` : ''}${p.mom ? ' · Man of the Match' : ''}${guest ? ' · no site account yet' : ''}`;
  const style: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    width: 76, textDecoration: 'none',
    ...(guest ? { opacity: 0.75 } : {}),
  };
  const body = (
    <>
      <span style={{
        position: 'relative', display: 'inline-flex', borderRadius: '50%',
        boxShadow: p.mom ? `0 0 0 2px ${MOTM_GOLD}, 0 0 16px ${rgba(MOTM_GOLD, 0.45)}` : 'none',
      }}>
        <Avatar initials={p.displayName.slice(0, 2).toUpperCase()} src={p.avatarUrl} size={42} />
        {p.mom && (
          <span style={{ position: 'absolute', top: -9, right: -7, fontSize: 12 }} title="Man of the Match">⭐</span>
        )}
        {p.redCards > 0 && (
          <span style={{
            position: 'absolute', top: -5, left: -6, width: 8, height: 11, borderRadius: 2,
            background: T.loss, boxShadow: `0 0 6px ${rgba(T.loss, 0.7)}`,
          }} title="Red card" />
        )}
        {p.rating != null && (
          <span style={{
            position: 'absolute', bottom: -6, right: -10,
            fontFamily: FONT_M, fontSize: 10, lineHeight: 1, padding: '3px 5px', borderRadius: 7,
            background: 'rgba(4,6,13,0.92)', border: `1px solid ${rgba(rc, 0.55)}`, color: rc,
          }}>
            {p.rating.toFixed(1)}
          </span>
        )}
      </span>
      <span className="pitch-chip-name" style={{
        fontFamily: FONT_B, fontSize: 11, color: guest ? T.dim : T.text, maxWidth: 76, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {p.displayName}
      </span>
    </>
  );

  return p.publicId != null
    ? <Link className="pitch-chip" href={`/p/${p.publicId}`} title={title} style={style}>{body}</Link>
    : <span className="pitch-chip" title={title} style={style}>{body}</span>;
}

export function PitchLineup({ players, accent }: { players: MatchDetailPlayer[]; accent: string }) {
  const placed = LINES.map(bucket => players.filter(p => p.position === bucket));
  const bench = players.filter(p => p.position == null);
  const anyPlaced = placed.some(l => l.length > 0);

  return (
    <div>
      {anyPlaced && (
        <div style={{
          position: 'relative', minHeight: 320, borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: `
            radial-gradient(ellipse at 50% -10%, ${rgba(accent, 0.13)}, transparent 55%),
            repeating-linear-gradient(180deg, rgba(255,255,255,0.016) 0 40px, rgba(255,255,255,0) 40px 80px),
            linear-gradient(180deg, rgba(18,26,46,0.55), rgba(8,11,22,0.65))`,
        }}>
          <Markings />
          <div style={{
            position: 'relative', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', minHeight: 320, padding: '20px 8px 16px',
          }}>
            {placed.map((linePlayers, i) => (
              <div key={LINES[i]} style={{
                display: 'flex', justifyContent: 'space-evenly', alignItems: 'center',
                flexWrap: 'wrap', gap: 4, minHeight: 58,
              }}>
                {linePlayers.map(p => <PlayerChip key={p.publicId ?? p.displayName} p={p} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {bench.length > 0 && (
        <div style={{ marginTop: anyPlaced ? 10 : 0 }}>
          {anyPlaced && (
            <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1.5, color: T.faint, marginBottom: 6 }}>
              NO POSITION DATA
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px' }}>
            {bench.map(p => <PlayerChip key={p.publicId ?? p.displayName} p={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
