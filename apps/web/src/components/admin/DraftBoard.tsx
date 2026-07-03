'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminTeam } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase } from '@/components/admin/ui';
import { useAdminPlayers } from '@/lib/useAdminPlayers';
import {
  addTeamMemberAction,
  removeTeamMemberAction,
  setCaptainAction,
  type AdminFormState,
} from '@/app/admin/actions';

// Rapid roster assignment for big drafts (44–66 players): pick a team once,
// then every click on a pool player drops them straight onto it. Optimistic —
// the click lands instantly, the server catches up in the background.
// The pool knows who signed up (⚡) and who is in voice RIGHT NOW (green dot,
// mirrored live by the Discord bot) — signups say "I want in", voice says
// "I actually showed up". Draft from the overlap.

const LIVE = '#3DDC97';

type Props = {
  tournamentId: string;
  teams: AdminTeam[];
  signedUpIds: string[];
  inVoiceIds: string[];
};

type PoolFilter = 'signedup' | 'voice' | 'all';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

export default function DraftBoard({ tournamentId, teams, signedUpIds, inVoiceIds }: Props) {
  const router = useRouter();
  const { players, loading, error: loadError } = useAdminPlayers();
  const [query, setQuery] = useState('');
  const [activeTeamId, setActiveTeamId] = useState(teams[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const signedUp = useMemo(() => new Set(signedUpIds), [signedUpIds]);
  const inVoice = useMemo(() => new Set(inVoiceIds), [inVoiceIds]);
  const [filter, setFilter] = useState<PoolFilter>(signedUpIds.length > 0 ? 'signedup' : 'all');

  // publicId → teamId overrides applied on click, reconciled when the server
  // re-renders the page with fresh rosters.
  const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map());

  const serverAssignment = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) for (const member of t.members) m.set(member.publicId, t.id);
    return m;
  }, [teams]);

  const assignmentOf = (publicId: string): string | null =>
    overrides.has(publicId) ? overrides.get(publicId)! : serverAssignment.get(publicId) ?? null;

  const run = (action: (p: AdminFormState, f: FormData) => Promise<AdminFormState>, data: Record<string, string>, revert: () => void) => {
    startTransition(async () => {
      const result = await action({}, fd(data));
      if (result.error) {
        setError(result.error);
        revert();
      } else {
        setError(null);
      }
    });
  };

  const assign = (publicId: string) => {
    if (!activeTeamId) return;
    const prev = assignmentOf(publicId);
    setOverrides(m => new Map(m).set(publicId, activeTeamId));
    run(addTeamMemberAction, { teamId: activeTeamId, publicId, tournamentId }, () =>
      setOverrides(m => new Map(m).set(publicId, prev)),
    );
  };

  const unassign = (publicId: string, teamId: string) => {
    const prev = assignmentOf(publicId);
    setOverrides(m => new Map(m).set(publicId, null));
    run(removeTeamMemberAction, { teamId, publicId, tournamentId }, () =>
      setOverrides(m => new Map(m).set(publicId, prev)),
    );
  };

  const makeCaptain = (publicId: string, teamId: string) => {
    run(setCaptainAction, { teamId, publicId, tournamentId }, () => {});
  };

  const byId = useMemo(() => new Map(players.map(p => [p.publicId, p])), [players]);

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(p =>
        assignmentOf(p.publicId) === null &&
        (filter === 'all' ||
          (filter === 'signedup' && signedUp.has(p.publicId)) ||
          (filter === 'voice' && inVoice.has(p.publicId))) &&
        (!q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)),
      )
      // In voice first, then signed-up, then the rest — the show-ups float to the top.
      .sort((a, b) => {
        const av = inVoice.has(a.publicId) ? 0 : 1;
        const bv = inVoice.has(b.publicId) ? 0 : 1;
        if (av !== bv) return av - bv;
        const as = signedUp.has(a.publicId) ? 0 : 1;
        const bs = signedUp.has(b.publicId) ? 0 : 1;
        if (as !== bs) return as - bs;
        return a.displayName.localeCompare(b.displayName);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, query, filter, overrides, serverAssignment, signedUp, inVoice]);

  const rosterOf = (teamId: string) => {
    const ids = new Set<string>();
    for (const [pid, tid] of serverAssignment) if (tid === teamId) ids.add(pid);
    for (const [pid, tid] of overrides) {
      if (tid === teamId) ids.add(pid);
      else ids.delete(pid);
    }
    return [...ids];
  };

  if (teams.length === 0) {
    return (
      <div style={glass({ padding: 30, textAlign: 'center' })}>
        <p style={{ fontFamily: FONT_B, color: T.dim, margin: 0 }}>
          Create the teams first (back on the tournament page), then draft players here.
        </p>
      </div>
    );
  }

  return (
    <>
      {(error || loadError) && (
        <div style={{
          ...glass({ padding: '10px 16px' }),
          border: `1px solid ${rgba(T.loss, 0.4)}`,
          fontFamily: FONT_B, fontSize: 13, color: T.loss, marginBottom: 14,
        }}>
          {error ?? loadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 18, alignItems: 'start' }}>
        {/* ── Player pool ── */}
        <div style={glass({ padding: 16 })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1.5, color: T.dim, flex: 1 }}>
              PLAYER POOL <span style={{ color: T.faint }}>({loading ? '…' : pool.length})</span>
            </span>
            <button
              type="button"
              onClick={() => router.refresh()}
              title="Re-check who's in voice"
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7, padding: '3px 9px', cursor: 'pointer',
                fontFamily: FONT_M, fontSize: 10, color: T.dim, letterSpacing: 0.5,
              }}
            >
              ↻ VC
            </button>
          </div>

          {/* pool filters: who signed up vs who actually showed up */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {([
              { id: 'signedup' as const, label: `⚡ Signed up (${signedUpIds.length})` },
              { id: 'voice' as const, label: `● In VC (${inVoiceIds.length})` },
              { id: 'all' as const, label: 'Everyone' },
            ]).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: `1px solid ${filter === f.id ? rgba(ADMIN_ACCENT, 0.6) : 'rgba(255,255,255,0.12)'}`,
                  background: filter === f.id ? rgba(ADMIN_ACCENT, 0.18) : 'none',
                  color: f.id === 'voice'
                    ? (filter === f.id ? LIVE : rgba(LIVE, 0.7))
                    : filter === f.id ? '#fff' : T.dim,
                  fontFamily: FONT_B,
                  fontSize: 11.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
            style={inputBase}
          />
          <div style={{ marginTop: 10, maxHeight: 520, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 12 }}>Loading players…</div>
            ) : pool.length === 0 ? (
              <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 12 }}>
                {query
                  ? 'No players match.'
                  : filter === 'signedup'
                    ? 'No signed-up players left — everyone who signed up is on a team.'
                    : filter === 'voice'
                      ? 'Nobody undrafted is in voice right now. ↻ VC to re-check.'
                      : 'Everyone is on a team. 🎉'}
              </div>
            ) : (
              pool.map(p => (
                <button
                  key={p.publicId}
                  type="button"
                  onClick={() => assign(p.publicId)}
                  title="Add to the selected team"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 10px',
                    background: inVoice.has(p.publicId) ? rgba(LIVE, 0.05) : 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: T.text, fontFamily: FONT_B, fontSize: 14,
                    textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <span style={{ color: ADMIN_ACCENT, fontSize: 12 }}>＋</span>
                  {inVoice.has(p.publicId) && (
                    <span
                      title="In voice right now"
                      style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: LIVE, boxShadow: `0 0 8px ${LIVE}`,
                        animation: 'voicePulse 1.6s ease-in-out infinite',
                      }}
                    />
                  )}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.displayName}
                  </span>
                  {signedUp.has(p.publicId) && (
                    <span title="Signed up" style={{ fontSize: 11, color: T.gold }}>⚡</span>
                  )}
                  {p.position1 && (
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                      {p.position1}{p.position2 ? `/${p.position2}` : ''}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <style>{'@keyframes voicePulse{0%,100%{opacity:0.55}50%{opacity:1}}'}</style>
        </div>

        {/* ── Teams ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
          {teams.map(team => {
            const roster = rosterOf(team.id);
            const isActive = team.id === activeTeamId;
            return (
              <div
                key={team.id}
                style={glass({
                  padding: 14,
                  border: isActive ? `1px solid ${rgba(ADMIN_ACCENT, 0.65)}` : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? `0 0 18px ${rgba(ADMIN_ACCENT, 0.25)}` : undefined,
                })}
              >
                <button
                  type="button"
                  onClick={() => setActiveTeamId(team.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    marginBottom: 10, textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: FONT_D, fontSize: 14, letterSpacing: 1,
                    color: isActive ? ADMIN_ACCENT : T.text, flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {team.name}
                  </span>
                  <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint }}>{roster.length}</span>
                  {isActive && (
                    <span style={{
                      fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: ADMIN_ACCENT,
                      border: `1px solid ${rgba(ADMIN_ACCENT, 0.5)}`, borderRadius: 5, padding: '2px 6px',
                    }}>
                      DRAFTING
                    </span>
                  )}
                </button>

                {roster.length === 0 ? (
                  <div style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint }}>No players yet.</div>
                ) : (
                  roster.map(pid => {
                    const p = byId.get(pid);
                    const isCaptain = team.captainPublicId === pid && !overrides.has(pid);
                    return (
                      <div key={pid} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <button
                          type="button"
                          onClick={() => makeCaptain(pid, team.id)}
                          title={isCaptain ? 'Captain' : 'Make captain'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, padding: 0,
                            opacity: isCaptain ? 1 : 0.3,
                          }}
                        >
                          {isCaptain ? '©' : '☆'}
                        </button>
                        {inVoice.has(pid) && (
                          <span
                            title="In voice right now"
                            style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: LIVE, boxShadow: `0 0 7px ${LIVE}`,
                            }}
                          />
                        )}
                        <span style={{
                          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: FONT_B, fontSize: 13, color: T.text,
                        }}>
                          {p?.displayName ?? '…'}
                        </span>
                        {p?.position1 && (
                          <span style={{ fontFamily: FONT_M, fontSize: 9, color: T.faint }}>{p.position1}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => unassign(pid, team.id)}
                          title="Remove from team"
                          style={{
                            background: 'none', border: 'none', color: T.loss,
                            fontSize: 11, cursor: 'pointer', padding: '0 2px', opacity: 0.7,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
