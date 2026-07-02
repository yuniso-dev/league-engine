'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase } from '@/components/admin/ui';
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

      <select
        name="status"
        value={selected}
        onChange={e => setSelected(e.target.value as Props['status'])}
        style={{ ...inputBase, width: 150, cursor: 'pointer' }}
      >
        <option value="upcoming">Upcoming</option>
        <option value="live">Live</option>
        <option value="completed">Completed</option>
      </select>

      {selected === 'completed' && teams.length > 0 && (
        <select
          name="winnerTeamId"
          defaultValue={winnerTeamId ?? ''}
          style={{ ...inputBase, width: 200, cursor: 'pointer' }}
        >
          <option value="">— No winner set —</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>🏆 {t.name}</option>
          ))}
        </select>
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
