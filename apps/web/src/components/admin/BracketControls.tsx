'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import {
  generateBracketAction,
  generateNextRoundAction,
  type AdminFormState,
} from '@/app/admin/actions';

// "Draw the bracket" (random first-round pairing from the teams) and
// "draw the next round" (pairs the winners once every fixture has a score).

type Props = {
  tournamentId: string;
  mode: 'draw' | 'next';
  teamCount: number;
};

function GoButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 22px',
        background: 'none',
        border: `1px solid ${rgba(ADMIN_ACCENT, 0.6)}`,
        borderRadius: 10,
        color: ADMIN_ACCENT,
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
        boxShadow: `0 0 14px ${rgba(ADMIN_ACCENT, 0.18)}`,
      }}
    >
      {pending ? 'DRAWING…' : label}
    </button>
  );
}

export default function BracketControls({ tournamentId, mode, teamCount }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(
    mode === 'draw' ? generateBracketAction : generateNextRoundAction,
    {},
  );

  return (
    <form
      action={action}
      onSubmit={e => {
        if (mode === 'draw' && !window.confirm(`Randomly draw the bracket for ${teamCount} teams?`)) {
          e.preventDefault();
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
    >
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <GoButton label={mode === 'draw' ? '🎲 DRAW BRACKET' : '⏭ DRAW NEXT ROUND'} />
      {state.error && (
        <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
      )}
      {state.ok && state.message && (
        <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>{state.message}</span>
      )}
    </form>
  );
}
