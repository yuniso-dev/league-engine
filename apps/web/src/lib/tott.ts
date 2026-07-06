import type { CeremonySheet } from '@inazuma/db';

// Team of the Tournament: the best-rated player(s) per EA position bucket.
// A 1-2-2-2 "Best VII" fits the league's small squads; buckets nobody played
// (or with too few rated appearances) are simply omitted, so thin data
// degrades to a shorter team instead of nonsense. Pure — CeremonyBoard uses
// it for the card AND the announcement draft, so they can never disagree.

type RatedPlayer = CeremonySheet['ratedPlayers'][number];

export type TottLine = {
  bucket: string;
  label: string;
  emoji: string;
  players: RatedPlayer[];
};

const SHAPE = [
  { bucket: 'goalkeeper', label: 'GK', emoji: '🧤', slots: 1 },
  { bucket: 'defender', label: 'DEF', emoji: '🛡️', slots: 2 },
  { bucket: 'midfielder', label: 'MID', emoji: '⚙️', slots: 2 },
  { bucket: 'forward', label: 'FWD', emoji: '⚡', slots: 2 },
] as const;

export function pickTeamOfTournament(ratedPlayers: RatedPlayer[]): TottLine[] {
  // ratedPlayers arrive best-avg-rating-first from getCeremonySheet.
  return SHAPE
    .map(s => ({
      bucket: s.bucket,
      label: s.label,
      emoji: s.emoji,
      players: ratedPlayers.filter(p => p.bucket === s.bucket).slice(0, s.slots),
    }))
    .filter(line => line.players.length > 0);
}
