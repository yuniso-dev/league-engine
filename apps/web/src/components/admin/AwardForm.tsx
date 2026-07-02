'use client';
import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { createAwardAction, type AdminFormState } from '@/app/admin/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 20px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'CREATING…' : 'CREATE AWARD'}
    </button>
  );
}

export default function AwardForm() {
  const [state, action] = useFormState<AdminFormState, FormData>(createAwardAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          NEW AWARD
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Icon</label>
            <input name="icon" maxLength={8} placeholder="🏆" autoComplete="off" style={{ ...inputBase, textAlign: 'center', fontSize: 20 }} />
          </div>
          <div>
            <label style={labelStyle}>Name</label>
            <input name="name" maxLength={60} required autoComplete="off" placeholder="Frontier Champion" style={inputBase} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Description</label>
          <input name="description" maxLength={200} placeholder="Won a Frontier tournament" style={inputBase} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <SubmitButton />
          {state.error && (
            <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
          )}
        </div>
      </div>
    </form>
  );
}
