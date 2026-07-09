import { describe, expect, test } from 'vitest';
import {
  AWARD_BONUS_CAP_PER_REVEAL,
  AWARD_ELO_BONUS,
  CLIMB_ASSIST_BAND,
  CLIMB_ASSIST_MAX,
  DEFAULT_ELO_CONFIG,
  PERF_WEIGHT,
  awardBonusForName,
  climbAssist,
  expectedScore,
  kFor,
  matchDeltas,
  movMultiplier,
  performanceScores,
  teamRating,
  type EloPlayer,
  type PlayerStats,
} from './elo';

// Core Elo-math suites run with the climb assist neutralised (baseline shoved
// off the board so every test player is far above baseline+band → factor 1),
// keeping the pure-math assertions exact. The climb assist is tested on its
// own with the real baseline below.
const cfg = { ...DEFAULT_ELO_CONFIG, baseline: -1e6 };
const assistCfg = DEFAULT_ELO_CONFIG; // baseline 1000, climb assist live
const established = (elo: number): EloPlayer => ({ elo, gamesPlayed: 20 });
const placement = (elo: number): EloPlayer => ({ elo, gamesPlayed: 0 });
const withStats = (elo: number, stats: Partial<PlayerStats>): EloPlayer => ({
  elo,
  gamesPlayed: 20,
  stats: { rating: null, goals: 0, assists: 0, tackles: 0, ...stats },
});

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

describe('performanceScores', () => {
  test('no stats anywhere → all zeros (classic shared delta)', () => {
    expect(performanceScores([established(1000), established(1100)])).toEqual([0, 0]);
  });

  test('all-zero recorded stats → all zeros too', () => {
    const side = [withStats(1000, {}), withStats(1000, {})];
    expect(performanceScores(side)).toEqual([0, 0]);
  });

  test('higher match rating scores positive, mean-centred', () => {
    const side = [withStats(1000, { rating: 8.5 }), withStats(1000, { rating: 6.5 })];
    const [hi, lo] = performanceScores(side);
    expect(hi).toBeGreaterThan(0);
    expect(lo).toBeLessThan(0);
    expect(hi + lo).toBeCloseTo(0);
  });

  test('clamped to ±1 for extreme gaps', () => {
    const side = [withStats(1000, { rating: 9.9, goals: 5 }), withStats(1000, { rating: 4.0 })];
    const [hi, lo] = performanceScores(side);
    expect(hi).toBe(1);
    expect(lo).toBe(-1);
  });

  test('goals/assists/tackles lift a player without any ratings recorded', () => {
    const side = [withStats(1000, { goals: 2, assists: 1 }), withStats(1000, {})];
    const [scorer, quiet] = performanceScores(side);
    expect(scorer).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(0);
  });

  test('missing rating is neutral, not punished — counting stats still count', () => {
    // Two teammates rated 8.0; the unrated one scored twice.
    const side = [
      withStats(1000, { rating: 8 }),
      withStats(1000, { rating: 8 }),
      withStats(1000, { goals: 2 }),
    ];
    const scores = performanceScores(side);
    expect(scores[2]).toBeGreaterThan(0); // no rating, but the brace counts
    expect(scores[0]).toBeCloseTo(scores[1]); // rated pair symmetric
  });
});

describe('matchDeltas — personalised', () => {
  const evenTeams = (home: EloPlayer[]) => ({
    home,
    away: [established(1000), established(1000)],
    homeScore: 2,
    awayScore: 0,
  });

  test('better-rated teammate gains more from the same win', () => {
    const { home } = matchDeltas(
      evenTeams([withStats(1000, { rating: 8.5 }), withStats(1000, { rating: 6.5 })]),
      cfg,
    );
    expect(home[0]).toBeGreaterThan(home[1]);
    expect(home[0]).toBeGreaterThan(0);
    expect(home[1]).toBeGreaterThan(0); // a win NEVER costs Elo
  });

  test('better performer is shielded on a loss', () => {
    const { home } = matchDeltas(
      {
        home: [withStats(1000, { rating: 8.5 }), withStats(1000, { rating: 6.5 })],
        away: [established(1000), established(1000)],
        homeScore: 0,
        awayScore: 2,
      },
      cfg,
    );
    expect(home[0]).toBeGreaterThan(home[1]); // smaller loss for the 8.5
    expect(home[0]).toBeLessThan(0); // but a loss ALWAYS costs
    expect(home[1]).toBeLessThan(0);
  });

  test('personalisation is bounded by PERF_WEIGHT of the base delta', () => {
    const { home } = matchDeltas(
      evenTeams([withStats(1000, { rating: 9.9, goals: 5 }), withStats(1000, { rating: 4.0 })]),
      cfg,
    );
    const base = (home[0] + home[1]) / 2; // mean-centred perf → mean IS the base
    expect(home[0]).toBeCloseTo(base * (1 + PERF_WEIGHT), 1);
    expect(home[1]).toBeCloseTo(base * (1 - PERF_WEIGHT), 1);
  });

  test('side Elo movement is preserved by mean-centring (same K)', () => {
    const plain = matchDeltas(evenTeams([established(1000), established(1000)]), cfg);
    const personal = matchDeltas(
      evenTeams([withStats(1000, { rating: 8.5, goals: 2 }), withStats(1000, { rating: 6.5 })]),
      cfg,
    );
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(personal.home)).toBeCloseTo(sum(plain.home), 1);
  });

  test('no stats → identical deltas, exactly the old behaviour', () => {
    const { home } = matchDeltas(evenTeams([established(1000), established(1000)]), cfg);
    expect(home[0]).toBe(home[1]);
  });
});

