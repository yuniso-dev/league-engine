'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import {
  generateBracketAction,
  generateFrontierFixturesAction,
  generateGroupStageAction,
  generateKnockoutAction,
  generateNextRoundAction,
  type AdminFormState,
} from '@/app/admin/actions';

// Fixture generators: auto-format (picks by team count), random knockout draw,
// round-robin group stage, knockout seeded from the table, next-round pairing.

type Mode = 'auto' | 'draw' | 'group' | 'knockout' | 'next';

type Props = {
  tournamentId: string;
  mode: Mode;
  teamCount: number;
  /** Optional custom button label (auto mode shows the detected format). */
  label?: string;
};

const ACTION_OF: Record<Mode, typeof generateBracketAction> = {
  auto: generateFrontierFixturesAction,
  draw: generateBracketAction,
  group: generateGroupStageAction,
  knockout: generateKnockoutAction,
  next: generateNextRoundAction,
};

const LABEL_OF: Record<Mode, string> = {
  auto: '⚡ GENERATE FIXTURES',
  draw: '🎲 DRAW KNOCKOUT (random)',
  group: '📋 GROUP FIXTURES (round robin)',
  knockout: '🏁 DRAW KNOCKOUT FROM TABLE',
  next: '⏭ DRAW NEXT ROUND',
};

const CONFIRM_OF: Partial<Record<Mode, (teams: number) => string>> = {
  auto: n => `Generate the fixtures for ${n} teams using the automatic format?`,
  draw: n => `Randomly draw the knockout for ${n} teams?`,
  group: n => `Generate a round robin for ${n} teams (every team plays every other team once)?`,
  knockout: () => 'Draw the knockout from the current table standings?',
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

export default function BracketControls({ tournamentId, mode, teamCount, label }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(ACTION_OF[mode], {});

  return (
    <form
      action={action}
      onSubmit={e => {
        const confirmText = CONFIRM_OF[mode]?.(teamCount);
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
    >
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <GoButton label={label ?? LABEL_OF[mode]} />
      {state.error && (
        <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
      )}
      {state.ok && state.message && (
        <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>{state.message}</span>
      )}
    </form>
  );
}
