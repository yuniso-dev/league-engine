import { describe, expect, it } from 'vitest';
import { frontierFormat } from './frontierFormat';

describe('frontierFormat', () => {
  it('needs at least 2 teams', () => {
    expect(frontierFormat(1).knockout).toBe('none');
    expect(frontierFormat(0).advance).toBe(0);
  });

  it('2 teams → best-of-5 series, first to 3, no knockout', () => {
    const f = frontierFormat(2);
    expect(f.phase).toBe('series');
    expect(f.seriesLength).toBe(5);
    expect(f.seriesWinTarget).toBe(3);
    expect(f.knockout).toBe('none');
    expect(f.advance).toBe(0);
  });

  it('3, 4 and 5 teams → full round robin, top 2 → final', () => {
    for (const n of [3, 4, 5]) {
      const f = frontierFormat(n);
      expect(f.phase).toBe('round_robin');
      expect(f.groupGamesEach).toBeNull(); // plays everyone
      expect(f.advance).toBe(2);
      expect(f.knockout).toBe('final');
      expect(f.seeded).toBe(false);
    }
  });

  it('6 teams → partial round robin (4 each), top 4 → seeded semis', () => {
    const f = frontierFormat(6);
    expect(f.phase).toBe('partial_round_robin');
    expect(f.groupGamesEach).toBe(4);
    expect(f.advance).toBe(4);
    expect(f.knockout).toBe('semis');
    expect(f.seeded).toBe(true);
  });

  it('7+ teams → round robin, top 4 → seeded semis', () => {
    const f = frontierFormat(7);
    expect(f.phase).toBe('round_robin');
    expect(f.advance).toBe(4);
    expect(f.knockout).toBe('semis');
    expect(f.seeded).toBe(true);
  });

  it('every valid size produces a non-empty label', () => {
    for (let n = 2; n <= 12; n++) {
      expect(frontierFormat(n).label.length).toBeGreaterThan(0);
    }
  });
});
