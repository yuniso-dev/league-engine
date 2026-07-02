'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { commitRevealAction, type AdminFormState } from '@/app/admin/actions';

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

export default function RevealConfirm() {
  const [state, action] = useFormState<AdminFormState, FormData>(commitRevealAction, {});

  return (
    <form
      action={action}
      onSubmit={e => {
        if (!window.confirm('Commit this reveal? Ratings, ranks and history are written permanently.')) {
          e.preventDefault();
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
    >
      <ConfirmButton />
      {state.error && (
        <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 14 }}>{state.error}</span>
      )}
      {state.ok && state.message && (
        <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 14 }}>{state.message}</span>
      )}
    </form>
  );
}
