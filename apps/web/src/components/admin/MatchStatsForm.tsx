'use client';
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { MatchStatsSheet } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, labelStyle } from '@/components/admin/ui';
import { updateMatchStatsAction, type AdminFormState } from '@/app/admin/actions';

// Per-match stat sheet: who scored, who assisted, who kept a clean sheet.
// Collapsed behind a "⚽ STATS" button; participants load on first expand.

type Props = { matchId: string; tournamentId: string };

const numInput: React.CSSProperties = {
  width: 44,
  padding: '6px 4px',
  textAlign: 'center',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 7,
  color: T.text,
  fontFamily: FONT_M,
  fontSize: 13,
  outline: 'none',
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '9px 18px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 9,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 12,
        letterSpacing: 1.5,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'SAVING…' : 'SAVE STATS'}
    </button>
  );
}

export default function MatchStatsForm({ matchId, tournamentId }: Props) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<MatchStatsSheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, action] = useFormState<AdminFormState, FormData>(updateMatchStatsAction, {});

  useEffect(() => {
    if (!open || sheet) return;
    let alive = true;
    fetch(`/api/admin/matches/${matchId}/stats`)
      .then(r => {
        if (!r.ok) throw new Error(`Couldn't load players (${r.status})`);
        return r.json() as Promise<MatchStatsSheet>;
      })
      .then(data => { if (alive) setSheet(data); })
      .catch((e: Error) => { if (alive) setLoadError(e.message); });
    return () => { alive = false; };
  }, [open, sheet, matchId]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '6px 12px',
          background: 'none',
          border: `1px solid ${rgba(ADMIN_ACCENT, 0.45)}`,
          borderRadius: 8,
          color: ADMIN_ACCENT,
          fontFamily: FONT_M,
          fontSize: 11,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ⚽ STATS
      </button>
    );
  }

  const sides: { label: string; side: 'home' | 'away' }[] = sheet
    ? [{ label: sheet.homeTeamName, side: 'home' }, { label: sheet.awayTeamName, side: 'away' }]
    : [];

  return (
    <div style={{
      width: '100%',
      marginTop: 10,
      padding: 14,
      background: 'rgba(0,0,0,0.25)',
      border: `1px solid ${rgba(ADMIN_ACCENT, 0.3)}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: FONT_D, fontSize: 12, letterSpacing: 1.5, color: ADMIN_ACCENT }}>
          MATCH STATS — G · A · TKL · CS · MOTM · RTG · SV · POS · 🟥
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'none', border: 'none', color: T.faint,
            fontFamily: FONT_B, fontSize: 13, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {loadError ? (
        <p style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13, margin: 0 }}>{loadError}</p>
      ) : !sheet ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, margin: 0 }}>Loading players…</p>
      ) : sheet.entries.length === 0 ? (
        <p style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, margin: 0 }}>
          No participants recorded for this match — enter the result (with players) first.
        </p>
      ) : (
        <form action={action}>
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="tournamentId" value={tournamentId} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, overflowX: 'auto' }}>
            {sides.map(({ label, side }) => (
              <div key={side}>
                <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* column headers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }} />
                    <span style={{ width: 44, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>⚽ G</span>
                    <span style={{ width: 44, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>🎯 A</span>
                    <span style={{ width: 44, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>🛡 TKL</span>
                    <span style={{ width: 30, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>🧤 CS</span>
                    <span style={{ width: 30, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>⭐ MOTM</span>
                    <span style={{ width: 54, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }} title="EA match rating (blank = none)">RTG</span>
                    <span style={{ width: 44, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }}>SV</span>
                    <span style={{ width: 58, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }} title="Position played (GK detection for the Golden Glove)">POS</span>
                    <span style={{ width: 30, textAlign: 'center', fontFamily: FONT_M, fontSize: 9, color: T.faint }} title="Red card">🟥</span>
                  </div>
                  {sheet.entries.filter(e => e.side === side).map(e => (
                    <div key={e.publicId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        flex: 1, fontFamily: FONT_B, fontSize: 13, color: T.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {e.displayName}
                      </span>
                      <input name={`g_${e.publicId}`} type="number" min={0} max={99} defaultValue={e.goals} style={numInput} />
                      <input name={`a_${e.publicId}`} type="number" min={0} max={99} defaultValue={e.assists} style={numInput} />
                      <input name={`t_${e.publicId}`} type="number" min={0} max={99} defaultValue={e.tackles} style={numInput} />
                      <span style={{ width: 30, textAlign: 'center' }}>
                        <input name={`cs_${e.publicId}`} type="checkbox" defaultChecked={e.cleanSheet} style={{ accentColor: ADMIN_ACCENT, width: 15, height: 15 }} />
                      </span>
                      <span style={{ width: 30, textAlign: 'center' }} title="Man of the Match">
                        <input name={`m_${e.publicId}`} type="checkbox" defaultChecked={e.mom} style={{ accentColor: '#FFD24A', width: 15, height: 15 }} />
                      </span>
                      <input
                        name={`r_${e.publicId}`}
                        type="number" min={0} max={10} step={0.01}
                        defaultValue={e.rating ?? ''}
                        placeholder="—"
                        title="EA match rating — blank means no rating"
                        style={{ ...numInput, width: 54 }}
                      />
                      <input name={`s_${e.publicId}`} type="number" min={0} max={99} defaultValue={e.saves} style={numInput} />
                      <select
                        name={`p_${e.publicId}`}
                        defaultValue={e.position ?? ''}
                        style={{ ...numInput, width: 58, textAlign: 'left', padding: '6px 2px' }}
                      >
                        <option value="">—</option>
                        <option value="goalkeeper">GK</option>
                        <option value="defender">DEF</option>
                        <option value="midfielder">MID</option>
                        <option value="forward">FWD</option>
                      </select>
                      <span style={{ width: 30, textAlign: 'center' }} title="Red card">
                        <input name={`rc_${e.publicId}`} type="checkbox" defaultChecked={e.redCards > 0} style={{ accentColor: '#E5484D', width: 15, height: 15 }} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <SaveButton />
            {state.ok && state.message && (
              <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>✓ {state.message}</span>
            )}
            {state.error && (
              <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
