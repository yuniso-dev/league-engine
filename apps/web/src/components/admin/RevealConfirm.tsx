'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { commitRevealAction, type AdminFormState } from '@/app/admin/actions';

type Props = { matchCount: number; playerCount: number };

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '14px 28px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 16,
        letterSpacing: 2,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        boxShadow: `0 0 22px ${rgba(ADMIN_ACCENT, 0.4)}`,
      }}
    >
      {pending ? 'COMMITTING…' : '⚡ COMMIT REVEAL'}
    </button>
  );
}

export default function RevealConfirm({ matchCount, playerCount }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(commitRevealAction, {});
  const summary = `${matchCount} match${matchCount === 1 ? '' : 'es'} and ${playerCount} player${playerCount === 1 ? '' : 's'}`;

  return (
    <form
      action={action}
      onSubmit={e => {
        if (!window.confirm(`Commit this reveal? This permanently updates ${summary}' ratings, ranks and history.`)) {
          e.preventDefault();
        }
      }}
    >
      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, margin: '0 0 12px' }}>
        This will permanently update <strong style={{ color: T.text }}>{summary}</strong>.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <ConfirmButton />
        {state.error && (
          <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 14 }}>{state.error}</span>
        )}
        {state.ok && state.message && (
          <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 14 }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
