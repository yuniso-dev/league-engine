import type { MatchStage } from '@inazuma/db';
import { frontierFormat } from '@inazuma/core';

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Group',
  round_of_16: 'Round of 16',
  quarter: 'Quarter-final',
  semi: 'Semi-final',
  final: 'Final',
  third_place: 'Third place',
  friendly: 'Friendly',
};

/** The stage label to SHOW, given how many teams are in the tournament. A
 *  2-team Frontier is a best-of-5 series stored internally as 'group' fixtures
 *  (so the standings table can total the series) — so it reads "Best of 5",
 *  not "Group". Every other size keeps the normal labels. Pass the game's
 *  1-based number within the series to get "Best of 5 · Game 3". */
export function stageLabel(stage: MatchStage, teamCount: number, gameNumber?: number): string {
  if (stage === 'group') {
    const fmt = frontierFormat(teamCount);
    if (fmt.phase === 'series') {
      return gameNumber ? `Best of ${fmt.seriesLength} · Game ${gameNumber}` : `Best of ${fmt.seriesLength}`;
    }
  }
  return STAGE_LABELS[stage] ?? stage;
}

export const STATUS_COLORS: Record<'upcoming' | 'live' | 'completed', string> = {
  upcoming: '#8B5CF6',
  live: '#3DDC97',
  completed: '#94A3C4',
};
