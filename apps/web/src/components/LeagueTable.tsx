import type { LeagueTableRow } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';

// Group-stage standings. Server-safe (no hooks) so both the public frontier
// page and the admin tournament page can render it.

type Props = {
  rows: LeagueTableRow[];
  accent: string;
  /** How many qualify for the knockout (highlighted). 0 = no highlight. */
  qualifyCount?: number;
};

const cell: React.CSSProperties = {
  fontFamily: FONT_M,
  fontSize: 12,
  color: T.dim,
  textAlign: 'center',
  padding: '9px 4px',
  whiteSpace: 'nowrap',
};

export function LeagueTable({ rows, accent, qualifyCount = 0 }: Props) {
  if (rows.length === 0) return null;

  return (
    <div style={{ ...glass({ padding: '6px 10px' }), overflowX: 'auto' }} className="ina-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
        <thead>
          <tr>
            {['#', 'TEAM', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS'].map((h, i) => (
              <th
                key={h}
                style={{
                  ...cell,
                  color: T.faint,
                  fontSize: 9,
                  letterSpacing: 1,
                  textAlign: i === 1 ? 'left' : 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const qualifies = qualifyCount > 0 && i < qualifyCount;
            return (
              <tr
                key={r.teamId}
                style={{
                  background: qualifies ? rgba(accent, 0.07) : 'none',
                  borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <td style={{
                  ...cell,
                  fontFamily: FONT_D,
                  fontSize: 13,
                  color: qualifies ? accent : T.faint,
                  borderLeft: qualifies ? `2px solid ${accent}` : '2px solid transparent',
                }}>
                  {i + 1}
                </td>
                <td style={{ ...cell, textAlign: 'left', fontFamily: FONT_B, fontSize: 13.5, color: T.text }}>
                  {r.teamName}
                </td>
                <td style={cell}>{r.played}</td>
                <td style={{ ...cell, color: r.won > 0 ? T.win : T.dim }}>{r.won}</td>
                <td style={cell}>{r.drawn}</td>
                <td style={{ ...cell, color: r.lost > 0 ? T.loss : T.dim }}>{r.lost}</td>
                <td style={cell}>{r.goalsFor}</td>
                <td style={cell}>{r.goalsAgainst}</td>
                <td style={{ ...cell, color: r.goalDiff > 0 ? T.win : r.goalDiff < 0 ? T.loss : T.dim }}>
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td style={{ ...cell, fontFamily: FONT_D, fontSize: 14, color: T.text }}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
