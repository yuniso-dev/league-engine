'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AwardRow } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { updateAwardAction, type AdminFormState } from '@/app/admin/actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 20px',
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
      {pending ? 'SAVING…' : 'SAVE AWARD'}
    </button>
  );
}

export default function AwardEditForm({ award }: { award: AwardRow }) {
  const [state, action] = useFormState<AdminFormState, FormData>(updateAwardAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontFamily: FONT_B,
          fontSize: 13,
          color: T.dim,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 7,
          padding: '6px 14px',
          background: 'none',
          cursor: 'pointer',
        }}
      >
        ✎ Edit
      </button>
    );
  }

  return (
    <form action={action} style={{ width: '100%' }}>
      <div style={{ ...glass({ padding: 18 }), marginTop: 14 }}>
        <input type="hidden" name="awardId" value={award.id} />
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Icon</label>
            <input name="icon" maxLength={8} defaultValue={award.icon ?? ''} autoComplete="off" style={{ ...inputBase, textAlign: 'center', fontSize: 20 }} />
          </div>
          <div>
            <label style={labelStyle}>Name</label>
            <input name="name" maxLength={60} required defaultValue={award.name} autoComplete="off" style={inputBase} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Description</label>
          <input name="description" maxLength={200} defaultValue={award.description ?? ''} style={inputBase} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Image URL (optional — shown instead of the icon)</label>
          <input name="imageUrl" maxLength={500} defaultValue={award.imageUrl ?? ''} autoComplete="off" placeholder="https://…/badge.png" style={inputBase} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <SaveButton />
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              background: 'none', border: 'none', color: T.faint,
              fontFamily: FONT_B, fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
          {state.error && <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>}
          {state.ok && state.message && <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>{state.message}</span>}
        </div>
      </div>
    </form>
  );
}
