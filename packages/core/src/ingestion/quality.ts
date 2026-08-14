export type CoverageState = 'AVAILABLE' | 'PARTIAL' | 'INSUFFICIENT_DATA';

export interface CoverageRatio {
  numerator: number;
  denominator: number;
  percentage: string | null;
  state: CoverageState;
}

export function calculateCoverage(numerator: number, denominator: number): CoverageRatio {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error('Coverage counts must be integers.');
  }
  if (numerator < 0 || denominator < 0 || numerator > denominator) {
    throw new Error('Coverage counts are out of range.');
  }
  if (denominator === 0) {
    return { numerator, denominator, percentage: null, state: 'INSUFFICIENT_DATA' };
  }

  const basisPoints = (BigInt(numerator) * 10_000n) / BigInt(denominator);
  const whole = basisPoints / 100n;
  const fraction = (basisPoints % 100n).toString().padStart(2, '0');
  return {
    numerator,
    denominator,
    percentage: `${whole}.${fraction}`,
    state: numerator === denominator ? 'AVAILABLE' : 'PARTIAL',
  };
}
