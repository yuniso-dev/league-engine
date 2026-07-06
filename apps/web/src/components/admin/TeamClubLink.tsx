'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_M, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { setTeamClubAction, type AdminFormState } from '@/app/admin/actions';

// Per-team EA club binding on the tournament page cards. Linked teams get
// their results auto-recorded from the EA API while the Frontier is live.

const LIVE = '#3DDC97';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: 'none',
        border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`,
        borderRadius: 7,
        padding: '4px 10px',
        color: ADMIN_ACCENT,
        fontFamily: FONT_M,
        fontSize: 10,
        letterSpacing: 0.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? '…' : 'SAVE'}
    </button>
  );
}

export default function TeamClubLink({ teamId, tournamentId, eaClubId }: {
  teamId: string;
  tournamentId: string;
  eaClubId: string | null;
}) {
  const [state, action] = useFormState<AdminFormState, FormData>(setTeamClubAction, {});

  return (
    <form action={action} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          title={eaClubId ? 'EA club linked — results auto-record while live' : 'No EA club linked — results stay manual'}
          style={{ fontSize: 11, flexShrink: 0, color: eaClubId ? LIVE : T.faint, fontFamily: FONT_M }}
        >
          {eaClubId ? '🔗' : '⛓️‍💥'}
        </span>
        <input
          name="eaClubId"
          defaultValue={eaClubId ?? ''}
          maxLength={12}
          inputMode="numeric"
          autoComplete="off"
          placeholder="EA Club ID"
          style={{
            flex: 1, minWidth: 0,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            padding: '4px 8px',
            color: T.text,
            fontFamily: FONT_M,
            fontSize: 11,
            outline: 'none',
          }}
        />
        <SaveButton />
      </div>
      {state.error && (
        <p style={{ fontFamily: FONT_B, fontSize: 11, color: T.loss, margin: '6px 0 0' }}>{state.error}</p>
      )}
    </form>
  );
}
