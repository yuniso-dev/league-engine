'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminPlayerOption } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { createTeamAction, type AdminFormState } from '@/app/admin/actions';

type Props = {
  tournamentId: string;
  players: AdminPlayerOption[];
  /** Players already on a team in this tournament — shown dimmed and unselectable. */
  takenPublicIds: string[];
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      style={{
        padding: '11px 20px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending || disabled ? 'not-allowed' : 'pointer',
        opacity: pending || disabled ? 0.6 : 1,
      }}
    >
      {pending ? 'CREATING…' : 'CREATE TEAM'}
    </button>
  );
}

export default function TeamForm({ tournamentId, players, takenPublicIds }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(createTeamAction, {});
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  const taken = useMemo(() => new Set(takenPublicIds), [takenPublicIds]);

  // Clear the form once a team is created — `state` is a fresh object per submit.
  useEffect(() => {
    if (state.ok) {
      setSelected(new Set());
      setQuery('');
      formRef.current?.reset();
    }
  }, [state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      p => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q),
    );
  }, [players, query]);

  const toggle = (publicId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  };

  return (
    <form ref={formRef} action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          ADD TEAM
        </div>
        <input type="hidden" name="tournamentId" value={tournamentId} />
        {[...selected].map(id => (
          <input key={id} type="hidden" name="members" value={id} />
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Team name</label>
            <input
              name="name"
              maxLength={50}
              required
              autoComplete="off"
              placeholder="Team A"
              style={inputBase}
            />
          </div>
          <div>
            <label style={labelStyle}>Find players</label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name…"
              autoComplete="off"
              style={inputBase}
            />
          </div>
        </div>

        <div style={{
          marginTop: 12,
          maxHeight: 210,
          overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
        }}>
          {filtered.length === 0 ? (
            <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 14 }}>
              No players found.
            </div>
          ) : (
            filtered.map(p => {
              const isTaken = taken.has(p.publicId);
              const isSelected = selected.has(p.publicId);
              return (
                <button
                  key={p.publicId}
                  type="button"
                  disabled={isTaken}
                  onClick={() => toggle(p.publicId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    background: isSelected ? 'rgba(61,139,255,0.14)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: isTaken ? T.faint : T.text,
                    fontFamily: FONT_B,
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: isTaken ? 'default' : 'pointer',
                  }}
                >
                  <span style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
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
                  {isTaken && (
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>ON A TEAM</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <SubmitButton disabled={selected.size === 0} />
          <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim }}>
            {selected.size} player{selected.size === 1 ? '' : 's'} selected
          </span>
          {state.error && (
            <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
          )}
        </div>
      </div>
    </form>
  );
}
