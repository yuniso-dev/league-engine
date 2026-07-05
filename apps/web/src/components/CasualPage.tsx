'use client';
import { memo, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CasualCareer, CasualHistoryMatch, CasualLeaderRow, LinkedCasualPlayer } from '@inazuma/db';
import { Avatar } from '@/components/ui/Avatar';
import { Bolt } from '@/components/ui/Bolt';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { RankMedal } from '@/components/ui/RankMedal';
import GlassSelect from '@/components/ui/GlassSelect';
import { REALMS, T, FONT_D, FONT_B, FONT_M, glass, rgba, lighten } from '@/lib/realm-colors';

// The CASUAL realm: FC Clubs games, synced from the EA Clubs API by the bot.
//  · MATCH HISTORY  — one player's recent matches, a stat line per match
//  · PERFORMANCE    — one player's career aggregates at EA-ID level
//  · LEADERBOARD    — every linked player, ordered by average match rating
// Data loads on first open (never weighs down the homepage payload).

const REALM = REALMS[3];
const ACCENT = REALM.accent;
const ACCENT2 = REALM.accent2;

type Bootstrap = {
  leaderboard: CasualLeaderRow[];
  players: LinkedCasualPlayer[];
  me: { publicId: string; eaName: string | null } | null;
};

type PlayerData = { career: CasualCareer | null; matches: CasualHistoryMatch[] };

type SubTab = 'history' | 'performance' | 'board';

const playerCache = new Map<string, PlayerData>();

function ratingColor(r: number | null): string {
  if (r == null) return T.faint;
  if (r >= 8) return T.gold;
  if (r >= 7) return T.win;
  if (r >= 6) return T.text;
  return T.loss;
}

const RESULT_COLOR: Record<string, string> = { win: T.win, loss: T.loss, draw: T.dim };

function Pill({ label, value, c }: { label: string; value: number | string; c?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: '2px 8px',
    }}>
      <span style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontFamily: FONT_D, fontSize: 12, color: c ?? T.text, letterSpacing: 0.3 }}>{value}</span>
    </span>
  );
}

function EmptyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...glass({ padding: '30px 24px', textAlign: 'center' }), marginTop: 8 }}>
      <Bolt size={26} color={ACCENT} style={{ opacity: 0.5 }} />
      <div style={{ fontFamily: FONT_D, fontSize: 15, letterSpacing: 1.5, color: T.dim, margin: '12px 0 6px' }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}

