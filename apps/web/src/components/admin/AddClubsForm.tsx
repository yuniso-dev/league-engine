'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { addTrackedClubsAction, type AdminFormState } from '@/app/admin/actions';

// Bulk-register EA clubs by ID. The site can't reach EA itself, so names and
// stats appear once the bot's next tracker pass runs (a few minutes).

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 22px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_B,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 1,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? 'ADDING…' : '📡 TRACK CLUBS'}
    </button>
  );
}

export default function AddClubsForm() {
  const [state, action] = useFormState<AdminFormState, FormData>(addTrackedClubsAction, {});

  return (
    <form action={action} style={glass({ padding: 18 })}>
      <label style={labelStyle}>EA club IDs — comma or space separated</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input
          name="clubIds"
          placeholder="e.g. 123456, 234567, 345678"
          autoComplete="off"
          style={{ ...inputBase, flex: 1, minWidth: 260 }}
        />
        <SubmitButton />
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint, margin: '8px 0 0', lineHeight: 1.5 }}>
        Get IDs with <b style={{ color: T.dim }}>/findclub</b> in Discord (or the club page URL on EA&apos;s site).
        To add by name, use <b style={{ color: T.dim }}>/trackclub</b> — the bot can search EA, this page can&apos;t.
      </p>
      {state.error && (
        <p style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13, margin: '10px 0 0' }}>{state.error}</p>
      )}
      {state.ok && state.message && (
        <p style={{ fontFamily: FONT_B, color: T.win, fontSize: 13, margin: '10px 0 0' }}>{state.message}</p>
      )}
    </form>
  );
}
