'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { PendingMatch } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { applyPendingAction, discardPendingAction, type AdminFormState } from '@/app/admin/actions';

// Captured games awaiting the admin's call — everything the EA sync saw
// between linked clubs that had no open fixture (usually the replay after a
// bugged game). APPLY swaps a game onto the fixture (voiding whatever it
// replaces); DISCARD bins it. Part-played glitch games are visible by their
// in-game duration (~45' vs 90').

function ActionButton({ label, color }: { label: string; color: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: 'none', border: `1px solid ${rgba(color, 0.45)}`, borderRadius: 7,
        color, fontFamily: FONT_M, fontSize: 11, letterSpacing: 1, padding: '6px 12px',
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}

function PendingRow({ game, tournamentId }: { game: PendingMatch; tournamentId: string }) {
  const [applyState, applyForm] = useFormState<AdminFormState, FormData>(applyPendingAction, {});
  const [discardState, discardForm] = useFormState<AdminFormState, FormData>(discardPendingAction, {});
  const resolved = applyState.ok || discardState.ok;

  const shortGame = game.durationMin != null && game.durationMin < 80;

  return (
    <div style={glass({ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' })}>
      <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.text, flex: 1, minWidth: 200 }}>
        {game.teamAName}
        <span style={{ fontFamily: FONT_M, color: T.gold, margin: '0 8px' }}>
          {game.scoreA} – {game.scoreB}
        </span>
        {game.teamBName}
      </span>
      <span
        title="In-game minutes — a full game is ~90'; much less means it was abandoned mid-way"
        style={{ fontFamily: FONT_M, fontSize: 11, color: shortGame ? T.loss : T.dim, whiteSpace: 'nowrap' }}
      >
        ⏱ ~{game.durationMin ?? '?'}&apos;{shortGame ? ' — part-played' : ''}
      </span>
      {game.dnf && <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.loss }}>DNF</span>}
      <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, whiteSpace: 'nowrap' }}>
        {game.playedAt.toISOString().slice(0, 16).replace('T', ' ')}
      </span>

      {resolved ? (
        <span style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.win }}>
          ✓ {applyState.message ?? discardState.message}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <form
            action={applyForm}
            onSubmit={e => {
              if (!window.confirm(
                'APPLY this game to the fixture? If the fixture already has a result, that old game is VOIDED ' +
                '(blacklisted, stats wiped) and this one takes its place — score and every stat line.',
              )) e.preventDefault();
            }}
            style={{ display: 'inline-flex' }}
          >
            <input type="hidden" name="eaMatchId" value={game.eaMatchId} />
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <ActionButton label="APPLY" color={T.win} />
          </form>
          <form
            action={discardForm}
            onSubmit={e => {
              if (!window.confirm('Discard this captured game? It stays on record but can never be applied or re-ingested.')) e.preventDefault();
            }}
            style={{ display: 'inline-flex' }}
          >
            <input type="hidden" name="eaMatchId" value={game.eaMatchId} />
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <ActionButton label="DISCARD" color={T.loss} />
          </form>
        </span>
      )}
      {(applyState.error || discardState.error) && (
        <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.loss, width: '100%' }}>
          {applyState.error ?? discardState.error}
        </span>
      )}
    </div>
  );
}

export default function PendingGames({ games, tournamentId }: { games: PendingMatch[]; tournamentId: string }) {
  if (games.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1.5, color: T.gold, marginBottom: 6 }}>
        🧾 CAPTURED GAMES — AWAITING YOUR CALL ({games.length})
      </div>
      <p style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.faint, margin: '0 0 10px' }}>
        Games between linked clubs with no open fixture — usually the replay after a bugged game.
        <strong style={{ color: T.dim }}> APPLY</strong> swaps one onto the fixture (the game it replaces is voided);
        <strong style={{ color: T.dim }}> DISCARD</strong> bins it. To merge stats from a part-played game,
        apply the real one first, then hand-edit in ⚽ STATS.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {games.map(g => <PendingRow key={g.eaMatchId} game={g} tournamentId={tournamentId} />)}
      </div>
    </div>
  );
}
