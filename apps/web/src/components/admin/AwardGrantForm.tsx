'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { TournamentRow } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { grantAwardAction, type AdminFormState } from '@/app/admin/actions';
import PlayerPicker from '@/components/admin/PlayerPicker';
import GlassSelect from '@/components/ui/GlassSelect';

type Props = {
  awardId: string;
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

export default function AwardGrantForm({ awardId, tournaments, defaultSeason }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(grantAwardAction, {});
  const [selected, setSelected] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSelected(null);
      setResetKey(k => k + 1); // remounts the picker → clears its search box
      formRef.current?.reset();
    }
  }, [state]);

  const selectedIds = useMemo(
    () => new Set(selected ? [selected] : []),
    [selected],
  );

  return (
    <form ref={formRef} action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          GRANT TO PLAYER
        </div>
        <input type="hidden" name="awardId" value={awardId} />
        <input type="hidden" name="publicId" value={selected ?? ''} />

        <PlayerPicker
          key={resetKey}
          mode="single"
          selectedIds={selectedIds}
          onToggle={publicId => setSelected(prev => (prev === publicId ? null : publicId))}
          searchLabel="Find player"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, marginTop: 14 }}>
          <div>
            <label style={labelStyle}>Tournament (optional)</label>
            <GlassSelect
              name="tournamentId"
              defaultValue=""
              options={[
                { value: '', label: '— None —' },
                ...tournaments.map(t => ({ value: t.id, label: t.name })),
              ]}
              accent={ADMIN_ACCENT}
            />
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
