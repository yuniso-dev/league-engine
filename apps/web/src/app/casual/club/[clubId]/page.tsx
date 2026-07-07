import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getTrackedClub,
  runResilient,
  type TrackedClubMatch,
  type TrackedClubMember,
} from '@inazuma/db';
import { FONT_B, FONT_D, FONT_M, REALMS, T, glass, lighten, rgba } from '@/lib/realm-colors';
import { ClubCrest } from '@/components/ui/ClubCrest';

// One tracked community club — record, form, squad — rendered entirely from
// the bot-maintained snapshot (the site never calls EA, so this page is fast
// and works through EA outages; the header shows how fresh the data is).

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const REALM = REALMS[3];
const ACCENT = REALM.accent;

type Props = { params: { clubId: string } };

const POS_ORDER: { key: string; label: string }[] = [
  { key: 'forward', label: 'FORWARDS' },
  { key: 'midfielder', label: 'MIDFIELDERS' },
  { key: 'defender', label: 'DEFENDERS' },
  { key: 'goalkeeper', label: 'GOALKEEPERS' },
];

const RESULT_COLOR: Record<TrackedClubMatch['result'], string> = {
  win: T.win,
  loss: T.loss,
  draw: T.dim,
};

function ratingColor(r: number | null): string {
  if (r == null) return T.faint;
  if (r >= 8) return T.gold;
  if (r >= 7) return T.win;
  if (r >= 6) return T.text;
  return T.loss;
}

function ago(d: Date | null): string {
  if (!d) return 'never';
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function StatTile({ label, value, sub, c }: { label: string; value: string; sub?: string; c?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '13px 10px', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: 1, color: T.faint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_D, fontSize: 19, color: c ?? T.text, letterSpacing: 0.5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT_M, fontSize: 9, color: T.faint, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, rows }: { title: string; rows: { l: string; v: string; c?: string }[] }) {
  return (
    <div style={glass({ padding: 16 })}>
      <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5, color: ACCENT, marginBottom: 10 }}>
        {title}
      </div>
      {rows.map(r => (
        <div key={r.l} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ fontFamily: FONT_B, fontSize: 13, color: T.dim }}>{r.l}</span>
          <span style={{ fontFamily: FONT_D, fontSize: 15, color: r.c ?? T.text, letterSpacing: 0.5 }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function MemberCard({ m }: { m: TrackedClubMember }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_B, fontWeight: 700, fontSize: 13, color: T.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {m.name}
        </div>
        <div style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint, marginTop: 3 }}>
          {m.proOverall != null ? `${m.proOverall} OVR · ` : ''}
          {m.gamesPlayed} apps · {m.goals}G {m.assists}A
        </div>
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: FONT_D, fontSize: 16, color: ratingColor(m.avgRating), lineHeight: 1 }}>
          {m.avgRating != null ? m.avgRating.toFixed(1) : '—'}
        </div>
        <div style={{ fontFamily: FONT_M, fontSize: 7.5, letterSpacing: 1, color: T.faint, marginTop: 2 }}>AVG R</div>
      </div>
    </div>
  );
}

