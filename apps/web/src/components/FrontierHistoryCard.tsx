import Link from 'next/link';
import type { FrontierHistoryEntry } from '@inazuma/db';
import { T, FONT_D, FONT_B, FONT_M, rgba } from '@/lib/realm-colors';

// FRONTIER HISTORY — a player's tournament record: career totals up top, then
// one row per Frontier they appeared in (champion runs wear the gold trophy).
// Server-safe (no hooks): rendered inside the client ProfilePage AND the
// server /p/[publicId] share page. The parent supplies the card chrome.

function TotalTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 10,
      padding: '9px 2px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: FONT_D, fontSize: 17, color: color ?? T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: FONT_M, fontSize: 7.5, letterSpacing: 1, color: T.faint, marginTop: 3 }}>{label}</div>
    </div>
  );
}

export function FrontierHistoryCard({ history, accent, isOwn = false }: {
  history: FrontierHistoryEntry[];
  accent: string;
  isOwn?: boolean;
}) {
  if (history.length === 0) {
    return (
      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: 0, lineHeight: 1.65 }}>
        {isOwn
          ? 'No Frontiers on record yet — sign up for the next one and your history starts here.'
          : 'No Frontiers on record — this player is yet to step onto the pitch.'}
      </p>
    );
  }

  // Career totals across every Frontier.
  const totals = history.reduce(
    (acc, h) => ({
      played: acc.played + h.played,
      wins: acc.wins + h.wins,
      draws: acc.draws + h.draws,
      losses: acc.losses + h.losses,
      goals: acc.goals + h.goals,
      assists: acc.assists + h.assists,
    }),
    { played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0 },
  );
  const titles = history.filter(h => h.champion).length;

  return (
    <div>
      {/* career totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 12 }}>
        <TotalTile label="GP" value={totals.played} />
        <TotalTile label="W" value={totals.wins} color={T.win} />
        <TotalTile label="D" value={totals.draws} color={T.dim} />
        <TotalTile label="L" value={totals.losses} color={T.loss} />
        <TotalTile label="G" value={totals.goals} />
        <TotalTile label="A" value={totals.assists} />
      </div>

      {titles > 0 && (
        <div style={{
          fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.gold,
          marginBottom: 10,
        }}>
          🏆 {titles} FRONTIER TITLE{titles === 1 ? '' : 'S'}
        </div>
      )}

      {/* one row per Frontier, newest first */}
      <div
        className="ina-scroll"
        style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 264, overflowY: 'auto' }}
      >
        {history.map(h => (
          <Link
            key={h.tournamentId}
            href={`/frontier/${h.tournamentId}`}
            className="tap"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              textDecoration: 'none',
              padding: '8px 10px', borderRadius: 10,
              background: h.champion ? rgba(T.gold, 0.07) : 'rgba(255,255,255,0.03)',
              border: `1px solid ${h.champion ? rgba(T.gold, 0.25) : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>
              {h.champion ? '🏆' : '⚡'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block',
                fontFamily: FONT_D, fontSize: 13.5, letterSpacing: 0.5,
                color: h.champion ? T.gold : T.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {h.name.toUpperCase()}
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 9, color: T.faint }}>
                SEASON {h.season}{h.startDate ? ` · ${h.startDate}` : ''}
              </span>
            </span>
            <span style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ display: 'block', fontFamily: FONT_D, fontSize: 12 }}>
                <span style={{ color: T.win }}>{h.wins}W</span>
                <span style={{ color: T.faint }}>·</span>
                <span style={{ color: T.dim }}>{h.draws}D</span>
                <span style={{ color: T.faint }}>·</span>
                <span style={{ color: T.loss }}>{h.losses}L</span>
              </span>
              <span style={{ fontFamily: FONT_M, fontSize: 9, color: rgba(accent, 0.9) }}>
                {h.goals}G {h.assists}A
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
