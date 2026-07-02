'use client';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { FONT_B, FONT_D, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { createTournamentAction, type AdminFormState } from '@/app/admin/actions';

function SubmitButton() {
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
      {pending ? 'CREATING…' : 'CREATE TOURNAMENT'}
    </button>
  );
}

export default function TournamentForm({ defaultSeason }: { defaultSeason: number }) {
  const [state, action] = useFormState<AdminFormState, FormData>(createTournamentAction, {});

  return (
    <form action={action} style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={glass({ padding: 36, borderRadius: 22 })}>
        <h1 style={{
          fontFamily: FONT_D, fontSize: 24, color: ADMIN_ACCENT,
          margin: '0 0 4px', letterSpacing: 2,
        }}>
          NEW TOURNAMENT
        </h1>
        <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '0 0 28px' }}>
          Teams and matches are added on the tournament page after creation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              name="name"
              maxLength={80}
              required
              autoComplete="off"
              placeholder="Frontier #1"
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
                defaultValue={defaultSeason}
                required
                style={inputBase}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="ranked"
                  defaultChecked
                  style={{ width: 16, height: 16, accentColor: ADMIN_ACCENT }}
                />
                <span style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14 }}>
                  Ranked
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input name="startDate" type="date" style={inputBase} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input name="endDate" type="date" style={inputBase} />
            </div>
          </div>
        </div>

        {state.error && (
          <p style={{ fontFamily: FONT_B, color: T.loss, fontSize: 14, margin: '18px 0 0' }}>
            {state.error}
          </p>
        )}

        <SubmitButton />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/admin" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, textDecoration: 'none' }}>
          ← Back to tournaments
        </Link>
      </div>
    </form>
  );
}
