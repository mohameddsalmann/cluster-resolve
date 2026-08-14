import { describe, expect, it } from 'vitest';
import { calculateCoverage } from '../../src/ingestion/quality';

describe('quality coverage', () => {
  it('distinguishes no denominator from a measured zero percent', () => {
    expect(calculateCoverage(0, 0)).toEqual({
      numerator: 0,
      denominator: 0,
      percentage: null,
      state: 'INSUFFICIENT_DATA',
    });
    expect(calculateCoverage(0, 4)).toEqual({
      numerator: 0,
      denominator: 4,
      percentage: '0.00',
      state: 'PARTIAL',
    });
  });

  it('uses deterministic fixed-precision percentages', () => {
    expect(calculateCoverage(1, 3).percentage).toBe('33.33');
    expect(calculateCoverage(3, 3).state).toBe('AVAILABLE');
  });
});