export default async function ClubPage({ params }: Props) {
  if (!/^\d{1,12}$/.test(params.clubId)) notFound();
  const club = await runResilient(() => getTrackedClub(params.clubId));
  if (!club) notFound();

  const o = club.overall;
  const gp = o && o.gamesPlayed > 0 ? o.gamesPlayed : null;
  const name = club.name ?? `Club ${club.clubId}`;
  const members = club.members ?? [];
  const matches = club.recentMatches ?? [];

  const byPos = new Map<string, TrackedClubMember[]>();
  for (const m of members) {
    const key = m.favoritePosition && POS_ORDER.some(p => p.key === m.favoritePosition) ? m.favoritePosition : 'other';
    byPos.set(key, [...(byPos.get(key) ?? []), m]);
  }

  const rated = members.filter(m => m.avgRating != null && m.gamesPlayed >= 5);
  const leaders = members.length > 0 ? [
    { label: 'TOP SCORER', pick: [...members].sort((a, b) => b.goals - a.goals)[0], value: (m: TrackedClubMember) => `${m.goals} goals` },
    { label: 'TOP ASSISTER', pick: [...members].sort((a, b) => b.assists - a.assists)[0], value: (m: TrackedClubMember) => `${m.assists} assists` },
    {
      label: 'BEST AVG RATING',
      pick: rated.length > 0 ? [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0] : null,
      value: (m: TrackedClubMember) => `${m.avgRating!.toFixed(2)} over ${m.gamesPlayed} apps`,
    },
    { label: 'MOST MOTM', pick: [...members].sort((a, b) => b.motm - a.motm)[0], value: (m: TrackedClubMember) => `${m.motm} ⭐` },
  ].filter(l => l.pick !== null) : [];

  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 50% 70%, ${REALM.bottom} 0%, #04060D 55%, #04050c 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <div style={{ width: '100%', maxWidth: 860 }}>
        <Link href="/" style={{ fontFamily: FONT_B, color: T.dim, fontSize: 13, textDecoration: 'none' }}>
          ← INAZUMA FC · Casual → Clubs
        </Link>

        {/* ── Club header ── */}
        <div style={{ ...glass({ padding: '20px 20px' }), marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <ClubCrest name={name} teamId={club.info?.teamId ?? null} crestAssetId={club.info?.crestAssetId ?? null} size={58} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ fontFamily: FONT_D, fontSize: 28, letterSpacing: 1.5, color: T.text, margin: 0, lineHeight: 1.1 }}>
                {name}
              </h1>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {o?.bestDivision != null && o.bestDivision > 0 && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: lighten(ACCENT, 0.3),
                    border: `1px solid ${rgba(ACCENT, 0.5)}`, borderRadius: 999, padding: '3px 10px',
                  }}>
                    BEST: DIV {o.bestDivision}
                  </span>
                )}
                {o?.titlesWon != null && o.titlesWon > 0 && (
                  <span style={{
                    fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.gold,
                    border: `1px solid ${rgba('#FFD24A', 0.4)}`, borderRadius: 999, padding: '3px 10px',
                  }}>
                    🏆 {o.titlesWon} TITLE{o.titlesWon === 1 ? '' : 'S'}
                  </span>
                )}
                <span style={{
                  fontFamily: FONT_M, fontSize: 10, letterSpacing: 1, color: T.faint,
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '3px 10px',
                }}>
                  ⟳ UPDATED {ago(club.fetchedAt).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8, marginTop: 18 }}>
            <StatTile label="RECORD" value={o ? `${o.wins}-${o.ties}-${o.losses}` : '—'} sub={gp ? `${gp} matches` : undefined} />
            <StatTile label="WIN RATE" value={o && gp ? `${Math.round((o.wins / gp) * 100)}%` : '—'} c={T.win} />
            <StatTile label="SKILL RATING" value={o?.skillRating != null ? String(o.skillRating) : '—'} c={lighten(ACCENT, 0.3)} />
            <StatTile label="GOALS / MATCH" value={o && gp ? (o.goals / gp).toFixed(2) : '—'} />
            <StatTile label="AGAINST / MATCH" value={o && gp ? (o.goalsAgainst / gp).toFixed(2) : '—'} />
            <StatTile label="SQUAD SIZE" value={members.length > 0 ? String(members.length) : '—'} />
          </div>
        </div>

        {!o && (
          <p style={{ fontFamily: FONT_B, fontSize: 13, color: T.faint, margin: '14px 4px' }}>
            First sync hasn&apos;t landed yet — the bot refreshes tracked clubs every couple of minutes.
          </p>
        )}

        {/* ── Stat panels ── */}
        {o && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12, marginTop: 14,
          }}>
            <Panel title="RESULTS" rows={[
              { l: 'Wins', v: String(o.wins), c: T.win },
              { l: 'Draws', v: String(o.ties) },
              { l: 'Losses', v: String(o.losses), c: T.loss },
              { l: 'Win rate', v: gp ? `${Math.round((o.wins / gp) * 100)}%` : '—' },
            ]} />
            <Panel title="GOALS" rows={[
              { l: 'Scored', v: String(o.goals), c: T.win },
              { l: 'Against', v: String(o.goalsAgainst), c: T.loss },
              { l: 'Difference', v: `${o.goals - o.goalsAgainst >= 0 ? '+' : ''}${o.goals - o.goalsAgainst}` },
              { l: 'Per match', v: gp ? (o.goals / gp).toFixed(2) : '—' },
            ]} />
            <Panel title="PROGRESSION" rows={[
              { l: 'Promotions', v: String(o.promotions), c: T.win },
              { l: 'Relegations', v: String(o.relegations), c: T.loss },
              { l: 'Playoff games', v: String(o.playoffGames) },
              ...(o.bestFinishGroup != null ? [{ l: 'Best finish group', v: String(o.bestFinishGroup) }] : []),
            ]} />
            <Panel title="STREAKS & PROFILE" rows={[
              { l: 'Win streak', v: String(o.winStreak), c: o.winStreak > 0 ? T.win : T.dim },
              { l: 'Unbeaten streak', v: String(o.unbeatenStreak), c: o.unbeatenStreak > 0 ? T.win : T.dim },
              ...(o.leagueAppearances != null ? [{ l: 'League appearances', v: String(o.leagueAppearances) }] : []),
              ...(o.reputationTier != null ? [{ l: 'Reputation tier', v: String(o.reputationTier) }] : []),
            ]} />
          </div>
        )}

        {/* ── Recent results ── */}
        {matches.length > 0 && (
          <>
            <h2 style={{ fontFamily: FONT_D, fontSize: 16, letterSpacing: 2, color: T.text, margin: '26px 0 10px' }}>
              RECENT RESULTS
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matches.map(m => (
                <div key={m.matchId} style={glass({ padding: '12px 14px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONT_D, fontSize: 13, letterSpacing: 1, color: RESULT_COLOR[m.result], minWidth: 16 }}>
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
                      <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1, color: REALM.accent2 }}>PLAYOFF</span>
                    )}
                    <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                      {new Date(m.playedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {m.performers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: 1, color: T.faint }}>TOP</span>
                      {m.performers.map(p => (
                        <span key={p.name} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: '2px 8px',
                          fontFamily: FONT_B, fontSize: 11.5, color: T.dim,
                        }}>
                          {p.name}
                          <b style={{ fontFamily: FONT_D, fontSize: 11.5, color: ratingColor(p.rating) }}>
                            {p.rating.toFixed(1)}
                          </b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Leaders ── */}
        {leaders.length > 0 && (
          <>
            <h2 style={{ fontFamily: FONT_D, fontSize: 16, letterSpacing: 2, color: T.text, margin: '26px 0 10px' }}>
              LEADERS
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
              {leaders.map(l => (
                <div key={l.label} style={glass({ padding: '13px 14px' })}>
                  <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: 1.5, color: ACCENT, marginBottom: 6 }}>{l.label}</div>
                  <div style={{ fontFamily: FONT_B, fontWeight: 700, fontSize: 14, color: T.text }}>{l.pick!.name}</div>
                  <div style={{ fontFamily: FONT_M, fontSize: 11, color: T.dim, marginTop: 3 }}>{l.value(l.pick!)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Squad ── */}
        {members.length > 0 && (
          <>
            <h2 style={{ fontFamily: FONT_D, fontSize: 16, letterSpacing: 2, color: T.text, margin: '26px 0 4px' }}>
              SQUAD
              <span style={{ color: T.faint, fontSize: 12, marginLeft: 8 }}>{members.length}</span>
            </h2>
            {[...POS_ORDER, { key: 'other', label: 'UNASSIGNED' }].map(pos => {
              const group = byPos.get(pos.key) ?? [];
              if (group.length === 0) return null;
              return (
                <div key={pos.key} style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: FONT_M, fontSize: 9.5, letterSpacing: 1.5, color: T.faint, marginBottom: 7 }}>
                    {pos.label} · {group.length}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 7 }}>
                    {group.map(m => <MemberCard key={m.name} m={m} />)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
