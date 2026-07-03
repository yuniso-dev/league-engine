import type { PublicRecentMatch } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { T, FONT_B, FONT_D, FONT_M, glass, rgba } from '@/lib/realm-colors';

type Props = { matches: PublicRecentMatch[]; accent: string };

const RESULT_STYLE = {
  win: { label: 'W', color: T.win },
  loss: { label: 'L', color: T.loss },
  draw: { label: 'D', color: T.dim },
} as const;

export function RecentMatchesCard({ matches, accent }: Props) {
  if (matches.length === 0) return null;

  return (
    // No outer margin — callers space it (profile grid gap / share-page wrapper).
    <div style={glass({ padding: 18 })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Bolt size={13} color={accent} />
        <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
          RECENT MATCHES
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(m => {
          const r = m.result ? RESULT_STYLE[m.result] : null;
          return (
            <div
              key={m.matchId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10,
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: FONT_D,
                fontSize: 12,
                color: r?.color ?? T.faint,
                background: r ? rgba(r.color, 0.14) : 'rgba(255,255,255,0.06)',
                border: `1px solid ${r ? rgba(r.color, 0.35) : 'rgba(255,255,255,0.12)'}`,
              }}>
                {r?.label ?? '–'}
              </span>

              <span style={{ flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 13, color: T.text }}>
                {m.homeTeamName}
                <span style={{ fontFamily: FONT_M, color: T.gold, margin: '0 6px' }}>
                  {m.homeScore} – {m.awayScore}
                </span>
                {m.awayTeamName}
                {m.tournamentName && (
                  <span style={{ display: 'block', fontFamily: FONT_M, fontSize: 10, color: T.faint, marginTop: 2 }}>
                    {m.tournamentName}
                  </span>
                )}
              </span>

              {m.eloChange != null && (
                <span style={{
                  fontFamily: FONT_M,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  color: m.eloChange > 0 ? T.win : m.eloChange < 0 ? T.loss : T.dim,
                }}>
                  {m.eloChange > 0 ? '+' : ''}{m.eloChange.toFixed(1)}
                </span>
              )}
              {m.playedAt && (
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, whiteSpace: 'nowrap' }}>
                  {m.playedAt.slice(0, 10)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