describe('award Elo bonuses', () => {
  test('honour names with a numeral pay their bonus', () => {
    expect(awardBonusForName('Xavier Frost XVII')).toBe(AWARD_ELO_BONUS['Xavier Frost']);
    expect(awardBonusForName("Wallside's Award IV")).toBe(AWARD_ELO_BONUS["Wallside's Award"]);
    expect(awardBonusForName('Team of the Tournament II')).toBe(AWARD_ELO_BONUS['Team of the Tournament']);
  });

  test('bare base names pay too, case-insensitively', () => {
    expect(awardBonusForName('xavier frost')).toBe(AWARD_ELO_BONUS['Xavier Frost']);
    expect(awardBonusForName("BLAZE'S BOOT VII")).toBe(AWARD_ELO_BONUS["Blaze's Boot"]);
  });

  test('champion and unknown awards pay nothing', () => {
    expect(awardBonusForName('Inazuma Frontier XVII')).toBe(0); // matches already paid
    expect(awardBonusForName('Community Hero')).toBe(0);
    expect(awardBonusForName('Xavier Frosty')).toBe(0); // not a numeral suffix
  });

  test('Xavier Frost outranks a tournament of rating-edge personalisation', () => {
    // Rough ceiling of teammate separation over a 6-game frontier:
    // PERF_WEIGHT × K/2 per game × 6 games ≈ 25 — Frost must clear it.
    const seasonEdge = PERF_WEIGHT * (cfg.kEstablished / 2) * 6;
    expect(AWARD_ELO_BONUS['Xavier Frost']).toBeGreaterThan(seasonEdge);
  });

  test('the per-reveal cap stops a full sweep running away', () => {
    const sweep = AWARD_ELO_BONUS['Xavier Frost']
      + AWARD_ELO_BONUS["Blaze's Boot"]
      + AWARD_ELO_BONUS['Team of the Tournament'];
    expect(sweep).toBeGreaterThan(AWARD_BONUS_CAP_PER_REVEAL);
    expect(Math.min(sweep, AWARD_BONUS_CAP_PER_REVEAL)).toBe(AWARD_BONUS_CAP_PER_REVEAL);
  });
});

describe('climbAssist', () => {
  const B = 1000;

  test('full boost at and below the baseline', () => {
    expect(climbAssist(B, B)).toBeCloseTo(1 + CLIMB_ASSIST_MAX);
    expect(climbAssist(B - 300, B)).toBeCloseTo(1 + CLIMB_ASSIST_MAX);
  });

  test('fades to 1 by baseline + band, then stays 1', () => {
    expect(climbAssist(B + CLIMB_ASSIST_BAND, B)).toBeCloseTo(1);
    expect(climbAssist(B + CLIMB_ASSIST_BAND + 500, B)).toBeCloseTo(1);
  });

  test('halfway up the band is half the boost', () => {
    expect(climbAssist(B + CLIMB_ASSIST_BAND / 2, B)).toBeCloseTo(1 + CLIMB_ASSIST_MAX / 2);
  });

  test('monotonically non-increasing as Elo rises', () => {
    const a = climbAssist(1000, B);
    const b = climbAssist(1075, B);
    const c = climbAssist(1150, B);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});

describe('matchDeltas — climb assist near the baseline', () => {
  test('a win at the baseline pays more than the same win up high', () => {
    const atBase = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 1, awayScore: 0 },
      assistCfg,
    );
    const upHigh = matchDeltas(
      { home: [established(1400)], away: [established(1400)], homeScore: 1, awayScore: 0 },
      assistCfg,
    );
    expect(atBase.home[0]).toBeGreaterThan(upHigh.home[0]);
    expect(atBase.home[0]).toBeCloseTo(upHigh.home[0] * (1 + CLIMB_ASSIST_MAX), 1);
  });

  test('losses are NOT assisted — a loss at the baseline is the plain loss', () => {
    const { away } = matchDeltas(
      { home: [established(1000)], away: [established(1000)], homeScore: 1, awayScore: 0 },
      assistCfg,
    );
    // Loser sits at the baseline but drops the un-assisted amount.
    expect(away[0]).toBeCloseTo(-assistCfg.kEstablished / 2, 1);
  });

  test('assist rewards playing: two even wins clear the baseline', () => {
    // A fresh player who plays and wins should climb off 1000; the never-played
    // stay exactly at 1000 (and are unranked in the ladder).
    let elo = 1000;
    for (let i = 0; i < 2; i++) {
      const { home } = matchDeltas(
        { home: [{ elo, gamesPlayed: 10 }], away: [established(1000)], homeScore: 1, awayScore: 0 },
        assistCfg,
      );
      elo += home[0];
    }
    expect(elo).toBeGreaterThan(1000);
  });
});