export const CasualPage = memo(function CasualPage({ active, mePublicId }: {
  /** True when this pane is the visible tab — first activation triggers the fetch. */
  active: boolean;
  mePublicId: string | null;
}) {
  const [tab, setTab] = useState<SubTab>('board');
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [wanted, setWanted] = useState(false);

  useEffect(() => { if (active) setWanted(true); }, [active]);

  // Bootstrap: leaderboard + picker + who I am. Once, on first open.
  useEffect(() => {
    if (!wanted || boot !== null) return;
    let alive = true;
    fetch('/api/casual')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Bootstrap>; })
      .then(data => {
        if (!alive) return;
        setBoot(data);
        // Preselect yourself when linked, else the first linked player.
        const mine = data.me && data.players.some(p => p.publicId === data.me!.publicId)
          ? data.me.publicId
          : data.players[0]?.publicId ?? '';
        setSelected(prev => prev || mine);
      })
      .catch(() => { if (alive) setBootError(true); });
    return () => { alive = false; };
  }, [wanted, boot]);

  // Per-player data for history/performance, cached per publicId.
  useEffect(() => {
    if (!selected || (tab !== 'history' && tab !== 'performance')) return;
    const cached = playerCache.get(selected);
    if (cached) { setPlayerData(cached); return; }
    let alive = true;
    setPlayerLoading(true);
    setPlayerData(null);
    fetch(`/api/casual/history/${selected}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<PlayerData>; })
      .then(data => {
        playerCache.set(selected, data);
        if (alive) { setPlayerData(data); setPlayerLoading(false); }
      })
      .catch(() => { if (alive) setPlayerLoading(false); });
    return () => { alive = false; };
  }, [selected, tab]);

  const pickerOptions = useMemo(() =>
    (boot?.players ?? []).map(p => ({
      value: p.publicId,
      label: p.publicId === mePublicId ? `${p.displayName} (you)` : p.displayName,
    })), [boot, mePublicId]);

  const selectedPlayer = boot?.players.find(p => p.publicId === selected) ?? null;
  const iAmLinked = boot?.me?.eaName != null;

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'history', label: 'Match history' },
    { id: 'performance', label: 'Performance' },
    { id: 'board', label: 'Leaderboard' },
  ];

  return (
    <div className="rank-wrap" style={{ padding: '28px 18px 96px', margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={ACCENT} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            CASUAL
          </h1>
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          FC Clubs games — synced automatically, no pressure, all bragging rights.
        </p>
      </div>

      {/* sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {subTabs.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setTab(s.id)}
            style={{
              padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${tab === s.id ? rgba(ACCENT, 0.6) : 'rgba(255,255,255,0.12)'}`,
              background: tab === s.id ? rgba(ACCENT, 0.16) : 'none',
              color: tab === s.id ? lighten(ACCENT, 0.35) : T.dim,
              fontFamily: FONT_B, fontWeight: 700, fontSize: 12.5,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* loading / error states for the bootstrap */}
      {bootError && (
        <EmptyCard title="STORM INTERFERENCE">
          Casual data didn&apos;t load — pull to refresh or try again in a minute.
        </EmptyCard>
      )}
      {!boot && !bootError && (
        <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
          Loading casual data…
        </div>
      )}

      {boot && (
        <>
          {/* nudge for unlinked viewers */}
          {mePublicId !== null && !iAmLinked && (
            <div style={{
              ...glass({ padding: '10px 14px', borderRadius: 12 }),
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              border: `1px solid ${rgba(ACCENT, 0.35)}`,
            }}>
              <span style={{ fontFamily: FONT_B, fontSize: 12.5, color: T.dim, flex: 1, minWidth: 200 }}>
                Link your <b style={{ color: T.text }}>EA ID</b> to appear here — your club matches sync automatically.
              </span>
              <Link href="/settings" className="tap" style={{
                fontFamily: FONT_M, fontSize: 11, letterSpacing: 1, color: lighten(ACCENT, 0.3),
                border: `1px solid ${rgba(ACCENT, 0.5)}`, borderRadius: 999, padding: '5px 12px',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                ✎ LINK EA ID
              </Link>
            </div>
          )}

          {/* ── player picker (history + performance) ── */}
          {tab !== 'board' && (
            boot.players.length === 0 ? (
              <EmptyCard title="NOBODY LINKED YET">
                Nobody has linked an EA ID yet. Add yours via ✎ Edit Profile and
                your club matches start counting.
              </EmptyCard>
            ) : (
              <>
                <div style={{ maxWidth: 320, marginBottom: 16 }}>
                  <GlassSelect
                    options={pickerOptions}
                    value={selected}
                    onChange={setSelected}
                    accent={ACCENT}
                    searchable={boot.players.length > 8}
                    placeholder="Pick a player…"
                  />
                </div>

                {playerLoading && (
                  <div style={{ fontFamily: FONT_B, color: T.faint, fontSize: 13, padding: '20px 0' }}>
                    Loading {selectedPlayer?.displayName ?? 'player'}…
                  </div>
                )}

                {/* ── MATCH HISTORY ── */}
                {tab === 'history' && playerData && (
                  playerData.matches.length === 0 ? (
                    <EmptyCard title="NO MATCHES YET">
                      No casual matches recorded for {selectedPlayer?.displayName ?? 'this player'} —
                      they appear here within ~10 minutes of full time.
                    </EmptyCard>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {playerData.matches.map(m => (
                        <div key={m.matchId} style={glass({ padding: '12px 14px' })}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: FONT_D, fontSize: 13, letterSpacing: 1,
                              color: RESULT_COLOR[m.result] ?? T.dim, minWidth: 16,
                            }}>
                              {m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'}
                            </span>
                            <span style={{ fontFamily: FONT_D, fontSize: 15, color: T.text }}>
                              {m.ourGoals}–{m.oppGoals}
                            </span>
                            <span style={{
                              flex: 1, minWidth: 0, fontFamily: FONT_B, fontSize: 13.5, color: T.dim,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              vs {m.opponentName ?? 'Unknown'}
                            </span>
                            {m.matchType === 'playoff' && (
                              <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: ACCENT2 }}>PLAYOFF</span>
                            )}
                            <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                              {new Date(m.playedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <Pill label="RATING" value={m.rating != null ? m.rating.toFixed(1) : '—'} c={ratingColor(m.rating)} />
                            <Pill label="G" value={m.goals} c={m.goals > 0 ? T.win : T.dim} />
                            <Pill label="A" value={m.assists} c={m.assists > 0 ? T.win : T.dim} />
                            <Pill label="TKL" value={m.tackles} />
                            {m.cleanSheet && <Pill label="CS" value="✓" c={T.win} />}
                            {m.saves > 0 && <Pill label="SAVES" value={m.saves} />}
                            {m.mom && <Pill label="MOTM" value="⭐" c={T.gold} />}
                            {m.position && <Pill label="POS" value={m.position.toUpperCase()} c={ACCENT2} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* ── PERFORMANCE ── */}
                {tab === 'performance' && playerData && (
                  !playerData.career || playerData.career.apps === 0 ? (
                    <EmptyCard title="UNSCOUTED">
                      No casual appearances yet for {selectedPlayer?.displayName ?? 'this player'} —
                      career numbers build as club matches sync.
                    </EmptyCard>
                  ) : (
                    <>
                      <div style={{
                        ...glass({ padding: '16px 18px', borderRadius: 16 }),
                        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
                        border: `1px solid ${rgba(ACCENT, 0.3)}`,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT_D, fontSize: 18, letterSpacing: 1, color: T.text }}>
                            {selectedPlayer?.displayName}
                          </div>
                          <div style={{ fontFamily: FONT_M, fontSize: 10.5, color: T.faint, marginTop: 2 }}>
                            EA ID · {playerData.career.eaName}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: FONT_D, fontSize: 30, color: ratingColor(playerData.career.avgRating), lineHeight: 1 }}>
                            {playerData.career.avgRating.toFixed(2)}
                          </div>
                          <div style={{ fontFamily: FONT_M, fontSize: 8, letterSpacing: 1, color: T.faint, marginTop: 3 }}>
                            AVG RATING
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                        {[
                          { l: 'APPS', v: playerData.career.apps, c: T.text },
                          { l: 'W · D · L', v: `${playerData.career.wins}·${playerData.career.draws}·${playerData.career.losses}`, c: T.text },
                          { l: 'GOALS', v: playerData.career.goals, c: T.win },
                          { l: 'ASSISTS', v: playerData.career.assists, c: T.win },
                          { l: 'TACKLES', v: playerData.career.tackles, c: T.text },
                          { l: 'CLEAN SHEETS', v: playerData.career.cleanSheets, c: T.text },
                          { l: 'SAVES', v: playerData.career.saves, c: T.text },
                          { l: 'MOTM', v: playerData.career.motm, c: T.gold },
                          { l: 'BEST RATING', v: playerData.career.bestRating != null ? playerData.career.bestRating.toFixed(1) : '—', c: ratingColor(playerData.career.bestRating) },
                        ].map(s => (
                          <div key={s.l} style={{
                            background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                            padding: '13px 6px', textAlign: 'center',
                          }}>
                            <div style={{ fontFamily: FONT_D, fontSize: 19, color: s.c, letterSpacing: 0.5 }}>{s.v}</div>
                            <div style={{ fontFamily: FONT_M, fontSize: 8, color: T.faint, letterSpacing: 1, marginTop: 4 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                )}
              </>
            )
          )}

          {/* ── LEADERBOARD ── */}
          {tab === 'board' && (
            boot.leaderboard.length === 0 ? (
              <EmptyCard title="THE PITCH IS QUIET">
                No linked players yet. Link your EA ID via ✎ Edit Profile and the
                casual ladder builds itself from your club matches.
              </EmptyCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
                  fontFamily: FONT_M, fontSize: 8.5, letterSpacing: 1, color: T.faint,
                }}>
                  <span style={{ width: 24 }} />
                  <span style={{ flex: 1 }}>ORDERED BY AVG MATCH RATING</span>
                </div>
                {boot.leaderboard.map((r, i) => (
                  <Link
                    key={r.publicId}
                    href={`/p/${r.publicId}`}
                    className="tap"
                    style={{
                      ...glass({ padding: '11px 14px' }),
                      display: 'flex', alignItems: 'center', gap: 11,
                      textDecoration: 'none',
                      borderLeft: `3px solid ${i < 3 ? ACCENT : rgba(ACCENT, 0.25)}`,
                    }}
                  >
                    <RankMedal place={i + 1} size={i < 3 ? 26 : 22} />
                    <Avatar initials={r.displayName.slice(0, 2).toUpperCase()} src={r.avatarUrl} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontFamily: FONT_B, fontWeight: 700, fontSize: 14.5, color: T.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                        }}>
                          {r.displayName}
                        </span>
                        <FlagIcon code={r.country} size={15} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                        <Pill label="G" value={r.goals} c={r.goals > 0 ? T.win : T.dim} />
                        <Pill label="A" value={r.assists} c={r.assists > 0 ? T.win : T.dim} />
                        <Pill label="TKL" value={r.tackles} />
                        <Pill label="CS" value={r.cleanSheets} />
                        <Pill label="APPS" value={r.apps} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 52 }}>
                      <div style={{ fontFamily: FONT_D, fontSize: 22, color: ratingColor(r.apps > 0 ? r.avgRating : null), lineHeight: 1 }}>
                        {r.apps > 0 ? r.avgRating.toFixed(2) : '—'}
                      </div>
                      <div style={{ fontFamily: FONT_M, fontSize: 8, letterSpacing: 1, color: T.faint, marginTop: 3 }}>
                        AVG R
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
});
