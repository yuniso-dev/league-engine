import type { MatchStage } from '@inazuma/db';

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Group',
  round_of_16: 'Round of 16',
  quarter: 'Quarter-final',
  semi: 'Semi-final',
  final: 'Final',
  third_place: 'Third place',
  friendly: 'Friendly',
};

export const STATUS_COLORS: Record<'upcoming' | 'live' | 'completed', string> = {
  upcoming: '#8B5CF6',
  live: '#3DDC97',
  completed: '#94A3C4',
};
