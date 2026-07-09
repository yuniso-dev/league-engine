'use client';
import { memo, useEffect, useState } from 'react';
import type { FrontierHistoryEntry, HeadToHead, PlayerMilestones, PlayerTag, PublicAward, PublicPlayer, PublicRecentMatch, RatingPoint } from '@inazuma/db';
import { Bolt } from '@/components/ui/Bolt';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp } from '@/components/ui/CountUp';
import { RatingGraph } from '@/components/RatingGraph';
import { AwardShowcase } from '@/components/AwardShowcase';
import { RecentMatchesCard } from '@/components/RecentMatchesCard';
import { HeadToHeadCard } from '@/components/HeadToHeadCard';
import { FrontierHistoryCard } from '@/components/FrontierHistoryCard';
import { AccentEditor, QuoteEditor } from '@/components/ProfileFlairEditor';
import { REALMS, T, FONT_D, FONT_B, FONT_M, rankColor, lighten, rgba, glass } from '@/lib/realm-colors';
import { FlagIcon } from '@/components/ui/FlagIcon';
import Link from 'next/link';

type Props = {
  player: PublicPlayer | null;
  isOwn?: boolean;
  isLoggedIn?: boolean;
  currentUser?: PublicPlayer | null;
  /** config.placementGames — how many ranked games end placement. */
  placementGames?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type ProfileExtras = {
  history: RatingPoint[];
  awards: PublicAward[];
  matches: PublicRecentMatch[];
  milestones: PlayerMilestones | null;
  frontierHistory?: FrontierHistoryEntry[];
  headToHead?: HeadToHead | null;
  tags?: PlayerTag[];
};

const NO_EXTRAS: ProfileExtras = { history: [], awards: [], matches: [], milestones: null, frontierHistory: [], headToHead: null, tags: [] };

// Standing tags shown in the right column as named entries (icon + name).
const TAG_META: Record<PlayerTag, { icon: string; name: string; color: string }> = {
  legacy: { icon: '🏛️', name: 'Legacy', color: '#d4a017' },
  beta: { icon: '🧪', name: 'Beta', color: '#7aa2ff' },
};

// Auto-earned career badges, computed from real match data — no admin input.
// Locked ones render dimmed so every profile shows what it COULD become.
const MILESTONES: {
  emoji: string;
  name: string;
  detail: string;
  earned: (m: PlayerMilestones, awardCount: number) => boolean;
}[] = [
  { emoji: '🏟️', name: 'FRONTIER DEBUT', detail: 'Play in a Frontier', earned: m => m.tournamentsPlayed >= 1 },
  { emoji: '⚡', name: 'FIRST BLOOD', detail: 'Win a Frontier match', earned: m => m.wins >= 1 },
  { emoji: '⚽', name: 'OFF THE MARK', detail: 'Score a Frontier goal', earned: m => m.goals >= 1 },
  { emoji: '🎯', name: 'PLAYMAKER', detail: 'Register an assist', earned: m => m.assists >= 1 },
  { emoji: '🧤', name: 'SHUTOUT', detail: 'Keep a clean sheet', earned: m => m.cleanSheets >= 1 },
  { emoji: '🥅', name: 'MARKSMAN', detail: 'Score 5 Frontier goals', earned: m => m.goals >= 5 },
  { emoji: '🧠', name: 'ARCHITECT', detail: 'Provide 5 assists', earned: m => m.assists >= 5 },
  { emoji: '🧱', name: 'THE WALL', detail: 'Keep 5 clean sheets', earned: m => m.cleanSheets >= 5 },
  { emoji: '🔥', name: 'SHARPSHOOTER', detail: 'Score 10 Frontier goals', earned: m => m.goals >= 10 },
  { emoji: '👟', name: 'DOUBLE DIGITS', detail: 'Play 10 matches', earned: m => m.matchesPlayed >= 10 },
  { emoji: '👑', name: 'SERIAL WINNER', detail: 'Win 10 matches', earned: m => m.wins >= 10 },
  { emoji: '🌩️', name: 'VETERAN', detail: 'Play 5 Frontiers', earned: m => m.tournamentsPlayed >= 5 },
  { emoji: '🏆', name: 'CHAMPION', detail: 'Win a Frontier', earned: m => m.frontiersWon >= 1 },
  { emoji: '🎖️', name: 'DECORATED', detail: 'Earn a league award', earned: (_m, awards) => awards >= 1 },
];

export const ProfilePage = memo(function ProfilePage({ player, isOwn = false, isLoggedIn = false, currentUser = null, placementGames = 3 }: Props) {
  // Player accent subtly tints the page; falls back to the profile realm's orange.
  const accent = player?.accentColor ?? REALMS[2].accent;
  const aGlow  = lighten(accent, 0.35);

  const [extras, setExtras] = useState<ProfileExtras>(NO_EXTRAS);
  const { history, awards, matches, milestones, frontierHistory, headToHead } = extras;
  // Standing tags: prefer the freshly-fetched extras, fall back to whatever the
  // player object was opened with (rankings rows already carry them).
  const tags: PlayerTag[] = extras.tags?.length ? extras.tags : player?.tags ?? [];
  const publicId = player?.publicId ?? null;
  // "You vs them" only makes sense when a logged-in viewer opens someone else's
  // profile — pass the viewer so the endpoint computes the head-to-head.
  const viewerId = !isOwn ? currentUser?.publicId ?? null : null;

  useEffect(() => {
    setExtras(NO_EXTRAS);
    if (!publicId) return;
    let alive = true;
    const url = viewerId ? `/api/profile/${publicId}?vs=${viewerId}` : `/api/profile/${publicId}`;
    fetch(url)
      .then(r => (r.ok ? r.json() : NO_EXTRAS))
      .then((data: ProfileExtras) => { if (alive) setExtras(data); })
      .catch(() => { /* graph/badges/matches are optional chrome — profile renders without them */ });
    return () => { alive = false; };
  }, [publicId, viewerId]);

  if (!player) {
    const header = (
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            PROFILE
          </h1>
        </div>
      </div>
    );

    if (!isLoggedIn) {
      return (
        <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
          {header}
          <div style={glass({ padding: 32, borderRadius: 20, textAlign: 'center' })}>
            <Bolt size={48} color={accent} style={{ filter: `drop-shadow(0 0 20px ${rgba(accent, 0.6)})` }} />
            <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, marginTop: 16, letterSpacing: 2 }}>
              JOIN THE LEAGUE
            </div>
            <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 24px', lineHeight: 1.65 }}>
              Sign in with Discord to claim your rank<br />and climb the Elo ladder.
            </p>
            {/* Real link to /signin (not a server 302) so mobile can hand off to the Discord app. */}
            <Link href="/signin?next=%2Finitialise" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '13px 28px',
              background: '#5865F2',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: FONT_D,
              fontSize: 15,
              letterSpacing: 1,
              cursor: 'pointer',
              boxShadow: '0 0 28px rgba(88,101,242,0.45)',
            }}>
              <svg width="20" height="15" viewBox="0 0 71 55" fill="white">
                <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.292408 45.3914C0.29800 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978Z" />
              </svg>
              LOGIN WITH DISCORD
            </Link>
          </div>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
          {header}
          <div style={glass({ padding: 32, borderRadius: 20, textAlign: 'center' })}>
            <Bolt size={48} color={accent} style={{ filter: `drop-shadow(0 0 20px ${rgba(accent, 0.6)})` }} />
            <div style={{ fontFamily: FONT_D, color: T.text, fontSize: 22, marginTop: 16, letterSpacing: 2 }}>
              ALMOST THERE
            </div>
            <p style={{ fontFamily: FONT_B, color: T.dim, fontSize: 14, margin: '10px 0 24px', lineHeight: 1.65 }}>
              You&apos;re signed in. Complete your profile<br />to enter the rankings.
            </p>
            <a href="/initialise" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 28px',
                background: accent,
                borderRadius: 12,
                color: '#fff',
                fontFamily: FONT_D,
                fontSize: 15,
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: `0 0 28px ${rgba(accent, 0.5)}`,
              }}>
                SET UP PROFILE
              </div>
            </a>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '28px 18px 96px', maxWidth: 600, margin: '0 auto' }}>
        {header}
        <div style={{ textAlign: 'center', paddingTop: 80, color: T.faint }}>
          <Bolt size={40} color={T.faint} style={{ opacity: 0.3 }} />
          <div style={{ fontFamily: FONT_B, fontSize: 14, marginTop: 16 }}>
            Tap a player in Rankings to view their profile.
          </div>
        </div>
      </div>
    );
  }

  const rc       = rankColor(player.rank);
  // Ranks are tie-aware and assigned to everyone — show one whenever it exists.
  const showRank = player.rank != null;

  const rankLabel = showRank
    ? `#${player.rank}`
    : `Provisional — ${player.gamesPlayed}/${placementGames} placement games`;

  const stats: { l: string; v: number; s: string; c: string }[] = [
    { l: 'RANK',   v: player.rank ?? 0,   s: '',  c: showRank ? rc : T.faint },
    { l: 'ELO',    v: Math.round(player.elo), s: '', c: T.text },
    { l: 'PLAYED', v: player.gamesPlayed,  s: '',  c: aGlow   },
  ];

  const positions = !player.hidePositions
    ? [player.position1, player.position2].filter(Boolean).join(' / ')
    : null;

  return (
    <div className="profile-wrap" style={{ padding: '28px 18px 96px', margin: '0 auto' }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bolt size={20} color={accent} />
          <h1 style={{ fontFamily: FONT_D, color: T.text, fontSize: 34, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            {isOwn ? 'YOUR PROFILE' : 'PROFILE'}
          </h1>
          {isOwn && (
            <Link
              href="/settings"
              className="tap"
              style={{
                marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 999,
                border: `1px solid ${rgba(accent, 0.5)}`,
                background: rgba(accent, 0.12),
                color: lighten(accent, 0.25),
                fontFamily: FONT_M, fontSize: 11, letterSpacing: 1.2,
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              ✎ EDIT PROFILE
            </Link>
          )}
        </div>
        <p style={{ color: T.dim, fontFamily: FONT_B, fontSize: 13, margin: '8px 0 0 32px' }}>
          {isOwn ? 'This is how the server sees you.' : `Viewing ${player.displayName}`}
        </p>
      </div>

      {/* hero card — plain wrapper: 3D tilt + backdrop blur produced a
          misplaced grey smear on hover in Chromium, so the tilt is gone. */}
      <div style={{ marginBottom: 12 }}>
        <div style={glass({
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
          borderTop: `1px solid ${rgba(accent, 0.35)}`,
        })}>
          <div style={{
            position: 'absolute', top: -50, right: -50,
            width: 180, height: 180,
            background: `radial-gradient(circle,${rgba(accent, 0.25)},transparent 70%)`,
          }} />

          <div style={{ display: 'flex', gap: 18, alignItems: 'center', position: 'relative' }}>
            <Avatar initials={initials(player.displayName)} src={player.avatarUrl} size={82} ring={showRank ? rc : null} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT_D, color: T.text, fontSize: 32, letterSpacing: '0.02em' }}>
                  {player.displayName.toUpperCase()}
                </span>
                <FlagIcon code={player.country} size={26} />
                {isOwn && <AccentEditor accentColor={player.accentColor} />}
              </div>
              {player.title && (
                <div style={{
                  fontFamily: FONT_M,
                  fontSize: 11,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: aGlow,
                  marginTop: 4,
                }}>
                  {player.title}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONT_D, fontSize: 18, color: showRank ? rc : T.faint }}>
                  {rankLabel}
                </span>
                {positions && positions.split(' / ').map(pos => (
                  <span key={pos} style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: T.text, padding: '3px 10px',
                    borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: FONT_M,
                  }}>
                    {pos}
                  </span>
                ))}
                {player.tier === 'premium' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: rgba(T.gold, 0.14), padding: '3px 9px', borderRadius: 7,
                  }}>
                    <Bolt size={9} color={T.gold} />
                    <span style={{ color: T.gold, fontSize: 9, fontWeight: 800, fontFamily: FONT_M, letterSpacing: 1 }}>
                      PREMIUM
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {isOwn ? (
            <QuoteEditor quote={player.quote} accent={accent} />
          ) : player.quote && (
            <div style={{
              marginTop: 18, padding: '14px 18px',
              background: 'rgba(255,255,255,0.035)',
              borderLeft: `2px solid ${accent}`, borderRadius: 10,
            }}>
              <span style={{ color: T.text, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 16 }}>
                &ldquo;{player.quote}&rdquo;
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Head-to-head — only when a logged-in viewer is looking at someone else. */}
      {!isOwn && currentUser && headToHead && (
        <HeadToHeadCard h2h={headToHead} targetName={player.displayName} accent={accent} />
      )}

      {/* Two columns on desktop (stats left, trophies + report right);
          the `order` values give the single-column phone reading order. */}
      <div className="profile-grid">
        <div className="pcol">
          {/* stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length},1fr)`, gap: 8, order: 1 }}>
            {stats.map(s => (
              <div key={s.l} style={glass({ padding: '16px 4px', textAlign: 'center' })}>
                <div style={{ fontFamily: FONT_D, fontSize: 26, color: s.c, lineHeight: 1 }}>
                  {s.l === 'RANK' && !showRank ? '—' : <CountUp end={s.v} suffix={s.s} />}
                </div>
                <div style={{ color: T.dim, fontFamily: FONT_M, fontSize: 8, letterSpacing: '0.06em', marginTop: 4 }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          {/* rating history — blank chart state until the first reveal */}
          <div style={{ ...glass({ padding: 18 }), order: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>📈</span>
              <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                RATING HISTORY
              </h3>
            </div>
            {history.length >= 2 ? (
              <RatingGraph points={history} />
            ) : (
              <div style={{
                height: 110,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: `1px dashed ${rgba(accent, 0.3)}`,
              }}>
                <span style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, letterSpacing: 0.5 }}>
                  Rating history charts after the first reveal.
                </span>
              </div>
            )}
          </div>

          {/* last 5 matches — empty state until they've played */}
          <div style={{ order: 5 }}>
            <RecentMatchesCard
              matches={matches}
              accent={accent}
              emptyText="Play a Frontier to see results."
            />
          </div>

          {/* career milestones — auto-earned from match data */}
          {milestones && (
            <div style={{ ...glass({ padding: 18 }), order: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>🏅</span>
                <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                  MILESTONES
                </h3>
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: T.faint }}>
                  {MILESTONES.filter(ms => ms.earned(milestones, awards.length)).length}/{MILESTONES.length}
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
                gap: 8,
              }}>
                {MILESTONES.map(ms => {
                  const got = ms.earned(milestones, awards.length);
                  return (
                    <div
                      key={ms.name}
                      title={ms.detail}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        borderRadius: 12,
                        background: got ? rgba(accent, 0.1) : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${got ? rgba(accent, 0.4) : 'rgba(255,255,255,0.07)'}`,
                        opacity: got ? 1 : 0.45,
                        filter: got ? 'none' : 'grayscale(0.9)',
                      }}
                    >
                      <div style={{ fontSize: 22, lineHeight: 1 }}>{got ? ms.emoji : '🔒'}</div>
                      <div style={{
                        fontFamily: FONT_D, fontSize: 10.5, letterSpacing: 1,
                        color: got ? T.text : T.faint, marginTop: 7,
                      }}>
                        {ms.name}
                      </div>
                      <div style={{ fontFamily: FONT_B, fontSize: 9.5, color: T.faint, marginTop: 2, lineHeight: 1.35 }}>
                        {ms.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pcol">
          {/* standing — Legacy / Beta tags as named entries */}
          {tags.length > 0 && (
            <div style={{ ...glass({ padding: 18 }), order: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>🎗️</span>
                <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                  STANDING
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tags.map(t => {
                  const m = TAG_META[t];
                  return (
                    <div key={t} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10,
                      background: `${m.color}14`, border: `1px solid ${m.color}44`,
                    }}>
                      <span style={{ fontSize: 18 }}>{m.icon}</span>
                      <span style={{ fontFamily: FONT_B, fontSize: 14, fontWeight: 700, color: m.color }}>{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* awards — the cabinet is always on display, even empty */}
          {player.showAwards && (
            <div style={{ ...glass({ padding: 18 }), order: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>🏆</span>
                <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                  TROPHY CABINET
                </h3>
              </div>
              {awards.length > 0 ? (
                <AwardShowcase awards={awards} accent={accent} />
              ) : (
                <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: 0, letterSpacing: 0.5, lineHeight: 1.7 }}>
                  Empty shelves. No silverware on record — unscouted territory.
                </p>
              )}
            </div>
          )}

          {/* achievements — admin-curated */}
          <div style={{ ...glass({ padding: 18 }), order: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>⭐</span>
              <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                ACHIEVEMENTS
              </h3>
            </div>
            {player.achievements ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {player.achievements.split('\n').map(a => a.trim()).filter(Boolean).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: aGlow, boxShadow: `0 0 6px ${rgba(accent, 0.6)}`,
                      alignSelf: 'center',
                    }} />
                    <span style={{ color: T.text, fontFamily: FONT_B, fontSize: 14, lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: 0, letterSpacing: 0.5, lineHeight: 1.7 }}>
                Nothing recorded by the staff yet.
              </p>
            )}
          </div>

          {/* report card — staff-written (the admin "Character" field) */}
          <div style={{ ...glass({ padding: 22, borderLeft: `3px solid ${accent}` }), order: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ fontSize: 13 }}>📋</span>
              <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                REPORT CARD
              </h3>
            </div>
            {player.characterNote ? (
              <>
                <p style={{ color: T.text, fontFamily: FONT_B, fontSize: 14.5, lineHeight: 1.75, margin: 0, opacity: 0.92 }}>
                  {player.characterNote}
                </p>
                <div style={{
                  fontFamily: FONT_M, fontSize: 10, letterSpacing: 1.5,
                  color: T.faint, textAlign: 'right', marginTop: 12,
                }}>
                  — INAZUMA FC STAFF
                </div>
              </>
            ) : (
              <p style={{ fontFamily: FONT_M, fontSize: 11, color: T.faint, margin: 0, letterSpacing: 0.5, lineHeight: 1.8 }}>
                UNSCOUTED — no staff report filed on this player.
                <br />The scouts haven&apos;t caught up with them… yet.
              </p>
            )}
          </div>

          {/* frontier history — the player's tournament record */}
          <div style={{ ...glass({ padding: 22, borderLeft: `3px solid ${accent}` }), order: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ fontSize: 13 }}>🏟️</span>
              <h3 style={{ fontFamily: FONT_D, color: accent, fontSize: 14, letterSpacing: '0.1em', margin: 0 }}>
                FRONTIER HISTORY
              </h3>
            </div>
            <FrontierHistoryCard history={frontierHistory ?? []} accent={accent} isOwn={isOwn} />
          </div>
        </div>
      </div>
    </div>
  );
});
