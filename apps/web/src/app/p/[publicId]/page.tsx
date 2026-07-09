import { notFound } from 'next/navigation';
import {
  getConfig,
  getFrontierHistory,
  getHeadToHead,
  getUserByDiscordId,
  getUserByPublicId,
  getRatingHistoryByPublicId,
  getRecentMatchesForPlayer,
  listAwardsForPlayer,
  runResilient,
} from '@inazuma/db';
import type { FrontierHistoryEntry, HeadToHead, PublicAward, PublicRecentMatch, RatingPoint } from '@inazuma/db';
import { auth } from '@/auth';
import { HeadToHeadCard } from '@/components/HeadToHeadCard';
import { FrontierHistoryCard } from '@/components/FrontierHistoryCard';
import { Avatar } from '@/components/ui/Avatar';
import { BackPill } from '@/components/ui/BackPill';
import { RatingGraph } from '@/components/RatingGraph';
import { AwardShowcase } from '@/components/AwardShowcase';
import { RecentMatchesCard } from '@/components/RecentMatchesCard';
import { glass, T, FONT_D, FONT_B, FONT_M, rankColor, rgba, lighten } from '@/lib/realm-colors';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { TagChips } from '@/components/ui/TagChips';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: { publicId: string } };

export default async function PublicProfilePage({ params }: Props) {
  // runResilient: timeout → rebuild the pool → retry once, so a dead pooled
  // socket surfaces as a beat of latency instead of the error page.
  const player = await runResilient(() => getUserByPublicId(params.publicId));
  if (!player) notFound();

  // Placement length is league-configurable (Admin → Settings) — never hardcode it.
  const placementGames = await getConfig().then(c => c.placementGames).catch(() => 3);

  // Head-to-head vs the signed-in viewer (share links opened logged-out — or
  // by the player themselves — simply skip it). Never lets the page fail.
  const headToHeadPromise: Promise<HeadToHead | null> = auth()
    .then(async session => {
      if (!session?.user?.discordId) return null;
      const viewer = await runResilient(() => getUserByDiscordId(session.user.discordId!));
      if (!viewer?.publicId || viewer.publicId === params.publicId) return null;
      return runResilient(() => getHeadToHead(viewer.publicId!, params.publicId));
    })
    .catch(() => null);

  // Extras degrade gracefully — the card itself always renders.
  const [[history, playerAwards, recentMatches, frontierHistory], headToHead] = await Promise.all([
    runResilient(() =>
      Promise.all([
        getRatingHistoryByPublicId(params.publicId),
        listAwardsForPlayer(params.publicId),
        getRecentMatchesForPlayer(params.publicId),
        getFrontierHistory(params.publicId),
      ]),
    ).catch((): [RatingPoint[], PublicAward[], PublicRecentMatch[], FrontierHistoryEntry[]] => [[], [], [], []]),
    headToHeadPromise,
  ]);

  const accent = player.accentColor ?? '#FF7A1A';
  const initials = player.displayName.slice(0, 2).toUpperCase();
  // Ranks are tie-aware and assigned to everyone — show one whenever it exists.
  const showRank = player.rank !== null;
  const rankLabel = showRank ? `#${player.rank}` : player.provisional ? `${player.gamesPlayed}/${placementGames}` : '—';
  const rankCaption = showRank ? 'RANK' : player.provisional ? 'PLACEMENT' : 'RANK';

  const positions = !player.hidePositions
    ? `${player.position1 ?? '??'} / ${player.position2 ?? '??'}`
    : null;

  const achievements = player.achievements
    ? player.achievements.split('\n').map(a => a.trim()).filter(Boolean)
    : [];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 70%, #3A1A08 0%, #120703 55%, #04050c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      <header style={{ width: '100%', maxWidth: 460, marginBottom: 24 }}>
        <BackPill href="/" label="INAZUMA FC" accent={accent} />
      </header>

      <div style={{
        ...glass({ padding: 32, borderRadius: 22 }),
        width: '100%',
        maxWidth: 460,
        borderTop: `1px solid ${rgba(accent, 0.35)}`,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Avatar initials={initials} src={player.avatarUrl} size={64} ring={accent} />
          <div>
            <div style={{ fontFamily: FONT_D, fontSize: 24, color: T.text, letterSpacing: 1 }}>
              {player.displayName}
            </div>
            {player.title && (
              <div style={{
                fontFamily: FONT_M,
                fontSize: 10,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: lighten(accent, 0.3),
                marginTop: 3,
              }}>
                {player.title}
              </div>
            )}
            {positions && (
              <div style={{ fontFamily: FONT_M, fontSize: 13, color: accent, marginTop: 2 }}>
                {positions}
              </div>
            )}
            {player.country && (
              <div style={{ marginTop: 4 }}>
                <FlagIcon code={player.country} size={20} />
              </div>
            )}
            {player.tags && player.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                <TagChips tags={player.tags} />
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginBottom: 24 }}>
          {[
            { label: rankCaption, value: rankLabel, color: showRank ? rankColor(player.rank) : T.dim },
            { label: 'ELO', value: Math.round(player.elo).toString(), color: T.text },
            { label: 'PLAYED', value: player.gamesPlayed.toString(), color: T.text },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: '14px 0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: FONT_D, fontSize: 22, color, letterSpacing: 1 }}>{value}</div>
              <div style={{ fontFamily: FONT_B, fontSize: 10, color: T.faint, letterSpacing: 1, marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {player.provisional && (
          <div style={{
            background: rgba(accent, 0.1),
            border: `1px solid ${rgba(accent, 0.25)}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: FONT_B,
            fontSize: 13,
            color: accent,
            marginBottom: 20,
          }}>
            Provisional — {player.gamesPlayed}/{placementGames} placement games
          </div>
        )}

        {player.showAwards && playerAwards.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: FONT_M, fontSize: 10, color: T.faint,
              letterSpacing: 1, marginBottom: 8,
            }}>
              TROPHY CABINET
            </div>
            <AwardShowcase awards={playerAwards} />
          </div>
        )}

        {/* Achievements — admin-curated, hidden server-side when toggled off */}
        {achievements.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: FONT_M, fontSize: 10, color: T.faint,
              letterSpacing: 1, marginBottom: 8,
            }}>
              ACHIEVEMENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {achievements.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ color: accent, fontSize: 11, flexShrink: 0 }}>⚡</span>
                  <span style={{ fontFamily: FONT_B, fontSize: 13.5, color: T.text, lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating history */}
        {history.length >= 2 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: FONT_M, fontSize: 10, color: T.faint,
              letterSpacing: 1, marginBottom: 8,
            }}>
              RATING HISTORY
            </div>
            <RatingGraph points={history} />
          </div>
        )}

        {/* Bio / quote */}
        {player.quote && (
          <blockquote style={{
            margin: '0 0 16px',
            paddingLeft: 14,
            borderLeft: `3px solid ${rgba(accent, 0.5)}`,
            fontFamily: FONT_B,
            fontSize: 14,
            color: T.dim,
            fontStyle: 'italic',
          }}>
            "{player.quote}"
          </blockquote>
        )}

        {/* Report card — admin-curated, hidden server-side when toggled off */}
        {player.characterNote && (
          <div style={{ margin: '0 0 16px' }}>
            <div style={{
              fontFamily: FONT_M, fontSize: 10, color: T.faint,
              letterSpacing: 1, marginBottom: 8,
            }}>
              REPORT CARD
            </div>
            <p style={{
              margin: 0,
              fontFamily: FONT_B,
              fontSize: 14,
              color: T.dim,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {player.characterNote}
            </p>
          </div>
        )}

        {/* Frontier history — the tournament record */}
        {frontierHistory.length > 0 && (
          <div style={{ margin: '0 0 16px' }}>
            <div style={{
              fontFamily: FONT_M, fontSize: 10, color: T.faint,
              letterSpacing: 1, marginBottom: 8,
            }}>
              FRONTIER HISTORY
            </div>
            <FrontierHistoryCard history={frontierHistory} accent={accent} />
          </div>
        )}

        {/* Tier badge */}
        {player.tier === 'premium' && (
          <div style={{
            marginTop: 20,
            display: 'inline-block',
            padding: '4px 10px',
            background: 'rgba(255,210,74,0.15)',
            border: '1px solid rgba(255,210,74,0.35)',
            borderRadius: 6,
            fontFamily: FONT_B,
            fontSize: 11,
            color: T.gold,
            letterSpacing: 1,
          }}>
            PREMIUM
          </div>
        )}
      </div>

      {/* Head-to-head vs the signed-in viewer — absent when logged out or on your own page */}
      {headToHead && (
        <div style={{ width: '100%', maxWidth: 460, marginTop: 12 }}>
          <HeadToHeadCard h2h={headToHead} targetName={player.displayName} accent={accent} />
        </div>
      )}

      {/* Recent matches — its own card below the profile card */}
      {recentMatches.length > 0 && (
        <div style={{ width: '100%', maxWidth: 460, marginTop: 12 }}>
          <RecentMatchesCard matches={recentMatches} accent={accent} />
        </div>
      )}
    </div>
  );
}
