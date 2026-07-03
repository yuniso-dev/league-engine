'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminPlayerListItem } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { flagEmoji } from '@/lib/countries';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase } from '@/components/admin/ui';

type Props = { players: AdminPlayerListItem[] };

type Filter = 'all' | 'ranked' | 'placements' | 'inactive';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'placements', label: 'Placements' },
  { id: 'inactive', label: 'Inactive' },
];

export default function PlayerDirectory({ players }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter(p => {
      if (filter === 'ranked' && (p.provisional || p.isInactive)) return false;
      if (filter === 'placements' && !p.provisional) return false;
      if (filter === 'inactive' && !p.isInactive) return false;
      if (!q) return true;
      return p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
    });
  }, [players, query, filter]);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name…"
          autoComplete="off"
          style={{ ...inputBase, maxWidth: 300 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                border: `1px solid ${filter === f.id ? rgba(ADMIN_ACCENT, 0.6) : 'rgba(255,255,255,0.13)'}`,
                background: filter === f.id ? rgba(ADMIN_ACCENT, 0.2) : 'none',
                color: filter === f.id ? '#fff' : T.dim,
                fontFamily: FONT_B,
                fontSize: 12.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: FONT_M, fontSize: 12, color: T.faint, marginLeft: 'auto' }}>
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={glass({ padding: 30, textAlign: 'center' })}>
          <p style={{ fontFamily: FONT_B, color: T.faint, margin: 0 }}>No players found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <Link key={p.publicId} href={`/admin/players/${p.publicId}`} style={{ textDecoration: 'none' }}>
              <div style={glass({
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: p.isInactive ? 0.55 : 1,
              })}>
                <Avatar
                  initials={p.displayName.slice(0, 2).toUpperCase()}
                  src={p.avatarUrl}
                  size={38}
                  ring={null}
                />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <span style={{ fontFamily: FONT_B, fontSize: 15, color: T.text }}>
                    {p.country && (
                      <span style={{ marginRight: 6 }}>{flagEmoji(p.country)}</span>
                    )}
                    {p.displayName}
                  </span>
                  <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}> @{p.username}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p.title && (
                      <span style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: T.gold, textTransform: 'uppercase' }}>
                        {p.title}
                      </span>
                    )}
                    {p.position1 && (
                      <span style={{ fontFamily: FONT_M, fontSize: 10.5, color: T.faint }}>
                        {p.position1}{p.position2 ? `/${p.position2}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, color: p.provisional ? T.faint : T.text }}>
                    {p.provisional ? '—' : p.rank != null ? `#${p.rank}` : '—'}
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 11, color: T.dim, whiteSpace: 'nowrap' }}>
                    {Math.round(p.elo)} · {p.gamesPlayed} gp
                  </div>
                </div>
                {p.provisional && !p.isInactive && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 9.5, color: T.faint,
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap',
                  }}>
                    PLACEMENTS
                  </span>
                )}
                {p.isInactive && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 9.5, color: T.loss,
                    border: `1px solid ${rgba(T.loss, 0.35)}`,
                    borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap',
                  }}>
                    INACTIVE
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
