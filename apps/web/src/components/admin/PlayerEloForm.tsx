'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { setPlayerEloAction, type AdminFormState } from '@/app/admin/actions';

// One-off Elo correction for a single player. Rank refreshes on the next
// reveal / recalc (kept out of here so ties stay consistent league-wide).

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '9px 18px',
        background: 'none',
        border: `1px solid ${rgba(ADMIN_ACCENT, 0.6)}`,
        borderRadius: 9,
        color: ADMIN_ACCENT,
        fontFamily: FONT_B,
        fontWeight: 700,
        fontSize: 13,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'Saving…' : 'Set Elo'}
    </button>
  );
}

const field: React.CSSProperties = {
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 9,
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 14,
  outline: 'none',
  width: 110,
};

const lbl: React.CSSProperties = {
  fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.faint, display: 'block', marginBottom: 4,
};

type Props = { publicId: string; elo: number; gamesPlayed: number };

export default function PlayerEloForm({ publicId, elo, gamesPlayed }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(setPlayerEloAction, {});
  return (
    <form action={action} style={glass({ padding: 18 })}>
      <input type="hidden" name="publicId" value={publicId} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={lbl}>ELO</label>
          <input name="elo" type="number" step="0.01" min={0} max={9999} defaultValue={Math.round(elo)} required style={field} />
        </div>
        <div>
          <label style={lbl}>GAMES (optional)</label>
          <input name="gamesPlayed" type="number" min={0} defaultValue={gamesPlayed} placeholder={String(gamesPlayed)} style={field} />
        </div>
        <SaveButton />
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint, margin: '10px 0 0', lineHeight: 1.5 }}>
        Sets this player&apos;s rating directly. Leave games blank to keep it. Ranks recalculate on the
        next reveal, or via ⚡ Recalculate Ranks in Settings.
      </p>
      {state.ok && state.message && (
        <div style={{ fontFamily: FONT_B, color: T.win, fontSize: 13, marginTop: 10 }}>✓ {state.message}</div>
      )}
      {state.error && (
        <div style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13, marginTop: 10 }}>{state.error}</div>
      )}
    </form>
  );
}
