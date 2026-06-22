import { describe, expect, test } from 'vitest';
import { formatNickname } from './naming';

describe('formatNickname', () => {
  test('ranked + both positions', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: 'CAM', position2: 'CM', hidePositions: false,
    })).toBe('#3 xJamzehh | CAM/CM');
  });

  test('ranked + no positions shows ??/??', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: null, position2: null, hidePositions: false,
    })).toBe('#3 xJamzehh | ??/??');
  });

  test('ranked + one position shows second as ??', () => {
    expect(formatNickname({
      displayName: 'xJamzehh', rank: 3, provisional: false,
      position1: 'CAM', position2: null, hidePositions: false,
    })).toBe('#3 xJamzehh | CAM/??');
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

  test('rank 1 prefix', () => {
    expect(formatNickname({
      displayName: 'Top', rank: 1, provisional: false,
      position1: 'ST', position2: null, hidePositions: false,
    })).toBe('#1 Top | ST/??');
  });
});
