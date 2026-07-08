'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminMatch, AdminPlayerOption } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase, labelStyle } from '@/components/admin/ui';
import { recordMatchResultAction, deleteMatchAction, type AdminFormState } from '@/app/admin/actions';
import DeleteButton from '@/components/admin/DeleteButton';

// Result entry for a generated fixture (a bracket match without a score yet).
// Everyone on each roster is ticked by default — untick absentees, type the
// score, save.

type Props = {
  tournamentId: string;
  match: AdminMatch;
  /** Precomputed stage label (e.g. "Best of 5 · Game 2" for a series). */
  stageLabel: string;
  homeMembers: AdminPlayerOption[];
  awayMembers: AdminPlayerOption[];
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
      {pending ? 'SAVING…' : 'SAVE RESULT'}
    </button>
  );
}

function RosterTicks({
  side, members, checked, onToggle,
}: {
  side: 'homePlayers' | 'awayPlayers';
  members: AdminPlayerOption[];
  checked: Set<string>;
  onToggle: (publicId: string) => void;
}) {
  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 9,
      maxHeight: 150,
      overflowY: 'auto',
      marginTop: 6,
    }}>
      {members.length === 0 ? (
        <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 12, padding: 10 }}>No players on this team.</div>
      ) : (
        members.map(m => (
          <label key={m.publicId} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 9px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontFamily: FONT_B, fontSize: 12.5,
            color: checked.has(m.publicId) ? T.text : T.faint, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={checked.has(m.publicId)}
              onChange={() => onToggle(m.publicId)}
              style={{ width: 13, height: 13, accentColor: ADMIN_ACCENT }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.displayName}
            </span>
          </label>
        ))
      )}
      {[...checked].map(id => (
        <input key={id} type="hidden" name={side} value={id} />
      ))}
    </div>
  );
}

export default function FixtureResultForm({ tournamentId, match, stageLabel, homeMembers, awayMembers }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(recordMatchResultAction, {});
  const [homeSel, setHomeSel] = useState<Set<string>>(new Set(homeMembers.map(m => m.publicId)));
  const [awaySel, setAwaySel] = useState<Set<string>>(new Set(awayMembers.map(m => m.publicId)));
  const [open, setOpen] = useState(false);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (publicId: string) =>
    setter(prev => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });

  return (
    <div style={glass({ padding: '12px 16px', border: `1px solid ${rgba(ADMIN_ACCENT, 0.25)}` })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: ADMIN_ACCENT }}>
          {stageLabel}
        </span>
        <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 180 }}>
          {match.homeTeamName} <span style={{ color: T.faint }}>vs</span> {match.awayTeamName}
        </span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none',
            border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`,
            borderRadius: 8, padding: '6px 14px',
            color: ADMIN_ACCENT, fontFamily: FONT_D, fontSize: 12, letterSpacing: 1,
            cursor: 'pointer',
          }}
        >
          {open ? 'CLOSE' : 'ENTER RESULT'}
        </button>
        <DeleteButton
          action={deleteMatchAction}
          hidden={{ matchId: match.id, tournamentId }}
          confirmText={`Delete the ${match.homeTeamName} vs ${match.awayTeamName} fixture?`}
        />
      </div>

      {open && (
        <form action={action} style={{ marginTop: 12 }}>
          <input type="hidden" name="matchId" value={match.id} />
          <input type="hidden" name="tournamentId" value={tournamentId} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>{match.homeTeamName} score</label>
              <input name="homeScore" type="number" min={0} max={99} required style={inputBase} />
              <RosterTicks side="homePlayers" members={homeMembers} checked={homeSel} onToggle={toggle(setHomeSel)} />
            </div>
            <div>
              <label style={labelStyle}>{match.awayTeamName} score</label>
              <input name="awayScore" type="number" min={0} max={99} required style={inputBase} />
              <RosterTicks side="awayPlayers" members={awayMembers} checked={awaySel} onToggle={toggle(setAwaySel)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <SaveButton />
            {state.error && (
              <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 12.5 }}>{state.error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
