'use client';
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AdminTeam, MatchStage } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass } from '@/lib/realm-colors';
import { ADMIN_ACCENT, STAGE_LABELS, inputBase, labelStyle } from '@/components/admin/ui';
import GlassSelect from '@/components/ui/GlassSelect';
import { createMatchAction, type AdminFormState } from '@/app/admin/actions';

type Props = {
  tournamentId: string;
  teams: AdminTeam[];
  defaultRanked: boolean;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      style={{
        padding: '12px 24px',
        background: ADMIN_ACCENT,
        border: 'none',
        borderRadius: 10,
        color: '#fff',
        fontFamily: FONT_D,
        fontSize: 14,
        letterSpacing: 1.5,
        cursor: pending || disabled ? 'not-allowed' : 'pointer',
        opacity: pending || disabled ? 0.6 : 1,
      }}
    >
      {pending ? 'SAVING…' : 'SAVE RESULT'}
    </button>
  );
}

function TeamPicker({
  side,
  label,
  teams,
  excludeTeamId,
  teamId,
  onTeamChange,
  selectedPlayers,
  onTogglePlayer,
}: {
  side: 'homePlayers' | 'awayPlayers';
  label: string;
  teams: AdminTeam[];
  excludeTeamId: string;
  teamId: string;
  onTeamChange: (id: string) => void;
  selectedPlayers: Set<string>;
  onTogglePlayer: (publicId: string) => void;
}) {
  const team = teams.find(t => t.id === teamId);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <GlassSelect
        name={side === 'homePlayers' ? 'homeTeamId' : 'awayTeamId'}
        value={teamId}
        onChange={onTeamChange}
        placeholder="— Pick team —"
        required
        options={[
          { value: '', label: '— Pick team —' },
          // The team picked on the other side isn't offered here.
          ...teams.filter(t => t.id !== excludeTeamId).map(t => ({ value: t.id, label: t.name })),
        ]}
        accent={ADMIN_ACCENT}
      />

      {team && (
        <div style={{
          marginTop: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          maxHeight: 180,
          overflowY: 'auto',
        }}>
          {team.members.length === 0 ? (
            <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 12 }}>
              This team has no players.
            </div>
          ) : (
            team.members.map(m => {
              const checked = selectedPlayers.has(m.publicId);
              return (
                <label
                  key={m.publicId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 11px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontFamily: FONT_B,
                    fontSize: 13,
                    color: checked ? T.text : T.faint,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onTogglePlayer(m.publicId)}
                    style={{ width: 14, height: 14, accentColor: ADMIN_ACCENT }}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.displayName}
                  </span>
                  {m.position1 && (
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                      {m.position1}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      )}
      {selectedPlayers.size > 0 &&
        [...selectedPlayers].map(id => (
          <input key={id} type="hidden" name={side} value={id} />
        ))}
    </div>
  );
}

export default function MatchEntryForm({ tournamentId, teams, defaultRanked }: Props) {
  const [state, action] = useFormState<AdminFormState, FormData>(createMatchAction, {});
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [homeSel, setHomeSel] = useState<Set<string>>(new Set());
  const [awaySel, setAwaySel] = useState<Set<string>>(new Set());
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [saved, setSaved] = useState(false);

  // Everyone on the roster played, unless the admin unticks them.
  const pickTeam = (side: 'home' | 'away') => (id: string) => {
    const members = new Set(teams.find(t => t.id === id)?.members.map(m => m.publicId) ?? []);
    if (side === 'home') { setHomeTeamId(id); setHomeSel(members); }
    else { setAwayTeamId(id); setAwaySel(members); }
  };

  const togglePlayer = (side: 'home' | 'away') => (publicId: string) => {
    const setter = side === 'home' ? setHomeSel : setAwaySel;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  };

  useEffect(() => {
    if (state.ok) {
      // Keep team + player selections so back-to-back fixtures are fast to enter;
      // just clear the scoreline and flash confirmation.
      setHomeScore('');
      setAwayScore('');
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const ready = homeTeamId !== '' && awayTeamId !== '' && homeSel.size > 0 && awaySel.size > 0;

  return (
    <form action={action}>
      <div style={glass({ padding: 20 })}>
        <div style={{ fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5, color: T.dim, marginBottom: 14 }}>
          ENTER MATCH RESULT
        </div>
        <input type="hidden" name="tournamentId" value={tournamentId} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <TeamPicker
            side="homePlayers"
            label="Home team"
            teams={teams}
            excludeTeamId={awayTeamId}
            teamId={homeTeamId}
            onTeamChange={pickTeam('home')}
            selectedPlayers={homeSel}
            onTogglePlayer={togglePlayer('home')}
          />
          <TeamPicker
            side="awayPlayers"
            label="Away team"
            teams={teams}
            excludeTeamId={homeTeamId}
            teamId={awayTeamId}
            onTeamChange={pickTeam('away')}
            selectedPlayers={awaySel}
            onTogglePlayer={togglePlayer('away')}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 12,
          marginTop: 18,
        }}>
          <div>
            <label style={labelStyle}>Home score</label>
            <input
              name="homeScore"
              type="number"
              min={0}
              max={99}
              required
              value={homeScore}
              onChange={e => setHomeScore(e.target.value)}
              style={inputBase}
            />
          </div>
          <div>
            <label style={labelStyle}>Away score</label>
            <input
              name="awayScore"
              type="number"
              min={0}
              max={99}
              required
              value={awayScore}
              onChange={e => setAwayScore(e.target.value)}
              style={inputBase}
            />
          </div>
          <div>
            <label style={labelStyle}>Stage</label>
            <GlassSelect
              name="stage"
              defaultValue="group"
              options={(Object.keys(STAGE_LABELS) as MatchStage[]).map(s => ({
                value: s,
                label: STAGE_LABELS[s],
              }))}
              accent={ADMIN_ACCENT}
            />
          </div>
          <div>
            <label style={labelStyle}>Played at</label>
            <input name="playedAt" type="datetime-local" style={inputBase} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
          <SubmitButton disabled={!ready} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="ranked"
              defaultChecked={defaultRanked}
              style={{ width: 15, height: 15, accentColor: ADMIN_ACCENT }}
            />
            <span style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14 }}>
              Counts for Elo (ranked)
            </span>
          </label>
          {state.error && (
            <span style={{ fontFamily: FONT_B, color: T.loss, fontSize: 13 }}>{state.error}</span>
          )}
          {saved && !state.error && (
            <span style={{ fontFamily: FONT_B, color: T.win, fontSize: 13 }}>Result saved ✓</span>
          )}
        </div>
      </div>
    </form>
  );
}
