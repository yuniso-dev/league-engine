'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminTeam, DraftPoolEntry } from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, T, glass, rgba } from '@/lib/realm-colors';
import { ADMIN_ACCENT, inputBase } from '@/components/admin/ui';
import { useAdminPlayers } from '@/lib/useAdminPlayers';
import {
  addTeamMemberAction,
  addToDraftPoolAction,
  clearDraftPoolAction,
  removeFromDraftPoolAction,
  removeTeamMemberAction,
  setCaptainAction,
  type AdminFormState,
} from '@/app/admin/actions';

// Rapid roster assignment for big drafts (44–66 players). The pool is now an
// explicit staging area: the bot's /checkvc snapshots a voice channel into it
// (green dot = was in the call), and admins can hand-add or disregard anyone.
// Pick a team once, then every click on a pool player drops them onto it.
// Optimistic — the click lands instantly, the server catches up in the background.

const LIVE = '#3DDC97';

type Props = {
  tournamentId: string;
  teams: AdminTeam[];
  pool: DraftPoolEntry[];
};

type PoolInfo = { displayName: string; position1: string | null; position2: string | null };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

export default function DraftBoard({ tournamentId, teams, pool }: Props) {
  const router = useRouter();
  const { players } = useAdminPlayers(); // full directory — only for the "add player" search
  const [query, setQuery] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState(teams[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Which publicIds sit in the pool. Seeded from the server pool and unioned
  // whenever the server sends a fresh snapshot (a new /checkvc + refresh), so
  // late arrivals appear while disregarded players (removed server-side) don't
  // come back.
  const [poolIds, setPoolIds] = useState<Set<string>>(() => new Set(pool.map(p => p.publicId)));
  useEffect(() => {
    setPoolIds(prev => {
      const next = new Set(prev);
      for (const p of pool) next.add(p.publicId);
      return next;
    });
  }, [pool]);

  const poolMeta = useMemo(() => new Map(pool.map(p => [p.publicId, p])), [pool]);

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

  // Display lookup — pool ghosts (never signed in) aren't in the directory, so
  // merge every source we have.
  const byId = useMemo(() => {
    const m = new Map<string, PoolInfo>();
    for (const p of players) m.set(p.publicId, { displayName: p.displayName, position1: p.position1, position2: p.position2 });
    for (const t of teams) for (const mem of t.members) m.set(mem.publicId, { displayName: mem.displayName, position1: mem.position1, position2: mem.position2 });
    for (const p of pool) m.set(p.publicId, { displayName: p.displayName, position1: p.position1, position2: p.position2 });
    return m;
  }, [players, teams, pool]);

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
    setPoolIds(s => new Set(s).add(publicId)); // back to the pool for redrafting
    run(removeTeamMemberAction, { teamId, publicId, tournamentId }, () =>
      setOverrides(m => new Map(m).set(publicId, prev)),
    );
  };

  const makeCaptain = (publicId: string, teamId: string) => {
    run(setCaptainAction, { teamId, publicId, tournamentId }, () => {});
  };

  const disregard = (publicId: string) => {
    setPoolIds(s => { const n = new Set(s); n.delete(publicId); return n; });
    run(removeFromDraftPoolAction, { publicId, tournamentId }, () =>
      setPoolIds(s => new Set(s).add(publicId)),
    );
  };

  const manualAdd = (publicId: string) => {
    setPoolIds(s => new Set(s).add(publicId));
    setAddQuery('');
    run(addToDraftPoolAction, { publicId, tournamentId }, () =>
      setPoolIds(s => { const n = new Set(s); n.delete(publicId); return n; }),
    );
  };

  const clearPool = () => {
    if (!confirm('Clear the entire draft pool? Players already on teams stay on their teams.')) return;
    const prev = poolIds;
    setPoolIds(new Set());
    run(clearDraftPoolAction, { tournamentId }, () => setPoolIds(prev));
  };

  // The pool list: staged players not yet on a team.
  const poolList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...poolIds]
      .filter(pid => assignmentOf(pid) === null)
      .map(pid => ({ pid, info: byId.get(pid), inVoice: poolMeta.get(pid)?.inVoice ?? false }))
      .filter((x): x is { pid: string; info: PoolInfo; inVoice: boolean } => x.info != null)
      .filter(x => !q || x.info.displayName.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.inVoice !== b.inVoice) return a.inVoice ? -1 : 1;
        return a.info.displayName.localeCompare(b.info.displayName);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolIds, byId, poolMeta, query, overrides, serverAssignment]);

  // Manual-add search: directory players not already staged or on a team.
  const addResults = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter(p => !poolIds.has(p.publicId) && assignmentOf(p.publicId) === null)
      .filter(p => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, poolIds, addQuery, overrides, serverAssignment]);

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
      {error && (
        <div style={{
          ...glass({ padding: '10px 16px' }),
          border: `1px solid ${rgba(T.loss, 0.4)}`,
          fontFamily: FONT_B, fontSize: 13, color: T.loss, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 18, alignItems: 'start' }}>
        {/* ── Draft pool ── */}
        <div style={glass({ padding: 16 })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1.5, color: T.dim, flex: 1 }}>
              DRAFT POOL <span style={{ color: T.faint }}>({poolList.length})</span>
            </span>
            <button
              type="button"
              onClick={() => router.refresh()}
              title="Re-read the pool after running /checkvc"
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7, padding: '3px 9px', cursor: 'pointer',
                fontFamily: FONT_M, fontSize: 10, color: T.dim, letterSpacing: 0.5,
              }}
            >
              ↻ Refresh
            </button>
            {poolIds.size > 0 && (
              <button
                type="button"
                onClick={clearPool}
                title="Empty the pool"
                style={{
                  background: 'none', border: `1px solid ${rgba(T.loss, 0.35)}`,
                  borderRadius: 7, padding: '3px 9px', cursor: 'pointer',
                  fontFamily: FONT_M, fontSize: 10, color: rgba(T.loss, 0.85), letterSpacing: 0.5,
                }}
              >
                Clear
              </button>
            )}
          </div>

          <p style={{ fontFamily: FONT_B, fontSize: 11.5, color: T.faint, margin: '0 0 10px', lineHeight: 1.5 }}>
            Fed on demand by <b style={{ color: T.dim }}>/checkvc</b> in Discord.
            A green dot means they were in the voice channel at the last check.
          </p>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter the pool…"
            autoComplete="off"
            style={inputBase}
          />

          <div style={{ marginTop: 10, maxHeight: 460, overflowY: 'auto' }}>
            {poolList.length === 0 ? (
              <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: 12, lineHeight: 1.6 }}>
                {query
                  ? 'No pooled players match.'
                  : poolIds.size > 0
                    ? 'Everyone in the pool is on a team. 🎉'
                    : 'Pool is empty — run /checkvc in Discord, or add players by hand below.'}
              </div>
            ) : (
              poolList.map(({ pid, info, inVoice }) => (
                <div
                  key={pid}
                  style={{
                    display: 'flex', alignItems: 'center',
                    background: inVoice ? rgba(LIVE, 0.05) : 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => assign(pid)}
                    title="Add to the selected team"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      flex: 1, minWidth: 0, padding: '7px 6px 7px 10px',
                      background: 'none', border: 'none',
                      color: T.text, fontFamily: FONT_B, fontSize: 14,
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: ADMIN_ACCENT, fontSize: 12 }}>＋</span>
                    {inVoice && (
                      <span
                        title="In voice at the last check"
                        style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: LIVE, boxShadow: `0 0 8px ${LIVE}`,
                          animation: 'voicePulse 1.6s ease-in-out infinite',
                        }}
                      />
                    )}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {info.displayName}
                    </span>
                    {info.position1 && (
                      <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                        {info.position1}{info.position2 ? `/${info.position2}` : ''}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => disregard(pid)}
                    title="Disregard — remove from the pool"
                    style={{
                      background: 'none', border: 'none', color: T.loss,
                      fontSize: 12, cursor: 'pointer', padding: '0 9px', opacity: 0.6,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Manual add — stage anyone the /checkvc snapshot missed (alt account,
              different device, joined late). */}
          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            {!addOpen ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                style={{
                  background: 'none', border: '1px dashed rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '8px 12px', width: '100%', cursor: 'pointer',
                  fontFamily: FONT_B, fontSize: 12.5, color: T.dim,
                }}
              >
                ＋ Add player by hand
              </button>
            ) : (
              <div>
                <input
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  placeholder="Search players to add…"
                  autoComplete="off"
                  autoFocus
                  style={inputBase}
                />
                {addQuery && (
                  <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {addResults.length === 0 ? (
                      <div style={{ fontFamily: FONT_B, fontSize: 12, color: T.faint, padding: 8 }}>
                        No matches (already staged or on a team).
                      </div>
                    ) : (
                      addResults.map(p => (
                        <button
                          key={p.publicId}
                          type="button"
                          onClick={() => manualAdd(p.publicId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '7px 10px', background: 'none', border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            color: T.text, fontFamily: FONT_B, fontSize: 13.5,
                            textAlign: 'left', cursor: 'pointer',
                          }}
                        >
                          <span style={{ color: ADMIN_ACCENT, fontSize: 12 }}>＋</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.displayName}
                          </span>
                          {p.position1 && (
                            <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>{p.position1}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setAddQuery(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT_M, fontSize: 10, color: T.faint, letterSpacing: 0.5,
                    marginTop: 8, padding: 0,
                  }}
                >
                  Done
                </button>
              </div>
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
                    const info = byId.get(pid);
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
                        {poolMeta.get(pid)?.inVoice && (
                          <span
                            title="In voice at the last check"
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
                          {info?.displayName ?? '…'}
                        </span>
                        {info?.position1 && (
                          <span style={{ fontFamily: FONT_M, fontSize: 9, color: T.faint }}>{info.position1}</span>
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
