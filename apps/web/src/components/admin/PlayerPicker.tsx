'use client';
import { useMemo, useState } from 'react';
import { FONT_B, FONT_M, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { useAdminPlayers } from '@/lib/useAdminPlayers';

// Shared search-and-select player list for admin forms. Loads the player
// list once per browser session (module cache in useAdminPlayers) so
// post-mutation page re-renders never re-ship the whole player table.
// Remount with a fresh `key` to clear the search box after a submit.

type Props = {
  mode: 'single' | 'multi';
  selectedIds: ReadonlySet<string>;
  onToggle: (publicId: string) => void;
  /** Unselectable players (e.g. already on a team) — dimmed with a label. */
  disabledIds?: ReadonlySet<string>;
  disabledLabel?: string;
  searchLabel?: string;
  maxHeight?: number;
};

export default function PlayerPicker({
  mode,
  selectedIds,
  onToggle,
  disabledIds,
  disabledLabel = 'UNAVAILABLE',
  searchLabel = 'Find players',
  maxHeight = 200,
}: Props) {
  const { players, loading, error, retry } = useAdminPlayers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      p => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q),
    );
  }, [players, query]);

  return (
    <div>
      <label style={labelStyle}>{searchLabel}</label>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name…"
        autoComplete="off"
        style={inputBase}
      />

      <div style={{
        marginTop: 10,
        maxHeight,
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
      }}>
        {loading ? (
          <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 14 }}>
            Loading players…
          </div>
        ) : error ? (
          <div style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13, padding: 14 }}>
            {error}{' '}
            <button
              type="button"
              onClick={retry}
              style={{
                background: 'none',
                border: 'none',
                color: ADMIN_ACCENT,
                fontFamily: FONT_B,
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 14 }}>
            No players found.
          </div>
        ) : (
          filtered.map(p => {
            const isDisabled = disabledIds?.has(p.publicId) ?? false;
            const isSelected = selectedIds.has(p.publicId);
            return (
              <button
                key={p.publicId}
                type="button"
                disabled={isDisabled}
                onClick={() => onToggle(p.publicId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  background: isSelected ? 'rgba(61,139,255,0.14)' : 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: isDisabled ? T.faint : T.text,
                  fontFamily: FONT_B,
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: isDisabled ? 'default' : 'pointer',
                }}
              >
                <span style={{
                  width: 15,
                  height: 15,
                  borderRadius: mode === 'single' ? '50%' : 4,
                  border: `1.5px solid ${isSelected ? ADMIN_ACCENT : 'rgba(255,255,255,0.25)'}`,
                  background: isSelected ? ADMIN_ACCENT : 'none',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.displayName}
                  <span style={{ color: T.faint, fontSize: 12 }}> @{p.username}</span>
                </span>
                {p.position1 && (
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>
                    {p.position1}{p.position2 ? `/${p.position2}` : ''}
                  </span>
                )}
                {isDisabled && (
                  <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>{disabledLabel}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
