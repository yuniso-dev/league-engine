'use client';
import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { HONOURS, isRomanNumeral } from '@inazuma/core';
import type { CeremonySheet } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT } from '@/components/admin/ui';
import { buildCeremonyAnnouncement } from '@/lib/announcementDraft';
import { pickTeamOfTournament } from '@/lib/tott';
import {
  excludePlayerAction,
  removeExclusionAction,
  runCeremonyAction,
  type AdminFormState,
} from '@/app/admin/actions';

// The ceremony sheet: computed winners per honour, the GK rating table, the
// champion roster, two pickers for the VOTED honours, one GRANT ALL button,
// and a live announcement draft that always mirrors the current inputs.

const label: React.CSSProperties = {
  fontFamily: FONT_D, fontSize: 12, letterSpacing: 1.5, color: ADMIN_ACCENT,
};
const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  color: T.text,
  fontFamily: FONT_B,
  fontSize: 14,
  padding: '8px 12px',
};

function SmallSubmit({ label, color }: { label: string; color: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: 'none', border: `1px solid ${rgba(color, 0.4)}`, borderRadius: 7,
        color, fontFamily: FONT_M, fontSize: 11, letterSpacing: 1, padding: '6px 12px',
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}

/** Add-exclusion form — its own action state, separate from GRANT ALL. */
function ExcludeForm({ tournamentId, pool }: {
  tournamentId: string;
  pool: { publicId: string; displayName: string }[];
}) {
  const [state, action] = useFormState<AdminFormState, FormData>(excludePlayerAction, {});
  return (
    <form action={action} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <select name="publicId" defaultValue="" style={{ ...inputBase, minWidth: 170 }}>
        <option value="">— pick a player —</option>
        {pool.map(p => <option key={p.publicId} value={p.publicId}>{p.displayName}</option>)}
      </select>
      <input
        name="reason"
        placeholder="reason (e.g. heights)"
        maxLength={200}
        style={{ ...inputBase, flex: 1, minWidth: 160 }}
      />
      <SmallSubmit label="EXCLUDE" color={T.loss} />
      {state.ok && <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.win }}>✓</span>}
      {state.error && <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.loss }}>{state.error}</span>}
    </form>
  );
}

/** One excluded player row with its lift-exclusion form. */
function ExclusionRow({ tournamentId, exclusion }: {
  tournamentId: string;
  exclusion: { publicId: string; displayName: string; reason: string | null };
}) {
  const [state, action] = useFormState<AdminFormState, FormData>(removeExclusionAction, {});
  return (
    <form action={action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="publicId" value={exclusion.publicId} />
      <span style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.loss }}>⚠ {exclusion.displayName}</span>
      {exclusion.reason && (
        <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, flex: 1 }}>— {exclusion.reason}</span>
      )}
      <SmallSubmit label="LIFT" color={T.win} />
      {state.error && <span style={{ fontFamily: FONT_B, fontSize: 12, color: T.loss }}>{state.error}</span>}
    </form>
  );
}

function GrantButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      style={{
        fontFamily: FONT_D, fontSize: 14, letterSpacing: 1.5,
        background: disabled ? 'rgba(255,255,255,0.06)' : rgba(T.gold, 0.16),
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.15)' : rgba(T.gold, 0.55)}`,
        color: disabled ? T.faint : T.gold,
        borderRadius: 10, padding: '12px 24px',
        cursor: pending || disabled ? 'default' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'GRANTING…' : '🏆 GRANT ALL HONOURS'}
    </button>
  );
}

