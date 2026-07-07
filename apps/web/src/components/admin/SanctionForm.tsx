'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, T, glass } from '@/lib/realm-colors';
import { inputBase, labelStyle } from '@/components/admin/ui';
import { issueSanctionAction, type AdminFormState } from '@/app/admin/actions';

// Suspend a player from future Frontiers. Blank frontiers = the type's default
// (no-show 1, abandon 2). The bot mirrors it onto the punished role and DMs
// the player; the ban serves itself as Frontiers complete.

type Props = { playerPublicId: string };

const TYPES = [
  { value: 'no_show', label: 'No-show — signed up, never arrived (default: 1 Frontier)' },
  { value: 'abandon', label: 'Abandoned mid-tournament (default: 2 Frontiers)' },
  { value: 'other', label: 'Other rule violation (default: 1 Frontier)' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 20px',
        background: 'none',
        border: '1px solid rgba(255,107,107,0.5)',
        borderRadius: 9,
        color: '#FF6B6B',
        fontFamily: FONT_B,
        fontSize: 13,
        letterSpacing: 1,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? 'SUSPENDING…' : '🚫 SUSPEND'}
    </button>
  );
}

export default function SanctionForm({ playerPublicId }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(issueSanctionAction, {});

  return (
    <form
      action={action}
      onSubmit={e => { if (!window.confirm('Suspend this player? They cannot sign up until the ban is served or pardoned.')) e.preventDefault(); }}
      style={glass({ padding: 18 })}
    >
      <input type="hidden" name="publicId" value={playerPublicId} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) minmax(90px, 100px) minmax(180px, 2fr) auto', gap: 12, alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>What happened</label>
          <select name="type" defaultValue="no_show" style={{ ...inputBase, cursor: 'pointer' }}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Frontiers</label>
          <input name="frontiers" type="number" min={1} max={10} placeholder="auto" style={inputBase} />
        </div>
        <div>
          <label style={labelStyle}>Reason (goes in their DM)</label>
          <input name="reason" maxLength={300} placeholder="e.g. left at half-time in the semi" style={inputBase} />
        </div>
        <SubmitButton />
      </div>
      {state.error && (
        <p style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13, margin: '10px 0 0' }}>{state.error}</p>
      )}
      {state.ok && state.message && (
        <p style={{ fontFamily: FONT_B, color: T.win, fontSize: 13, margin: '10px 0 0' }}>{state.message}</p>
      )}
    </form>
  );
}
