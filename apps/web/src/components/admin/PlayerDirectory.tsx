'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminPlayerListItem } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { inputBase } from '@/components/admin/ui';

type Props = { players: AdminPlayerListItem[] };

export default function PlayerDirectory({ players }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      p => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q),
    );
  }, [players, query]);

  return (
    <>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name…"
        autoComplete="off"
        style={{ ...inputBase, maxWidth: 360, marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <div style={glass({ padding: 30, textAlign: 'center' })}>
          <p style={{ fontFamily: FONT_B, color: T.faint, margin: 0 }}>No players found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <Link key={p.publicId} href={`/admin/players/${p.publicId}`} style={{ textDecoration: 'none' }}>
              <div style={glass({
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              })}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontFamily: FONT_B, fontSize: 15, color: T.text }}>
                    {p.displayName}
                  </span>
                  <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}> @{p.username}</span>
                  {p.title && (
                    <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: T.gold, textTransform: 'uppercase' }}>
                      {p.title}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: FONT_M, fontSize: 12, color: T.dim, whiteSpace: 'nowrap' }}>
                  {p.provisional ? '~' : p.rank != null ? `#${p.rank}` : '—'} · {Math.round(p.elo)} ELO · {p.gamesPlayed} games
                </span>
                {p.provisional && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 10, color: T.faint,
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '2px 7px',
                  }}>
                    PROVISIONAL
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
