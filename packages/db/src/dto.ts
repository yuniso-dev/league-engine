import type { InferSelectModel } from 'drizzle-orm';
import type { users, tournaments } from './schema';

type UserRow = InferSelectModel<typeof users>;
type TournamentRow = InferSelectModel<typeof tournaments>;

// Fields safe to expose to the browser.
// NEVER expose: discordId, role, isBlacklisted, initialised, initialisedAt,
//               lastActiveAt, createdAt, updatedAt, or any internal timestamps.
export type PublicPlayer = {
  publicId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  position1: string | null;
  position2: string | null;
  hidePositions: boolean;
  showUsername: boolean;
  elo: number;
  rank: number | null;
  provisional: boolean;
  gamesPlayed: number;
  peakElo: number | null;
  peakRank: number | null;
  country: string | null;
  quote: string | null;
  bio: string | null;
  title: string | null;
  characterNote: string | null;   // null when the admin has hidden the section
  achievements: string | null;    // null when the admin has hidden the section
  showAwards: boolean;
  accentColor: string | null;
  tier: 'free' | 'premium';
  eventsAttended: number;
  /** Ladder extras — only populated by getRankings. */
  awardBadges?: { name: string; icon: string | null; imageUrl: string | null }[];
  wins?: number;
};

export function toPublicPlayer(row: UserRow): PublicPlayer {
  return {
    publicId: row.publicId!,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    position1: row.position1,
    position2: row.position2,
    hidePositions: row.hidePositions,
    showUsername: row.showUsername,
    elo: parseFloat(row.elo as string),
    rank: row.rank,
    provisional: row.provisional,
    gamesPlayed: row.gamesPlayed,
    peakElo: row.peakElo != null ? parseFloat(row.peakElo as string) : null,
    peakRank: row.peakRank,
    country: row.country,
    quote: row.quote,
    bio: row.bio,
    title: row.title,
    characterNote: row.showCharacter ? row.characterNote : null,
    achievements: row.showAchievements ? row.achievements : null,
    showAwards: row.showAwards,
    accentColor: row.accentColor,
    tier: row.tier,
    eventsAttended: row.eventsAttended,
  };
}

export type PublicTournament = {
  id: string;
  name: string;
  season: number;
  status: 'upcoming' | 'live' | 'completed';
  startDate: string | null;
  endDate: string | null;
  winnerName: string | null;
};

export function toPublicTournament(row: TournamentRow, winnerName: string | null = null): PublicTournament {
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    winnerName,
  };
}
