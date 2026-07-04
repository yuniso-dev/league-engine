import Link from 'next/link';
import type { StatLeader } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { RankMedal } from '@/components/ui/RankMedal';
import { T, FONT_B, FONT_D, FONT_M, rankColor, rgba } from '@/lib/realm-colors';

// A mini ranking table for a stat (goals / assists / clean sheets): the top 3
// wear medals, everyone else a number, and every row taps through to the
// player's profile. Only ~3 rows show on a phone — scroll for the rest.
// Server-safe (no hooks) so both the client Frontier realm and the server
// Frontier detail page can render it.

const ROW = 40; // approx row height in px

export function StatLeaderList({ title, emoji, leaders, unit, accent, maxVisible = 3 }: {
  title: string;
  emoji: string;
  leaders: StatLeader[];
  unit: string;
  accent?: string;
  maxVisible?: number;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: accent ?? T.faint, marginBottom: 8 }}>
        {emoji} {title}
      </div>

      {leaders.length === 0 ? (
        <div style={{ fontFamily: FONT_M, fontSize: 10.5, color: T.faint, opacity: 0.7, lineHeight: 1.7, letterSpacing: 0.4 }}>
          Unclaimed — the record
          <br />books are waiting.
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div
            className="ina-scroll"
            style={{
              maxHeight: ROW * maxVisible + 4,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {leaders.map((l, i) => (
              <Link
                key={l.publicId}
                href={`/p/${l.publicId}`}
                className="tap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  textDecoration: 'none',
                  padding: '6px 7px', borderRadius: 9,
                  background: i < 3 ? rgba(rankColor(i + 1), 0.07) : 'transparent',
                }}
              >
                <RankMedal place={i + 1} size={i < 3 ? 24 : 20} />
                <Avatar initials={l.displayName.slice(0, 2).toUpperCase()} src={l.avatarUrl} size={26} />
                <span style={{
                  flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 13.5, color: T.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {l.displayName}
                </span>
                <span style={{ fontFamily: FONT_D, fontSize: 15, color: i === 0 ? T.gold : T.dim }}>
                  {l.value}
                  <span style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, marginLeft: 2 }}>{unit}</span>
                </span>
              </Link>
            ))}
          </div>

          {/* fade hint that there's more below the fold */}
          {leaders.length > maxVisible && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, pointerEvents: 'none',
              background: 'linear-gradient(transparent, rgba(8,10,18,0.85))',
            }} />
          )}
        </div>
      )}
    </div>
  );
}
