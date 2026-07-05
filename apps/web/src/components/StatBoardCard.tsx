'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { StatLeader } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { RankMedal } from '@/components/ui/RankMedal';
import { T, FONT_B, FONT_D, FONT_M, glass, mixHex, rgba, rankColor } from '@/lib/realm-colors';

// One stat category as a card: the top 3 on display (medals, #1 wears a
// filled value badge), with a button that expands the list to the top 25.
// Every row taps through to the player's profile.

// Medal-row tint. It MUST be opaque: a translucent tint over the card's
// backdrop-filter shifts tone when Chromium promotes the hovered row to its
// own compositing layer (it stops sampling the blurred backdrop), which read
// as a "two tone" row. An opaque colour renders identically layer or not.
const MEDAL_ROW_BASE = '#151A27';

export function StatBoardCard({ title, emoji, leaders, unit, accent }: {
  title: string;
  emoji: string;
  leaders: StatLeader[];
  unit: string;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? leaders : leaders.slice(0, 3);

  return (
    // isolate: give the card its own stacking context so its backdrop-filter
    // and the rows composite predictably (belt-and-braces with the opaque rows).
    <div style={glass({ padding: '16px 16px 12px', isolation: 'isolate' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.text }}>
          {title}
        </span>
      </div>

      {leaders.length === 0 ? (
        <div style={{ fontFamily: FONT_M, fontSize: 10.5, color: T.faint, opacity: 0.7, lineHeight: 1.7, letterSpacing: 0.4, paddingBottom: 6 }}>
          Unclaimed — the record books are waiting.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visible.map((l, i) => (
              <Link
                key={l.publicId}
                href={`/p/${l.publicId}`}
                className="tap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  textDecoration: 'none',
                  padding: '7px 8px', borderRadius: 10,
                  background: i < 3 ? mixHex(MEDAL_ROW_BASE, rankColor(i + 1), 0.13) : 'transparent',
                }}
              >
                <RankMedal place={i + 1} size={i < 3 ? 24 : 20} />
                <Avatar initials={l.displayName.slice(0, 2).toUpperCase()} src={l.avatarUrl} size={30} />
                <span style={{
                  flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 14, color: T.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {l.displayName}
                </span>
                {i === 0 ? (
                  // FotMob-style filled badge on the leader
                  <span style={{
                    fontFamily: FONT_D, fontSize: 14, color: '#0A1018',
                    background: accent, borderRadius: 999, padding: '3px 11px',
                    letterSpacing: 0.3,
                  }}>
                    {l.value}
                  </span>
                ) : (
                  <span style={{ fontFamily: FONT_D, fontSize: 15, color: T.dim }}>
                    {l.value}
                    <span style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, marginLeft: 3 }}>{unit}</span>
                  </span>
                )}
              </Link>
            ))}
          </div>

          {leaders.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0',
                background: 'none', cursor: 'pointer',
                border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)',
                fontFamily: FONT_M, fontSize: 10.5, letterSpacing: 1.5,
                color: rgba(accent, 0.9),
              }}
            >
              {expanded ? '▴ SHOW TOP 3' : `▾ SHOW TOP ${Math.min(leaders.length, 25)}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
