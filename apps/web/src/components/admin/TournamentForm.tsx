'use client';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { createTournamentAction, updateTournamentAction, type AdminFormState } from '@/app/admin/actions';

type TournamentValues = { id: string; name: string; season: number; ranked: boolean; date: string | null };

type Props =
  | { mode: 'create'; defaultSeason: number }
  | { mode: 'edit'; tournament: TournamentValues };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 28,
        width: '100%',
        padding: '13px 0',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 16,
        letterSpacing: 2,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function TournamentForm(props: Props) {
  const isEdit = props.mode === 'edit';
  const action = isEdit ? updateTournamentAction : createTournamentAction;
  const [state, formAction] = useFormState<AdminFormState, FormData>(action, {});

  const values: Omit<TournamentValues, 'id'> = isEdit
    ? props.tournament
    : { name: '', season: props.defaultSeason, ranked: true, date: null };

  const backHref = isEdit ? `/admin/tournaments/${props.tournament.id}` : '/admin';

  return (
    <form action={formAction} style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={glass({ padding: 36, borderRadius: 22 })}>
        <h1 style={{
          fontFamily: FONT_D, fontSize: 24, color: ADMIN_ACCENT,
          margin: '0 0 4px', letterSpacing: 2,
        }}>
          {isEdit ? 'EDIT TOURNAMENT' : 'NEW TOURNAMENT'}
        </h1>
        <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
          {isEdit
            ? 'Update the tournament details below.'
            : 'Teams and matches are added on the tournament page after creation.'}
        </p>

        {isEdit && <input type="hidden" name="tournamentId" value={props.tournament.id} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              name="name"
              maxLength={80}
              required
              autoComplete="off"
              placeholder="Frontier #1"
              defaultValue={values.name}
              style={inputBase}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Season</label>
              <input
                name="season"
                type="number"
                min={1}
                defaultValue={values.season}
                required
                style={inputBase}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="ranked"
                  defaultChecked={values.ranked}
                  style={{ width: 16, height: 16, accentColor: ADMIN_ACCENT }}
                />
                <span style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14 }}>
                  Ranked
                </span>
              </label>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Date</label>
            <input name="date" type="date" defaultValue={values.date ?? ''} style={inputBase} />
          </div>
        </div>

        {state.error && (
          <p style={{ fontFamily: FONT_B, color: T.loss, fontSize: 14, margin: '18px 0 0' }}>
            {state.error}
          </p>
        )}

        <SubmitButton
          label={isEdit ? 'SAVE CHANGES' : 'CREATE TOURNAMENT'}
          pendingLabel={isEdit ? 'SAVING…' : 'CREATING…'}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href={backHref} style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, textDecoration: 'none' }}>
          ← Back
        </Link>
      </div>
    </form>
  );
}
