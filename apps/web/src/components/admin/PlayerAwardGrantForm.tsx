'use client';
import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminAward, TournamentRow } from '@inazuma/db';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import GlassSelect from '@/components/ui/GlassSelect';
import { grantAwardAction, type AdminFormState } from '@/app/admin/actions';

// The inverse of AwardGrantForm: the player is fixed, the award is picked.
type Props = {
  playerPublicId: string;
  awards: AdminAward[];
  tournaments: TournamentRow[];
  defaultSeason: number;
};

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
      {pending ? 'GRANTING…' : 'GRANT AWARD'}
    </button>
  );
}

export default function PlayerAwardGrantForm({ playerPublicId, awards, tournaments, defaultSeason }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(grantAwardAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (awards.length === 0) {
    return (
      <div style={glass({ padding: 20 })}>
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, margin: 0 }}>
          No awards defined yet — create one on the Awards page first.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          GRANT AN AWARD
        </div>
        <input type="hidden" name="publicId" value={playerPublicId} />
        <input type="hidden" name="playerPublicId" value={playerPublicId} />

        <div>
          <label style={labelStyle}>Award</label>
          <GlassSelect
            name="awardId"
            defaultValue=""
            required
            placeholder="Pick an award…"
            options={awards.map(a => ({
              value: a.id,
              label: `${a.icon ? `${a.icon} ` : ''}${a.name}`,
            }))}
            accent={ADMIN_ACCENT}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, marginTop: 14 }}>
          <div>
            <label style={labelStyle}>Tournament (optional)</label>
            <GlassSelect
              name="tournamentId"
              defaultValue=""
              options={[
                { value: '', label: '— None —' },
                ...tournaments.map(t => ({ value: t.id, label: t.name })),
              ]}
              accent={ADMIN_ACCENT}
            />
          </div>
          <div>
            <label style={labelStyle}>Season</label>
            <input name="season" type="number" min={1} defaultValue={defaultSeason} style={inputBase} />
          </div>
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
