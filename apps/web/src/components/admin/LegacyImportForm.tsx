'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { importLegacyAction, type AdminFormState } from '@/app/admin/actions';

// Paste the old "Frontier Awards History" Discord message and import the whole
// archive. Re-pasting replaces it (the paste is the source of truth).

function ImportButton() {
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
      }}
    >
      {pending ? 'IMPORTING…' : '📜 IMPORT ARCHIVE'}
    </button>
  );
}

export default function LegacyImportForm() {
  const [state, action] = useFormState<AdminFormState, FormData>(importLegacyAction, {});
  return (
    <form action={action} style={glass({ padding: 20 })}>
      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '0 0 12px', lineHeight: 1.6 }}>
        Paste the whole <strong>Frontier Awards History</strong> message. It reads each
        <code style={{ color: T.dim }}> ## Frontier &lt;numeral&gt;</code> heading and the
        🏆 Winners / ⚽ Golden Boot / 🧱 Wallside / 👟 Sharp&apos;s / ❄️ Xavier Frost lines under it.
        Re-pasting <strong>replaces</strong> the archive.
      </p>
      <textarea
        name="archive"
        rows={12}
        placeholder="**# Frontier Awards History**&#10;> ## Frontier I&#10;> 🏆 Winners: <@…>, <@…>&#10;> ⚽ Golden Boot: N/A&#10;…"
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 10,
          color: T.text,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          lineHeight: 1.5,
          outline: 'none',
          marginBottom: 14,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ImportButton />
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
