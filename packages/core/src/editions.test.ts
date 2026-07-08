import { describe, expect, test } from 'vitest';
import { HONOURS, isRomanNumeral, parseEdition, toRoman } from './editions';

describe('toRoman', () => {
  test('formats the canonical cases', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(14)).toBe('XIV');
    expect(toRoman(17)).toBe('XVII');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(49)).toBe('XLIX');
    expect(toRoman(50)).toBe('L');
    expect(toRoman(90)).toBe('XC');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });

  test('rejects out-of-range and non-integer input', () => {
    expect(() => toRoman(0)).toThrow(RangeError);
    expect(() => toRoman(-1)).toThrow(RangeError);
    expect(() => toRoman(1.5)).toThrow(RangeError);
    expect(() => toRoman(4000)).toThrow(RangeError);
  });
});

describe('isRomanNumeral', () => {
  test('accepts canonical numerals, any case', () => {
    expect(isRomanNumeral('XVII')).toBe(true);
    expect(isRomanNumeral('xvii')).toBe(true);
    expect(isRomanNumeral('IV')).toBe(true);
    expect(isRomanNumeral('MMMCMXCIX')).toBe(true);
  });

  test('rejects sloppy or non-roman forms', () => {
    expect(isRomanNumeral('IIII')).toBe(false); // 4 is IV
    expect(isRomanNumeral('VX')).toBe(false);
    expect(isRomanNumeral('17')).toBe(false);
    expect(isRomanNumeral('')).toBe(false);
    expect(isRomanNumeral('XVIIa')).toBe(false);
  });
});

describe('parseEdition', () => {
  test('reads a trailing numeral off the tournament name', () => {
    expect(parseEdition('Frontier XVII')).toEqual({ edition: 17, numeral: 'XVII' });
    expect(parseEdition('Inazuma Frontier IV')).toEqual({ edition: 4, numeral: 'IV' });
    expect(parseEdition('frontier xvii')).toEqual({ edition: 17, numeral: 'XVII' });
    expect(parseEdition('Frontier XVII  ')).toEqual({ edition: 17, numeral: 'XVII' });
  });

  test('null when the name has no valid trailing numeral', () => {
    expect(parseEdition('Frontier')).toBeNull();
    expect(parseEdition('Frontier 17')).toBeNull();
    expect(parseEdition('Frontier IIII')).toBeNull(); // strict — sloppy roman rejected
    expect(parseEdition('XII')).toBeNull(); // bare numeral: no preceding word to be an edition OF
  });

  test('known quirk: a real word that is also a numeral parses ("Mix" → MIX)', () => {
    // Acceptable — the ceremony page's numeral field is editable.
    expect(parseEdition('Frontier Mix')).toEqual({ edition: 1009, numeral: 'MIX' });
  });
});

describe('HONOURS', () => {
  test('carries the league honours in ceremony order', () => {
    expect(HONOURS.map(h => h.base)).toEqual([
      "Blaze's Boot", "Sharp's Award", "Evan's Golden Glove",
      "Wallside's Award", 'Xavier Frost', 'Inazuma Frontier', 'Mr Inazuma',
      'Team of the Tournament',
    ]);
  });
});
