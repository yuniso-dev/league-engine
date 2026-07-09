// Elo calculation engine — pure functions only, no I/O.
// Parameters mirror the `config` table so the engine is tuned from the DB.

import { HONOURS, isRomanNumeral } from './editions';

export type EloConfig = {
  /** K-factor during placement games. */
  kPlacement: number;
  /** K-factor once established. */
  kEstablished: number;
  /** Number of games a player is in placement for. */
  placementGames: number;
  /** Upper bound on the margin-of-victory multiplier. */
  movMultiplierCap: number;
  /** Starting Elo everyone shares — the "played nothing yet" baseline. Gains
   *  near it are assisted (see climbAssist) so playing separates you from it. */
  baseline: number;
};

export const DEFAULT_ELO_CONFIG: EloConfig = {
  kPlacement: 60,
  kEstablished: 24,
  // One Frontier's worth — every team plays at least 3 games, so a single
  // tournament completes placement and gets a player ranked.
  placementGames: 3,
  movMultiplierCap: 1.75,
  baseline: 1000,
};

// ── Per-player personalisation ─────────────────────────────────────────────
// Teammates no longer share one delta: each player's recorded match stats
// shift their slice of the team swing. Constants (not config columns) so the
// tuning ships without a migration.

/** Max fraction of the base team delta that performance can add or remove.
 *  0.35 → a win pays between 65% and 135% of the team delta; a loss costs
 *  between 65% and 135%. Personalisation can never flip the sign of a
 *  result, so nobody loses Elo for winning — bounded and recoverable. */
export const PERF_WEIGHT = 0.35;

/** Composite-impact points above/below the team average needed to hit the
 *  full ±PERF_WEIGHT swing. ~2 ≈ two full rating points, or a brace plus an
 *  assist over the team norm. */
export const PERF_SPREAD = 2;

/** Weights folding counting stats into the composite impact score. Rating is
 *  the primary signal (weight 1 via its deviation); these keep goals worth
 *  roughly half a rating point each so a scorer without a recorded rating
 *  still earns their edge. */
export const GOAL_WEIGHT = 0.5;
export const ASSIST_WEIGHT = 0.3;
export const TACKLE_WEIGHT = 0.1;

// ── Climb assist near the baseline ─────────────────────────────────────────
// Everyone starts at the baseline (1000). To reward playing over sitting at
// the untouched baseline, Elo GAINS are amplified when you're near or below
// it, fading to nothing once you've climbed a band above. Side effect by
// design: it also slows runaway leaders (no assist up high), matching the
// "don't get too far ahead" goal. Losses are never touched.

/** Extra fraction added to a gain at/below the baseline (0.4 → +40%). */
export const CLIMB_ASSIST_MAX = 0.4;

/** Elo above the baseline over which the assist fades from full to zero. */
export const CLIMB_ASSIST_BAND = 150;

/** Gain multiplier for a player rated `elo`, given the league `baseline`.
 *  1 + CLIMB_ASSIST_MAX at/below baseline, ramping down to 1 by
 *  baseline + CLIMB_ASSIST_BAND, and 1 above it. */
export function climbAssist(elo: number, baseline: number): number {
  const t = Math.min(1, Math.max(0, (baseline + CLIMB_ASSIST_BAND - elo) / CLIMB_ASSIST_BAND));
  return 1 + CLIMB_ASSIST_MAX * t;
}

// ── Participation floor ────────────────────────────────────────────────────
// Playing should be rewarded over sitting at the untouched baseline: a player
// who turns up and loses a whole Frontier still ends up above someone who
// never played. So a player's rating can't fall below a floor that RISES with
// games played, up to a ceiling reached only after several Frontiers of play —
// so participation keeps paying off for a while, not just for one tournament.
// Winners are unaffected (they're above the floor); it only catches the bottom
// of the ladder near the baseline.

/** Floor added per game played — one Frontier (~6 games) ≈ +48. */
export const FLOOR_PER_GAME = 8;

/** Ceiling on the floor bonus — the most participation ALONE can hold you
 *  above the baseline (baseline + this ≈ 1150 by default), reached after
 *  FLOOR_MAX_BONUS / FLOOR_PER_GAME (~19) games, i.e. several Frontiers. */
export const FLOOR_MAX_BONUS = 150;

/** Lowest Elo a player with `gamesPlayed` games can hold, given `baseline`.
 *  baseline for the never-played (a no-op), rising FLOOR_PER_GAME per game up
 *  to baseline + FLOOR_MAX_BONUS. */
export function participationFloor(gamesPlayed: number, baseline: number): number {
  const games = Math.max(0, gamesPlayed);
  return baseline + Math.min(FLOOR_MAX_BONUS, FLOOR_PER_GAME * games);
}

export type PlayerStats = {
  /** EA average match rating (0–10) for THIS match; null when not recorded. */
  rating: number | null;
  goals: number;
  assists: number;
  tackles: number;
};

