// Frontier editions & honours. Every Frontier is an edition ("Frontier XVII"),
// and its awards are minted per-edition ("Blaze's Boot XVII") — so the ceremony
// needs roman numerals both ways: format the next one, and read the current one
// out of the tournament's name.

const ROMAN_PAIRS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** 17 → "XVII". Valid for 1..3999 (standard subtractive notation). */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(`toRoman: expected an integer in 1..3999, got ${n}`);
  }
  let rest = n;
  let out = '';
  for (const [value, glyph] of ROMAN_PAIRS) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** Greedy read of a roman string; returns NaN for empty/non-roman characters.
 *  Loose on its own ("IIII" → 4) — isRomanNumeral adds the strict round-trip. */
function fromRoman(s: string): number {
  const upper = s.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(upper)) return NaN;
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < upper.length; i++) {
    const cur = values[upper[i]];
    const next = i + 1 < upper.length ? values[upper[i + 1]] : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/** Strictly-valid roman numeral? Round-trips through toRoman, so sloppy forms
 *  ("IIII", "VX") are rejected — only canonical numerals mint awards. */
export function isRomanNumeral(s: string): boolean {
  const n = fromRoman(s.trim());
  if (!Number.isFinite(n) || n < 1 || n > 3999) return false;
  return toRoman(n) === s.trim().toUpperCase();
}

/** Pull the edition out of a tournament name: "Frontier XVII" → { edition: 17,
 *  numeral: "XVII" }. Null when the name doesn't END in a valid numeral —
 *  the ceremony page then leaves the numeral field blank for the admin. */
export function parseEdition(name: string): { edition: number; numeral: string } | null {
  const match = /\s([IVXLCDMivxlcdm]+)\s*$/.exec(name.trimEnd());
  if (!match) return null;
  const token = match[1];
  if (!isRomanNumeral(token)) return null;
  return { edition: fromRoman(token), numeral: token.toUpperCase() };
}

/** The league's standing honours, in ceremony order. `base` is the award's
 *  un-numbered name; each edition grants "<base> <numeral>". Shared by the
 *  web ceremony page, award presets, and the bot's poll/intro commands. */
export const HONOURS = [
  { key: 'topScorer', icon: '🥇', base: "Blaze's Boot", description: 'Top goal-scorer of the Frontier' },
  { key: 'topAssister', icon: '👑', base: "Sharp's Award", description: 'Most assists in the Frontier' },
  { key: 'goldenGlove', icon: '🧤', base: "Evan's Golden Glove", description: 'Best goalkeeper — highest average match rating' },
  { key: 'bestDefender', icon: '🧱', base: "Wallside's Award", description: 'Top voted defender of the Frontier' },
  { key: 'pott', icon: '❄️', base: 'Xavier Frost', description: 'Top voted player of the tournament' },
  { key: 'champion', icon: '🏆', base: 'Inazuma Frontier', description: 'Won the Inazuma Frontier' },
  { key: 'mrInazuma', icon: '🎖️', base: 'Mr Inazuma', description: 'Captain of the Frontier winners' },
] as const;

export type Honour = (typeof HONOURS)[number];
export type HonourKey = Honour['key'];
