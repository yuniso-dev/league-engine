'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import GlassSelect from '@/components/ui/GlassSelect';
import { updateTournamentStatusAction, type AdminFormState } from '@/app/admin/actions';

type Props = {
  tournamentId: string;
  status: 'upcoming' | 'live' | 'completed';
  winnerTeamId: string | null;
  teams: { id: string; name: string }[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 18px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? 'SAVING…' : 'UPDATE'}
    </button>
  );
}

export default function StatusControls({ tournamentId, status, winnerTeamId, teams }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(updateTournamentStatusAction, {});
  const [selected, setSelected] = useState(status);

  return (
    <form action={action} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <div style={{ width: 150 }}>
        <GlassSelect
          name="status"
          value={selected}
          onChange={v => setSelected(v as Props['status'])}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'live', label: 'Live' },
            { value: 'completed', label: 'Completed' },
          ]}
          accent={ADMIN_ACCENT}
        />
      </div>

      {selected === 'completed' && teams.length > 0 && (
        <div style={{ width: 200 }}>
          <GlassSelect
            name="winnerTeamId"
            defaultValue={winnerTeamId ?? ''}
            placeholder="— No winner set —"
            options={[
              { value: '', label: '— No winner set —' },
              ...teams.map(t => ({ value: t.id, label: `🏆 ${t.name}` })),
            ]}
            accent={ADMIN_ACCENT}
          />
        </div>
      )}

      <SubmitButton />

      {state.error && (
        <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
      )}
      {state.ok && !state.error && (
        <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>Saved ✓</span>
      )}
    </form>
  );
}
