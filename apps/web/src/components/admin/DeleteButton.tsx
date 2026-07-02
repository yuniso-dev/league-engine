'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B } from '@/lib/realm-colors';
import type { AdminFormState } from '@/app/admin/actions';

type Props = {
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  hidden: Record<string, string>;
  confirmText: string;
  /** Defaults to a compact "✕" icon; pass a word (e.g. "Delete") for a labelled button. */
  label?: string;
};

function Button({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const isIcon = label === '✕';
  return (
    <button
      type="submit"
      disabled={pending}
      title={isIcon ? 'Delete' : undefined}
      style={{
        background: 'none',
        border: '1px solid rgba(255,107,107,0.35)',
        borderRadius: 7,
        color: '#FF6B6B',
        fontFamily: FONT_B,
        fontSize: isIcon ? 11 : 13,
        padding: isIcon ? '3px 8px' : '7px 14px',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}

export default function DeleteButton({ action, hidden, confirmText, label = '✕' }: Props) {
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
      <Button label={label} />
      {state.error && (
        <span style={{ fontFamily: FONT_B, color: '#FF6B6B', fontSize: 12 }}>{state.error}</span>
      )}
    </form>
  );
}
