// Elo calculation engine — pure functions only, no I/O.
// Parameters mirror the `config` table so the engine is tuned from the DB.

export type EloConfig = {
  /** K-factor during placement games. */
  kPlacement: number;
  /** K-factor once established. */
  kEstablished: number;
  /** Number of games a player is in placement for. */
  placementGames: number;
  /** Upper bound on the margin-of-victory multiplier. */
  movMultiplierCap: number;
};

export const DEFAULT_ELO_CONFIG: EloConfig = {
  kPlacement: 60,
  kEstablished: 24,
  placementGames: 5,
  movMultiplierCap: 1.75,
};

export type EloPlayer = {
  elo: number;
  gamesPlayed: number;
};

export type MatchInput = {
  home: EloPlayer[];
  away: EloPlayer[];
  homeScore: number;
  awayScore: number;
};

export type MatchDeltas = {
  /** Per-player Elo change, aligned by index with the input arrays. */
  home: number[];
  away: number[];
};

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Probability that a player/team rated `own` beats one rated `opp`. */
export function expectedScore(own: number, opp: number): number {
  return 1 / (1 + 10 ** ((opp - own) / 400));
}

/**
 * Margin-of-victory multiplier: 1 for draws and one-goal wins, then a
 * logarithmic ramp capped at `cap` so blowouts count more but not absurdly.
 */
export function movMultiplier(goalDiff: number, cap: number): number {
  const raw = Math.log(Math.abs(goalDiff) + 1);
  return Math.min(cap, Math.max(1, raw));
}

/** K-factor for a player given how many ranked games they have played. */
export function kFor(gamesPlayed: number, cfg: EloConfig): number {
  return gamesPlayed < cfg.placementGames ? cfg.kPlacement : cfg.kEstablished;
}

/** Average rating of a side. */
export function teamRating(players: EloPlayer[]): number {
  if (players.length === 0) throw new Error('teamRating: empty side');
  return players.reduce((sum, p) => sum + p.elo, 0) / players.length;
}

/**
 * Elo deltas for one match.
 *
 * Expected score is computed from the average rating of each side; every
 * player on a side shares the same expected/actual score but applies their
 * own K, so placement players swing harder than established ones in the
 * same match.
 */
export function matchDeltas(input: MatchInput, cfg: EloConfig): MatchDeltas {
  const homeAvg = teamRating(input.home);
  const awayAvg = teamRating(input.away);

  const eHome = expectedScore(homeAvg, awayAvg);
  const sHome = input.homeScore > input.awayScore ? 1 : input.homeScore < input.awayScore ? 0 : 0.5;

  const mov = movMultiplier(input.homeScore - input.awayScore, cfg.movMultiplierCap);

  return {
    home: input.home.map(p => round2(kFor(p.gamesPlayed, cfg) * mov * (sHome - eHome))),
    away: input.away.map(p => round2(kFor(p.gamesPlayed, cfg) * mov * ((1 - sHome) - (1 - eHome)))),
  };
}
