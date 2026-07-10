import { describe, expect, it } from 'vitest';
import { normalizePosition, POSITION_BUCKET_LABEL } from './positions';

describe('normalizePosition', () => {
  it('maps the canonical full words to themselves', () => {
    expect(normalizePosition('goalkeeper')).toBe('goalkeeper');
    expect(normalizePosition('defender')).toBe('defender');
    expect(normalizePosition('midfielder')).toBe('midfielder');
    expect(normalizePosition('forward')).toBe('forward');
  });

  it('maps EA short codes to buckets', () => {
    expect(normalizePosition('gk')).toBe('goalkeeper');
    expect(normalizePosition('att')).toBe('forward');
    expect(normalizePosition('mid')).toBe('midfielder');
    expect(normalizePosition('def')).toBe('defender');
  });

  it('maps specific on-pitch positions to their line', () => {
    expect(normalizePosition('cb')).toBe('defender');
    expect(normalizePosition('lwb')).toBe('defender');
    expect(normalizePosition('cdm')).toBe('midfielder');
    expect(normalizePosition('cam')).toBe('midfielder');
    expect(normalizePosition('st')).toBe('forward');
    expect(normalizePosition('lw')).toBe('forward');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizePosition('  GK ')).toBe('goalkeeper');
    expect(normalizePosition('Att')).toBe('forward');
    expect(normalizePosition('DEFENDER')).toBe('defender');
  });

  it('maps numeric EA posIds by line', () => {
    expect(normalizePosition('0')).toBe('goalkeeper');
    expect(normalizePosition('5')).toBe('defender');   // CB
    expect(normalizePosition('14')).toBe('midfielder'); // CM
    expect(normalizePosition('25')).toBe('forward');    // ST
    expect(normalizePosition('99')).toBeNull();
  });

  it('returns null for unknowns and empties', () => {
    expect(normalizePosition(null)).toBeNull();
    expect(normalizePosition(undefined)).toBeNull();
    expect(normalizePosition('')).toBeNull();
    expect(normalizePosition('   ')).toBeNull();
    expect(normalizePosition('bench')).toBeNull();
  });
});

describe('POSITION_BUCKET_LABEL', () => {
  it('labels every bucket', () => {
    expect(POSITION_BUCKET_LABEL.goalkeeper).toBe('GK');
    expect(POSITION_BUCKET_LABEL.defender).toBe('DEF');
    expect(POSITION_BUCKET_LABEL.midfielder).toBe('MID');
    expect(POSITION_BUCKET_LABEL.forward).toBe('FWD');
  });
});
