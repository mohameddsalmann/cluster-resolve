import { describe, it, expect } from 'vitest';
import { normalizeName } from '../../src/util/normalize.js';

describe('normalizeName', () => {
  it('lowercases English strings and collapses extra spaces', () => {
    expect(normalizeName('  PANADOL   EXTRA  ')).toBe('panadol extra');
  });

  it('strips Arabic tashkeel (diacritics)', () => {
    expect(normalizeName('بَانَادُولْ')).toBe('بانادول');
  });

  it('normalizes Alef variants to simple Alef', () => {
    expect(normalizeName('أحمد إبراهيم آمال')).toBe('احمد ابراهيم امال');
  });

  it('normalizes Alef Maksura to Yeh and Teh Marbuta to Heh', () => {
    expect(normalizeName('مستشفى الصيدلية')).toBe('مستشفي الصيدليه');
  });

  it('handles null / undefined / empty string safely', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('')).toBe('');
  });
});
