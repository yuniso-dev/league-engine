'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminPlayerOption, TournamentRow } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { grantAwardAction, type AdminFormState } from '@/app/admin/actions';

type Props = {
  awardId: string;
  players: AdminPlayerOption[];
  tournaments: TournamentRow[];
  defaultSeason: number;
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
      {pending ? 'GRANTING…' : 'GRANT AWARD'}
    </button>
  );
}

export default function AwardGrantForm({ awardId, players, tournaments, defaultSeason }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(grantAwardAction, {});
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSelected(null);
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

  return (
    <form ref={formRef} action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          GRANT TO PLAYER
        </div>
        <input type="hidden" name="awardId" value={awardId} />
        <input type="hidden" name="publicId" value={selected ?? ''} />

        <label style={labelStyle}>Find player</label>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name…"
          autoComplete="off"
          style={inputBase}
        />

        <div style={{
          marginTop: 10,
          maxHeight: 200,
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
              const isSelected = selected === p.publicId;
              return (
                <button
                  key={p.publicId}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : p.publicId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    background: isSelected ? 'rgba(61,139,255,0.14)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: T.text,
                    fontFamily: FONT_B,
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: 15,
                    height: 15,
                    borderRadius: '50%',
                    border: `1.5px solid ${isSelected ? ADMIN_ACCENT : 'rgba(255,255,255,0.25)'}`,
                    background: isSelected ? ADMIN_ACCENT : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.displayName}
                    <span style={{ color: T.faint, fontSize: 12 }}> @{p.username}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, marginTop: 14 }}>
          <div>
            <label style={labelStyle}>Tournament (optional)</label>
            <select name="tournamentId" defaultValue="" style={{ ...inputBase, cursor: 'pointer' }}>
              <option value="">— None —</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Season</label>
            <input name="season" type="number" min={1} defaultValue={defaultSeason} style={inputBase} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <SubmitButton disabled={selected === null} />
          {state.error && (
            <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
          )}
        </div>
      </div>
    </form>
  );
}
