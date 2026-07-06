'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { createTeamAction, type AdminFormState } from '@/app/admin/actions';
import PlayerPicker from '@/components/admin/PlayerPicker';

type Props = {
  tournamentId: string;
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

export default function TeamForm({ tournamentId, takenPublicIds }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(createTeamAction, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const taken = useMemo(() => new Set(takenPublicIds), [takenPublicIds]);

  // Clear the form once a team is created — `state` is a fresh object per submit.
  useEffect(() => {
    if (state.ok) {
      setSelected(new Set());
      setResetKey(k => k + 1); // remounts the picker → clears its search box
      formRef.current?.reset();
    }
  }, [state]);

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

        <div style={{ marginBottom: 12 }}>
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

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>EA Club ID <span style={{ color: T.dim, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <input
            name="eaClubId"
            maxLength={12}
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 123456"
            style={inputBase}
          />
          <p style={{ fontFamily: FONT_B, fontSize: 11.5, color: T.dim, margin: '6px 0 0', lineHeight: 1.5 }}>
            The captain&apos;s fresh club — find the ID with <b>/findclub</b> in Discord.
            Linked teams get their results auto-recorded from EA while the Frontier is live.
          </p>
        </div>

        <PlayerPicker
          key={resetKey}
          mode="multi"
          selectedIds={selected}
          onToggle={toggle}
          disabledIds={taken}
          disabledLabel="ON A TEAM"
          maxHeight={210}
        />

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