export default function CeremonyBoard({
  sheet,
  defaultNumeral,
}: {
  sheet: CeremonySheet;
  defaultNumeral: string;
}) {
  const [state, action] = useFormState<AdminFormState, FormData>(runCeremonyAction, {});
  const [numeral, setNumeral] = useState(defaultNumeral);
  const [pottId, setPottId] = useState('');
  const [copied, setCopied] = useState(false);

  const numeralOk = isRomanNumeral(numeral);
  const byNominee = (publicId: string) => sheet.pottNominees.find(p => p.publicId === publicId) ?? null;
  const glove = sheet.gkTable[0] ?? null;
  const defender = sheet.defenderTable[0] ?? null;

  // The grant preview + announcement recompute from CURRENT inputs — what you
  // see is exactly what GRANT ALL mints.
  const willGrant = useMemo(() => {
    const n = numeral.trim().toUpperCase();
    const rows: { icon: string; award: string; names: string }[] = [];
    const add = (key: (typeof HONOURS)[number]['key'], names: string[]) => {
      if (names.length === 0) return;
      const h = HONOURS.find(x => x.key === key)!;
      rows.push({ icon: h.icon, award: `${h.base} ${n}`, names: names.join(', ') });
    };
    add('topScorer', sheet.topScorers.map(w => w.displayName));
    add('topAssister', sheet.topAssisters.map(w => w.displayName));
    add('goldenGlove', glove ? [glove.displayName] : []);
    add('bestDefender', sheet.bestDefenders.map(w => w.displayName));
    add('pott', pottId ? [byNominee(pottId)?.displayName ?? ''] : []);
    add('champion', sheet.championTeam?.members.map(m => m.displayName) ?? []);
    add('mrInazuma', sheet.championTeam?.captain ? [sheet.championTeam.captain.displayName] : []);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeral, pottId, sheet]);

  const tott = useMemo(() => pickTeamOfTournament(sheet.ratedPlayers), [sheet]);

  const draft = useMemo(() => buildCeremonyAnnouncement({
    tournamentName: sheet.tournament.name,
    season: sheet.tournament.season,
    numeral,
    topScorers: sheet.topScorers.map(w => ({ discordId: w.discordId, value: w.value })),
    topAssisters: sheet.topAssisters.map(w => ({ discordId: w.discordId, value: w.value })),
    goldenGlove: glove ? { discordId: glove.discordId, value: glove.value } : null,
    bestDefenders: sheet.bestDefenders.map(w => ({ discordId: w.discordId, value: w.value })),
    pott: pottId ? { discordId: byNominee(pottId)?.discordId ?? '' } : null,
    champion: sheet.championTeam
      ? {
          teamName: sheet.championTeam.name,
          memberDiscordIds: sheet.championTeam.members.map(m => m.discordId),
          captainDiscordId: sheet.championTeam.captain?.discordId ?? null,
        }
      : null,
    tott: tott.map(t => ({
      emoji: t.emoji,
      label: t.label,
      players: t.players.map(p => ({ discordId: p.discordId, value: p.value })),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [numeral, pottId, sheet, tott]);

  const pottPicker = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
      <span style={label}>❄️ XAVIER FROST — POLL WINNER (TOP 4 BY RATING)</span>
      <select name="pottPublicId" value={pottId} onChange={e => setPottId(e.target.value)} style={inputBase}>
        <option value="">— not decided —</option>
        {sheet.pottNominees.map(p => (
          <option key={p.publicId} value={p.publicId}>
            {p.displayName} · {p.value.toFixed(2)} avg ({p.appearances} apps)
          </option>
        ))}
      </select>
      <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>
        {sheet.pottNominees.length === 0
          ? 'no players with 3+ rated games yet — fills as the Frontier is played'
          : 'run /awardpoll to vote across these four, then lock the winner in here'}
      </span>
    </div>
  );

  const statRow = (icon: string, title: string, winners: string, warn?: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1, color: T.text, minWidth: 170 }}>{title}</span>
      <span style={{ fontFamily: FONT_B, fontSize: 14, color: winners ? T.gold : T.faint, flex: 1 }}>
        {winners || warn || '—'}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Computed stat winners ── */}
      <div style={glass({ padding: 18 })}>
        <div style={{ ...label, marginBottom: 8 }}>STAT HONOURS — COMPUTED FROM RESULTS</div>
        {statRow('🥇', "Blaze's Boot",
          sheet.topScorers.map(w => `${w.displayName} (${w.value})`).join(', '),
          'no goals recorded yet')}
        {statRow('👑', "Sharp's Award",
          sheet.topAssisters.map(w => `${w.displayName} (${w.value})`).join(', '),
          'no assists recorded yet')}
        {statRow('🧤', "Evan's Golden Glove",
          glove ? `${glove.displayName} (${glove.value.toFixed(2)} avg, ${glove.appearances} apps)` : '',
          'no goalkeeper with 3+ rated appearances — EA auto-ingest fills this')}
        {sheet.gkTable.length > 1 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, marginBottom: 4 }}>GK TABLE</div>
            {sheet.gkTable.map((g, i) => (
              <div key={g.publicId} style={{
                display: 'flex', gap: 10, fontFamily: FONT_B, fontSize: 13, padding: '3px 0',
                color: i === 0 ? T.gold : T.dim,
              }}>
                <span style={{ fontFamily: FONT_M, minWidth: 18 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{g.displayName}</span>
                <span>{g.value.toFixed(2)} avg</span>
                <span style={{ color: T.faint }}>{g.appearances} apps</span>
              </div>
            ))}
          </div>
        )}
        {statRow('🧱', "Wallside's Award",
          sheet.bestDefenders.length > 0
            ? `${sheet.bestDefenders.map(w => w.displayName).join(', ')} (${defender ? defender.value.toFixed(2) : '—'} avg)`
            : '',
          'no defender (CB/FB) with 3+ rated appearances — EA auto-ingest fills this')}
        {sheet.defenderTable.length > 1 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, marginBottom: 4 }}>DEFENDER TABLE</div>
            {sheet.defenderTable.map((d, i) => (
              <div key={d.publicId} style={{
                display: 'flex', gap: 10, fontFamily: FONT_B, fontSize: 13, padding: '3px 0',
                color: i === 0 ? T.gold : T.dim,
              }}>
                <span style={{ fontFamily: FONT_M, minWidth: 18 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{d.displayName}</span>
                <span>{d.value.toFixed(2)} avg</span>
                <span style={{ color: T.faint }}>{d.appearances} apps</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Champion ── */}
      <div style={glass({ padding: 18 })}>
        <div style={{ ...label, marginBottom: 8 }}>CHAMPIONS</div>
        {sheet.championTeam ? (
          <>
            {statRow('🏆', 'Inazuma Frontier',
              `${sheet.championTeam.name} — ${sheet.championTeam.members.map(m => m.displayName).join(', ')}`)}
            {statRow('🎖️', 'Mr Inazuma',
              sheet.championTeam.captain?.displayName ?? '',
              'team has no captain set — assign one on the draft board')}
          </>
        ) : (
          <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.faint, margin: 0 }}>
            No winner set yet — pick the champion team in the tournament&apos;s status controls first.
          </p>
        )}
      </div>

      {/* ── Team of the Tournament (informational — included in the draft) ── */}
      <div style={glass({ padding: 18 })}>
        <div style={{ ...label, marginBottom: 8 }}>⭐ TEAM OF THE TOURNAMENT — BEST AVG RATING PER POSITION</div>
        {tott.length === 0 ? (
          <p style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.faint, margin: 0 }}>
            No players with 2+ rated appearances yet — EA auto-ingest fills the ratings as games are played.
          </p>
        ) : (
          <>
            {tott.map(t => (
              <div key={t.bucket} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 15 }}>{t.emoji}</span>
                <span style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: 1, color: T.dim, minWidth: 40 }}>{t.label}</span>
                <span style={{ fontFamily: FONT_B, fontSize: 14, color: T.gold, flex: 1 }}>
                  {t.players.map(p => `${p.displayName} (${p.value.toFixed(2)} · ${p.appearances} apps)`).join('  ·  ')}
                </span>
              </div>
            ))}
            <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: '10px 0 0' }}>
              Slots follow each player&apos;s most-played EA position (fix a wrong one via the match&apos;s ⚽ STATS editor).
              This block is informational and goes into the announcement draft — no award is granted for it.
            </p>
          </>
        )}
      </div>

      {/* ── Honours exclusions (rule violators) ── */}
      <div style={glass({ padding: 18 })}>
        <div style={{ ...label, marginBottom: 4 }}>⚠ HONOURS EXCLUSIONS</div>
        <p style={{ fontFamily: FONT_M, fontSize: 11.5, color: T.faint, margin: '0 0 8px' }}>
          Rule violators (heights etc.): excluded players can&apos;t win computed honours, make the
          Team of the Tournament, or top the races — their match stats and team results stand.
          They remain pickable in the voted-award dropdowns; that call stays yours.
        </p>
        {sheet.exclusions.map(x => (
          <ExclusionRow key={x.publicId} tournamentId={sheet.tournament.id} exclusion={x} />
        ))}
        <ExcludeForm tournamentId={sheet.tournament.id} pool={sheet.voterPool} />
      </div>

      {/* ── The form: numeral + voted honours + GRANT ALL ── */}
      <form action={action} style={glass({ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 })}>
        <input type="hidden" name="tournamentId" value={sheet.tournament.id} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>EDITION NUMERAL — NAMES ALL 7 HONOURS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              name="numeral"
              value={numeral}
              onChange={e => setNumeral(e.target.value.toUpperCase())}
              placeholder="e.g. XVII"
              style={{ ...inputBase, width: 120, borderColor: numeral && !numeralOk ? rgba(T.loss, 0.6) : undefined }}
            />
            <span style={{ fontFamily: FONT_M, fontSize: 11, color: numeral && !numeralOk ? T.loss : T.faint }}>
              {numeral && !numeralOk
                ? 'not a valid roman numeral'
                : `mints “Blaze’s Boot ${numeral || 'XVII'}”, “Xavier Frost ${numeral || 'XVII'}”, and every other honour`}
            </span>
          </div>
          {pottPicker}
        </div>

        {willGrant.length > 0 && (
          <div>
            <div style={{ ...label, marginBottom: 6 }}>WILL GRANT</div>
            {willGrant.map(r => (
              <div key={r.award} style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim, padding: '2px 0' }}>
                {r.icon} <span style={{ color: T.text }}>{r.award}</span> → {r.names}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <GrantButton disabled={!numeralOk || willGrant.length === 0} />
          {state.error && <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.loss }}>{state.error}</span>}
          {state.ok && <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.win }}>{state.message ?? 'Done.'}</span>}
        </div>
        <p style={{ fontFamily: FONT_M, fontSize: 11.5, color: T.faint, margin: 0 }}>
          Safe to re-run — players already holding an honour for this Frontier are skipped, never duplicated.
        </p>
      </form>

      {/* ── Announcement draft ── */}
      <div style={glass({ padding: 18 })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={label}>ANNOUNCEMENT DRAFT — COPY, PUNCH UP, POST</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(draft).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            style={{
              fontFamily: FONT_M, fontSize: 11, letterSpacing: 1,
              background: copied ? rgba(T.win, 0.15) : 'rgba(255,255,255,0.06)',
              border: `1px solid ${copied ? rgba(T.win, 0.5) : 'rgba(255,255,255,0.18)'}`,
              color: copied ? T.win : T.dim,
              borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>
        <pre style={{
          fontFamily: FONT_M, fontSize: 12.5, lineHeight: 1.7, color: T.dim,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
          background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 14,
        }}>
          {draft}
        </pre>
        <p style={{ fontFamily: FONT_M, fontSize: 11.5, color: T.faint, margin: '10px 0 0' }}>
          Mentions appear as raw &lt;@id&gt; here but render as @names when posted in Discord.
          The @everyone is spoilered so it only fires when you choose to reveal it.
        </p>
      </div>
    </div>
  );
}
