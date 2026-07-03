'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { recalcRanksAction, type AdminFormState } from '@/app/admin/actions';

// One-tap tie-aware re-rank: everyone with equal Elo shares a rank, so a
// fresh league (all at base Elo) is all #1 until ratings start to move.

function GoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 20px',
        background: 'none',
        border: `1px solid ${rgba(ADMIN_ACCENT, 0.6)}`,
        borderRadius: 10,
        color: ADMIN_ACCENT,
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'RANKING…' : '⚡ RECALCULATE RANKS NOW'}
    </button>
  );
}

export default function RecalcRanksButton() {
  const [state, action] = useFormState<AdminFormState, FormData>(recalcRanksAction, {});
  return (
    <form action={action} style={{ ...glass({ padding: 20 }), marginTop: 20 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 6 }}>
        LADDER RANKS
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '0 0 14px', lineHeight: 1.6 }}>
        Assigns a rank to every active player, ties sharing the same rank — with everyone at the
        base Elo, the whole league is #1. Ranks also refresh automatically on every reveal.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <GoButton />
        {state.ok && state.message && (
          <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>✓ {state.message}</span>
        )}
        {state.error && (
          <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
        )}
      </div>
    </form>
  );
}