export type EloPlayer = {
  elo: number;
  gamesPlayed: number;
  /** Per-match performance stats; omit when not recorded — the player then
   *  sits at the team baseline and gets the classic shared delta. */
  stats?: PlayerStats | null;
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

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * Per-player performance score within one side, each in [-1, +1].
 *
 * Composite impact = match-rating deviation from the side's average rating
 * (only among players WITH a rating — a missing rating contributes zero, it
 * never punishes) + weighted goals/assists/tackles deviation from the side's
 * average. Mean-centred, so a side's scores roughly sum to zero and total
 * team Elo movement is preserved; when nobody has stats every score is 0 and
 * the engine behaves exactly as before.
 */
export function performanceScores(players: EloPlayer[]): number[] {
  const rated = players.filter(p => p.stats?.rating != null);
  const ratingMean = rated.length
    ? rated.reduce((sum, p) => sum + p.stats!.rating!, 0) / rated.length
    : null;

  const statScore = (p: EloPlayer): number => {
    const s = p.stats;
    if (!s) return 0;
    return GOAL_WEIGHT * s.goals + ASSIST_WEIGHT * s.assists + TACKLE_WEIGHT * s.tackles;
  };
  const statMean = players.length
    ? players.reduce((sum, p) => sum + statScore(p), 0) / players.length
    : 0;

  return players.map(p => {
    const ratingDev = ratingMean != null && p.stats?.rating != null ? p.stats.rating - ratingMean : 0;
    const dev = ratingDev + (statScore(p) - statMean);
    return clamp(dev / PERF_SPREAD, -1, 1);
  });
}

/**
 * Elo deltas for one match.
 *
 * Expected score is computed from the average rating of each side; every
 * player on a side shares the same base swing (their own K applies, so
 * placement players still move harder), then a bounded performance term
 * personalises it: play above your side's level and a win pays more / a
 * loss costs less; play below it and the reverse. The term scales with the
 * match's stakes (±PERF_WEIGHT × |base|), so it can never flip a result's
 * sign — a winner always gains, a loser always drops. Finally, gains near
 * the baseline are lifted by climbAssist so active players separate from
 * the untouched starting pack.
 */
export function matchDeltas(input: MatchInput, cfg: EloConfig): MatchDeltas {
  const homeAvg = teamRating(input.home);
  const awayAvg = teamRating(input.away);

  const eHome = expectedScore(homeAvg, awayAvg);
  const sHome = input.homeScore > input.awayScore ? 1 : input.homeScore < input.awayScore ? 0 : 0.5;

  const mov = movMultiplier(input.homeScore - input.awayScore, cfg.movMultiplierCap);

  const perfHome = performanceScores(input.home);
  const perfAway = performanceScores(input.away);

  const personalised = (p: EloPlayer, result: number, perf: number): number => {
    const base = kFor(p.gamesPlayed, cfg) * mov * result;
    const withPerf = base + Math.abs(base) * PERF_WEIGHT * perf;
    // Only gains are assisted; a loss (or a zeroed draw) is left as-is.
    const assisted = withPerf > 0 ? withPerf * climbAssist(p.elo, cfg.baseline) : withPerf;
    return round2(assisted);
  };

  return {
    home: input.home.map((p, i) => personalised(p, sHome - eHome, perfHome[i])),
    away: input.away.map((p, i) => personalised(p, (1 - sHome) - (1 - eHome), perfAway[i])),
  };
}

// ── Award Elo bonuses ──────────────────────────────────────────────────────
// Winning an honour at a Frontier ceremony pays a one-off Elo bonus at the
// next reveal. Deliberately large relative to per-match personalisation
// (a whole tournament of out-rating a teammate is worth ~15–25) so an award
// win can leapfrog a higher-rated rival — but one-off and capped, so nobody
// runs away with the ladder.

/** Bonus per honour, keyed by the award's un-numbered base name (awards are
 *  minted "<base> <numeral>"). Inazuma Frontier (champion) is absent on
 *  purpose: winning the tournament already paid full match Elo. */
export const AWARD_ELO_BONUS: Record<string, number> = {
  'Xavier Frost': 50,           // player of the tournament — the big one
  "Wallside's Award": 30,       // best defender
  "Evan's Golden Glove": 30,    // best goalkeeper
  "Blaze's Boot": 30,           // top scorer
  "Sharp's Award": 30,          // top assister
  'Team of the Tournament': 15, // named in the Best VII
  'Mr Inazuma': 10,             // winning captain — matches already paid
};

/** Ceiling on the SUM of award bonuses one player can bank in a single
 *  reveal — a Frost + Boot + TOTT sweep pays 75, not 95. */
export const AWARD_BONUS_CAP_PER_REVEAL = 75;

/** Elo bonus for an award name like "Xavier Frost XVII" (or the bare base
 *  name). Unknown/custom award names pay nothing — only the league honours
 *  in AWARD_ELO_BONUS move ratings. */
export function awardBonusForName(name: string): number {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  for (const h of HONOURS) {
    const bonus = AWARD_ELO_BONUS[h.base];
    if (!bonus) continue;
    const baseLower = h.base.toLowerCase();
    if (lower === baseLower) return bonus;
    if (lower.startsWith(`${baseLower} `) && isRomanNumeral(trimmed.slice(h.base.length).trim())) {
      return bonus;
    }
  }
  return 0;
}
