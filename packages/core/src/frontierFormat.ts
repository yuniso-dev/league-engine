// Frontier formats by size. The shape of a Frontier is decided purely by how
// many teams take part — the admin never picks a format, the system derives it:
//
//   2 teams  → best-of-5 series, the home team (who sends the invite) alternates
//   3–5 teams → round robin (everyone plays everyone once), top 2 → final
//   6 teams  → partial round robin, each team plays 4 (one opponent skipped to
//              cut game time), top 4 → seeded semi-finals → final
//   7+ teams → round robin, top 4 → seeded semi-finals → final (scales the six)
//
// This module is the single source of truth for that mapping; the DB layer
// consumes it to generate fixtures and to progress the bracket automatically.

export type FrontierPhase = 'series' | 'round_robin' | 'partial_round_robin';
export type KnockoutShape = 'none' | 'final' | 'semis';

export type FrontierFormat = {
  teamCount: number;
  phase: FrontierPhase;
  /** Best-of-N length for a 2-team series (5). 0 for every other format. */
  seriesLength: number;
  /** Wins needed to take the series (3 of 5). 0 for non-series. */
  seriesWinTarget: number;
  /** Games each team plays in the group. null = full round robin (plays everyone).
   *  A number means a PARTIAL round robin where each team plays exactly this many. */
  groupGamesEach: number | null;
  /** Teams advancing from the group into the knockout. 0 for a series. */
  advance: number;
  /** Knockout shape drawn from the finished table. */
  knockout: KnockoutShape;
  /** Whether the knockout is seeded from the table (1v4, 2v3) vs a random draw. */
  seeded: boolean;
  /** Human-readable summary for the admin UI and the intro post. */
  label: string;
};

export function frontierFormat(teamCount: number): FrontierFormat {
  const base = { teamCount, seriesLength: 0, seriesWinTarget: 0, groupGamesEach: null, seeded: false } as const;

  if (teamCount < 2) {
    return { ...base, phase: 'round_robin', advance: 0, knockout: 'none', label: 'Not enough teams — add at least 2' };
  }

  if (teamCount === 2) {
    return {
      ...base,
      phase: 'series',
      seriesLength: 5,
      seriesWinTarget: 3,
      groupGamesEach: 5,
      advance: 0,
      knockout: 'none',
      label: 'Best of 5 — home team (who invites) alternates each game',
    };
  }

  if (teamCount === 6) {
    return {
      ...base,
      phase: 'partial_round_robin',
      groupGamesEach: 4,
      advance: 4,
      knockout: 'semis',
      seeded: true,
      label: 'Partial round robin — each team plays 4 → top 4 → seeded semi-finals → final',
    };
  }

  if (teamCount <= 5) {
    return {
      ...base,
      phase: 'round_robin',
      advance: 2,
      knockout: 'final',
      label: 'Round robin — play everyone once → top 2 → final',
    };
  }

  // 7+ — round robin, top four into seeded semis (the six-team idea, scaled up).
  return {
    ...base,
    phase: 'round_robin',
    advance: 4,
    knockout: 'semis',
    seeded: true,
    label: 'Round robin — play everyone once → top 4 → seeded semi-finals → final',
  };
}
