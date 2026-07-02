'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B } from '@/lib/realm-colors';
import type { AdminFormState } from '@/app/admin/actions';

type Props = {
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  hidden: Record<string, string>;
  confirmText: string;
};

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Delete"
      style={{
        background: 'none',
        border: '1px solid rgba(255,107,107,0.35)',
        borderRadius: 7,
        color: '#FF6B6B',
        fontFamily: FONT_B,
        fontSize: 11,
        padding: '3px 8px',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      ✕
    </button>
  );
}

export default function DeleteButton({ action, hidden, confirmText }: Props) {
  const [state, formAction] = useFormState<AdminFormState, FormData>(action, {});

  return (
    <form
      action={formAction}
      onSubmit={e => { if (!window.confirm(confirmText)) e.preventDefault(); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button />
      {state.error && (
        <span style={{ fontFamily: FONT_B, color: '#FF6B6B', fontSize: 12 }}>{state.error}</span>
      )}
    </form>
  );
}
