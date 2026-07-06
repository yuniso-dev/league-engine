import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ELO_CONFIG,
  expectedScore,
  kFor,
  matchDeltas,
  movMultiplier,
  teamRating,
  type EloPlayer,
} from './elo';

const cfg = DEFAULT_ELO_CONFIG;
const established = (elo: number): EloPlayer => ({ elo, gamesPlayed: 20 });
const placement = (elo: number): EloPlayer => ({ elo, gamesPlayed: 0 });

describe('expectedScore', () => {
  test('equal ratings → 0.5', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  test('complementary: E(a,b) + E(b,a) = 1', () => {
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1);
  });

  test('400 points higher → ~0.909', () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 3);
  });
});

describe('movMultiplier', () => {
  test('draw (diff 0) → 1', () => {
    expect(movMultiplier(0, cfg.movMultiplierCap)).toBe(1);
  });

  test('one-goal win → 1', () => {
    expect(movMultiplier(1, cfg.movMultiplierCap)).toBe(1);
  });

  test('grows with margin: 3-goal > 2-goal', () => {
    const two = movMultiplier(2, cfg.movMultiplierCap);
    const three = movMultiplier(3, cfg.movMultiplierCap);
    expect(two).toBeGreaterThan(1);
    expect(three).toBeGreaterThan(two);
  });

  test('capped at movMultiplierCap for blowouts', () => {
    expect(movMultiplier(9, cfg.movMultiplierCap)).toBe(cfg.movMultiplierCap);
  });

  test('sign of margin is irrelevant', () => {
    expect(movMultiplier(-3, cfg.movMultiplierCap)).toBe(movMultiplier(3, cfg.movMultiplierCap));
  });
});

describe('kFor', () => {
  test('placement K below the threshold', () => {
    expect(kFor(0, cfg)).toBe(cfg.kPlacement);
    expect(kFor(cfg.placementGames - 1, cfg)).toBe(cfg.kPlacement);
  });

  test('established K at and beyond the threshold', () => {
    expect(kFor(cfg.placementGames, cfg)).toBe(cfg.kEstablished);
    expect(kFor(100, cfg)).toBe(cfg.kEstablished);
  });

  test('default placement is one Frontier — 3 games', () => {
    expect(cfg.placementGames).toBe(3);
  });
});

describe('teamRating', () => {
  test('averages the side', () => {
    expect(teamRating([established(900), established(1100)])).toBe(1000);
  });

  test('throws on an empty side', () => {
    expect(() => teamRating([])).toThrow();
  });
});

describe('matchDeltas', () => {
  test('evenly matched 1-0: winner gains K/2, loser mirrors', () => {
    const { home, away } = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 1, awayScore: 0 },
      cfg,
    );
    expect(home[0]).toBeCloseTo(cfg.kEstablished / 2);
    expect(away[0]).toBeCloseTo(-cfg.kEstablished / 2);
  });

  test('draw between evenly matched sides moves nothing', () => {
    const { home, away } = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 2, awayScore: 2 },
      cfg,
    );
    expect(home[0]).toBe(0);
    expect(away[0]).toBe(0);
  });

  test('underdog win pays more than favourite win', () => {
    const upset = matchDeltas(
      { home: [established(1000)], away: [established(1200)], homeScore: 1, awayScore: 0 },
      cfg,
    );
    const expected = matchDeltas(
      { home: [established(1200)], away: [established(1000)], homeScore: 1, awayScore: 0 },
      cfg,
    );
    expect(upset.home[0]).toBeGreaterThan(expected.home[0]);
  });

  test('draw against a stronger side gains rating', () => {
    const { home, away } = matchDeltas(
      { home: [established(1000)], away: [established(1200)], homeScore: 0, awayScore: 0 },
      cfg,
    );
    expect(home[0]).toBeGreaterThan(0);
    expect(away[0]).toBeLessThan(0);
  });

  test('placement players swing harder than established teammates', () => {
    const { home } = matchDeltas(
      {
        home: [placement(1000), established(1000)],
        away: [established(1000)],
        homeScore: 1,
        awayScore: 0,
      },
      cfg,
    );
    expect(home[0]).toBeCloseTo((cfg.kPlacement / cfg.kEstablished) * home[1], 1);
    expect(home[0]).toBeGreaterThan(home[1]);
  });

  test('bigger winning margin moves more rating', () => {
    const narrow = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 1, awayScore: 0 },
      cfg,
    );
    const blowout = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 5, awayScore: 0 },
      cfg,
    );
    expect(blowout.home[0]).toBeGreaterThan(narrow.home[0]);
    expect(blowout.home[0]).toBeLessThanOrEqual((cfg.kEstablished / 2) * cfg.movMultiplierCap);
  });

  test('zero-sum for equal-size sides with equal K', () => {
    const { home, away } = matchDeltas(
      {
        home: [established(980), established(1050)],
        away: [established(1100), established(990)],
        homeScore: 3,
        awayScore: 1,
      },
      cfg,
    );
    const total = [...home, ...away].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(0, 1);
  });

  test('team expected score uses side averages', () => {
    // Home side averages 1100 vs away 1100 — even despite lopsided members.
    const { home } = matchDeltas(
      {
        home: [established(900), established(1300)],
        away: [established(1100), established(1100)],
        homeScore: 1,
        awayScore: 0,
      },
      cfg,
    );
    expect(home[0]).toBeCloseTo(cfg.kEstablished / 2);
    expect(home[0]).toBeCloseTo(home[1]);
  });
});
