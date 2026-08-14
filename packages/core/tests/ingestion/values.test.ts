import { describe, expect, it } from 'vitest';
import {
  discountPercentToBps,
  normalizeConfidence,
  normalizeIsoTimestamp,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseStrictBoolean,
} from '../../src/ingestion/values';

describe('ingestion value normalization', () => {
  it('converts discounts exactly to basis points', () => {
    expect(discountPercentToBps('')).toBe(0);
    expect(discountPercentToBps('18.25')).toBe(1825);
    expect(discountPercentToBps('100')).toBe(10_000);
    expect(() => discountPercentToBps('12.555')).toThrow();
    expect(() => discountPercentToBps('100.01')).toThrow();
  });

  it('validates confidence without floating point conversion', () => {
    expect(normalizeConfidence('0.1234')).toBe('0.1234');
    expect(normalizeConfidence('')).toBeNull();
    expect(() => normalizeConfidence('1.0001')).toThrow();
  });

  it('normalizes only timestamps with explicit valid offsets', () => {
    expect(normalizeIsoTimestamp('2026-08-14T10:30:00+03:00')).toBe(
      '2026-08-14T07:30:00.000Z'
    );
    expect(() => normalizeIsoTimestamp('2026-08-14T10:30:00')).toThrow();
    expect(() => normalizeIsoTimestamp('2026-02-30T10:30:00Z')).toThrow();
  });

  it('normalizes quantities and strict booleans', () => {
    expect(parsePositiveInteger('2')).toBe(2);
    expect(parseNonNegativeInteger('0')).toBe(0);
    expect(parseStrictBoolean(' TRUE ')).toBe(true);
    expect(() => parsePositiveInteger('0')).toThrow();
    expect(() => parseStrictBoolean('yes')).toThrow();
  });
});
