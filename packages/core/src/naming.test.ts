import { describe, expect, test } from 'vitest';
import { cleanDisplayName, formatNickname } from './naming';

describe('formatNickname', () => {
  test('ranked + both positions', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: 'CAM', position2: 'CM', hidePositions: false,
    })).toBe('#3 xJamzehh | CAM/CM');
  });

  test('ranked + no positions omits the suffix entirely', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: null, position2: null, hidePositions: false,
    })).toBe('#3 xJamzehh');
  });

  test('one position shows alone — no /??', () => {
    expect(formatNickname({
      displayName: 'lolypopper', rank: 3, provisional: false,
      position1: 'CB', position2: null, hidePositions: false,
    })).toBe('#3 lolypopper | CB');
  });

  test('only a secondary position still shows alone', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: null, position2: 'CM', hidePositions: false,
    })).toBe('#3 xJamzehh | CM');
  });

  test('provisional — no rank prefix, positions shown', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: null, provisional: true,
      position1: 'CAM', position2: 'CM', hidePositions: false,
    })).toBe('xJamzehh | CAM/CM');
  });

  test('hidePositions — no positions suffix regardless of values', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: 'CAM', position2: 'CM', hidePositions: true,
    })).toBe('#3 xJamzehh');
  });

  test('hidePositions + provisional — just the name', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: null, provisional: true,
      position1: 'CAM', position2: 'CM', hidePositions: true,
    })).toBe('xJamzehh');
  });

  test('truncates to 32 chars', () => {
    const result = formatNickname({
      displayName: 'AVeryLongDisplayNameThatGoesOver', rank: 1, provisional: false,
      position1: 'GK', position2: 'CB', hidePositions: false,
    });
    expect(result.length).toBeLessThanOrEqual(32);
  });

  test('never returns empty string when displayName is empty', () => {
    expect(formatNickname({
      displayName: '', rank: null, provisional: true,
      position1: null, position2: null, hidePositions: true,
    })).toBe('Player');
  });

  test('rank 1 prefix with a single position', () => {
    expect(formatNickname({
      displayName: 'Top', rank: 1, provisional: false,
      position1: 'ST', position2: null, hidePositions: false,
    })).toBe('#1 Top | ST');
  });
});

describe('cleanDisplayName', () => {
  test('folds fancy Unicode letters to plain text (the HashMean case)', () => {
    expect(cleanDisplayName('𝐇𝐚𝐬𝐡𝐌𝐞𝐚𝐧')).toBe('HashMean');
    expect(cleanDisplayName('𝓢𝓽𝓸𝓻𝓶')).toBe('Storm');
    expect(cleanDisplayName('Ⓗⓐⓢⓗ')).toBe('Hash');
  });

  test('strips emoji, flags and pictographs', () => {
    expect(cleanDisplayName('YOGOOO🇳🇱')).toBe('YOGOOO');
    expect(cleanDisplayName('⚡Storm⚡')).toBe('Storm');
    expect(cleanDisplayName('kez 🔥🔥')).toBe('kez');
    expect(cleanDisplayName('Robin 🏆#18')).toBe('Robin #18');
  });

  test('strips zero-width and directional characters', () => {
    expect(cleanDisplayName('Ha​sh‍Mean')).toBe('HashMean');
  });

  test('keeps accented letters and non-latin scripts', () => {
    expect(cleanDisplayName('José')).toBe('José');
    expect(cleanDisplayName('Mbappé')).toBe('Mbappé');
  });

  test('collapses whitespace', () => {
    expect(cleanDisplayName('  Warrior   soldier  ')).toBe('Warrior soldier');
  });

  test('falls back when nothing legible is left', () => {
    expect(cleanDisplayName('😀😀😀')).toBe('Player');
    expect(cleanDisplayName('🔥⚡', 'warrior08')).toBe('warrior08');
    expect(cleanDisplayName('')).toBe('Player');
  });
});
