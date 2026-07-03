'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminAwardWithHolders, TournamentRow } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { grantAwardAction, type AdminFormState } from '@/app/admin/actions';
import { AwardBadgeIcon } from '@/components/AwardsBadgeRow';
import PlayerPicker from '@/components/admin/PlayerPicker';
import GlassSelect from '@/components/ui/GlassSelect';

// The awards control centre: search, every award with its holders, and
// grant-in-place — no page hop needed to hand out a trophy.

type Props = {
  awards: AdminAwardWithHolders[];
  tournaments: TournamentRow[];
  defaultSeason: number;
};

function GrantButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      style={{
        padding: '10px 18px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 9,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 12.5,
        letterSpacing: 1.5,
        cursor: pending || disabled ? 'not-allowed' : 'pointer',
        opacity: pending || disabled ? 0.6 : 1,
      }}
    >
      {pending ? 'GRANTING…' : 'GRANT'}
    </button>
  );
}

function QuickGrant({ award, tournaments, defaultSeason }: {
  award: AdminAwardWithHolders;
  tournaments: TournamentRow[];
  defaultSeason: number;
}) {
  const [state, action] = useFormState<AdminFormState, FormData>(grantAwardAction, {});
  const [selected, setSelected] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSelected(null);
      setResetKey(k => k + 1);
      formRef.current?.reset();
    }
  }, [state]);

  const selectedIds = useMemo(() => new Set(selected ? [selected] : []), [selected]);

  return (
    <form ref={formRef} action={action} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <input type="hidden" name="awardId" value={award.id} />
      <input type="hidden" name="publicId" value={selected ?? ''} />

      <PlayerPicker
        key={resetKey}
        mode="single"
        selectedIds={selectedIds}
        onToggle={publicId => setSelected(prev => (prev === publicId ? null : publicId))}
        searchLabel="Grant to"
        maxHeight={170}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10, marginTop: 12 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <GrantButton disabled={selected === null} />
        {state.ok && (
          <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>✓ Granted</span>
        )}
        {state.error && (
          <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
        )}
      </div>
    </form>
  );
}

export default function AwardsHub({ awards, tournaments, defaultSeason }: Props) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awards;
    return awards.filter(
      a => a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q),
    );
  }, [awards, query]);

  if (awards.length === 0) {
    return (
      <div style={glass({ padding: 36, textAlign: 'center', marginBottom: 20 })}>
        <p style={{ fontFamily: FONT_B, color: T.dim, margin: 0 }}>
          No awards yet — tap a classic below or create your own.
        </p>
      </div>
    );
  }

  return (
    <>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search awards…"
        autoComplete="off"
        style={{ ...inputBase, maxWidth: 300, marginBottom: 14 }}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 12,
        marginBottom: 24,
        alignItems: 'start',
      }}>
        {filtered.map(a => {
          const open = openId === a.id;
          const preview = a.holders.slice(0, 3);
          const more = a.grantCount - preview.length;
          return (
            <div key={a.id} style={glass({ padding: 16, ...(open ? { border: `1px solid ${rgba(ADMIN_ACCENT, 0.45)}` } : {}) })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AwardBadgeIcon imageUrl={a.imageUrl} icon={a.icon} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1, color: T.text }}>
                    {a.name}
                  </div>
                  {a.description && (
                    <div style={{ fontFamily: FONT_B, fontSize: 12, color: T.dim, marginTop: 2 }}>
                      {a.description}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.faint, margin: '10px 0 0' }}>
                {a.grantCount === 0 ? (
                  'No holders yet'
                ) : (
                  <>
                    <span style={{ color: T.gold }}>
                      {preview.map(h => h.displayName).join(', ')}
                    </span>
                    {more > 0 && ` +${more} more`}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : a.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: open ? rgba(ADMIN_ACCENT, 0.22) : 'none',
                    border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`,
                    borderRadius: 8,
                    color: open ? '#fff' : ADMIN_ACCENT,
                    fontFamily: FONT_D,
                    fontSize: 12,
                    letterSpacing: 1.5,
                    cursor: 'pointer',
                  }}
                >
                  {open ? '× CLOSE' : '⚡ GRANT'}
                </button>
                <Link
                  href={`/admin/awards/${a.id}`}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8,
                    color: T.dim,
                    fontFamily: FONT_M,
                    fontSize: 12,
                    letterSpacing: 1,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  MANAGE
                </Link>
              </div>

              {open && (
                <QuickGrant award={a} tournaments={tournaments} defaultSeason={defaultSeason} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
