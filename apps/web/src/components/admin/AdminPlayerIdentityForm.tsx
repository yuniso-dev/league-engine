'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminPlayerDetail } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import GlassSelect from '@/components/ui/GlassSelect';
import { POSITIONS } from '@/lib/positions';
import { COUNTRIES, flagEmoji } from '@/lib/countries';
import { updatePlayerIdentityAction, type AdminFormState } from '@/app/admin/actions';

// Admin edit of the fields players normally manage themselves — for fixing up
// profiles on their behalf.

const POSITION_OPTIONS = [
  { value: '', label: '— None —' },
  ...POSITIONS.map(p => ({ value: p, label: p })),
];

const COUNTRY_OPTIONS = [
  { value: '', label: '— None —' },
  ...COUNTRIES.map(c => ({ value: c.code, label: `${flagEmoji(c.code)} ${c.name}` })),
];

function SaveButton() {
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
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'SAVING…' : 'SAVE IDENTITY'}
    </button>
  );
}

export default function AdminPlayerIdentityForm({ player }: { player: AdminPlayerDetail['player'] }) {
  const [state, action] = useFormState<AdminFormState, FormData>(updatePlayerIdentityAction, {});

  return (
    <form action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          IDENTITY
          <span style={{ fontFamily: FONT_B, fontSize: 11, color: T.faint, letterSpacing: 0, textTransform: 'none', marginLeft: 10 }}>
            The fields the player edits in their own Settings — editable here on their behalf.
          </span>
        </div>
        <input type="hidden" name="publicId" value={player.publicId} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Display name</label>
            <input name="displayName" maxLength={32} required defaultValue={player.displayName} autoComplete="off" style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <GlassSelect
              name="country"
              options={COUNTRY_OPTIONS}
              defaultValue={player.country ?? ''}
              accent={ADMIN_ACCENT}
              searchable
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <label style={labelStyle}>Primary position</label>
            <GlassSelect name="position1" options={POSITION_OPTIONS} defaultValue={player.position1 ?? ''} accent={ADMIN_ACCENT} />
          </div>
          <div>
            <label style={labelStyle}>Secondary position</label>
            <GlassSelect name="position2" options={POSITION_OPTIONS} defaultValue={player.position2 ?? ''} accent={ADMIN_ACCENT} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Quote</label>
          <input name="quote" maxLength={100} defaultValue={player.quote ?? ''} style={inputBase} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Bio</label>
          <textarea name="bio" maxLength={300} rows={3} defaultValue={player.bio ?? ''} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <SaveButton />
          {state.error && <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>}
          {state.ok && state.message && <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>{state.message}</span>}
        </div>
      </div>
    </form>
  );
}
