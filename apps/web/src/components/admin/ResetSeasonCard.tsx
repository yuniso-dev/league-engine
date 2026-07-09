'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { resetSeasonAction, type AdminFormState } from '@/app/admin/actions';

// Nuclear option: wipe the whole ladder back to base Elo and start a new
// season. Guarded by a type-RESET confirm. History (tournaments, matches,
// awards) is kept — only ratings/games/ranks/rating-history are cleared.

const DANGER = '#ff5a5f';

function GoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '11px 20px',
        background: 'none',
        border: `1px solid ${rgba(DANGER, 0.6)}`,
        borderRadius: 10,
        color: DANGER,
        fontFamily: FONT_D,
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'RESETTING…' : '⚠ RESET SEASON'}
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
};

export default function ResetSeasonCard({ currentSeason }: { currentSeason: number }) {
  const [state, action] = useFormState<AdminFormState, FormData>(resetSeasonAction, {});
  return (
    <form
      action={action}
      style={{ ...glass({ padding: 20 }), marginTop: 20, border: `1px solid ${rgba(DANGER, 0.3)}` }}
      onSubmit={e => {
        if (!window.confirm('Reset the ENTIRE ladder to base Elo and start a new season? History is kept, but every player goes back to 1000 and unranked. This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: DANGER, marginBottom: 6 }}>
        RESET SEASON
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '0 0 14px', lineHeight: 1.6 }}>
        Sends every player back to base Elo, clears games, ranks and the rating-history graphs, and
        starts a new season. Tournaments, matches and awards are <strong>kept</strong> (so the Hall of
        Fame and past seasons stay intact). Use this to start the real league after a test run.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.faint, display: 'block', marginBottom: 4 }}>
            NEW SEASON №
          </label>
          <input name="newSeason" type="number" min={1} defaultValue={currentSeason + 1} required style={{ ...field, width: 90 }} />
        </div>
        <div>
          <label style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.faint, display: 'block', marginBottom: 4 }}>
            TYPE &ldquo;RESET&rdquo; TO CONFIRM
          </label>
          <input name="confirm" type="text" placeholder="RESET" autoComplete="off" style={{ ...field, width: 150 }} />
        </div>
        <GoButton />
      </div>
      {state.ok && state.message && (
        <div style={{ fontFamily: FONT_B, color: T.win, fontSize: 13, marginTop: 12 }}>✓ {state.message}</div>
      )}
      {state.error && (
        <div style={{ fontFamily: FONT_B, color: DANGER, fontSize: 13, marginTop: 12 }}>{state.error}</div>
      )}
    </form>
  );
}
