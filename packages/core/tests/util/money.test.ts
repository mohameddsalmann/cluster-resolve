import { describe, it, expect } from 'vitest';
import { toPiastres, toEgp, moneyToString, piastresToBigint } from '../../src/util/money.js';

describe('money utilities (exact string-based parsing)', () => {
  describe('toPiastres', () => {
    it('parses valid decimal string EGP values to bigint piastres', () => {
      expect(toPiastres('125.50')).toBe(12550n);
      expect(toPiastres('8220.00')).toBe(822000n);
      expect(toPiastres('0.01')).toBe(1n);
      expect(toPiastres('100')).toBe(10000n);
      expect(toPiastres('0')).toBe(0n);
      expect(toPiastres('0.5')).toBe(50n);
    });

    it('handles negative monetary values if present', () => {
      expect(toPiastres('-125.50')).toBe(-12550n);
      expect(toPiastres('-0.01')).toBe(-1n);
    });

    it('rejects non-string inputs', () => {
      // @ts-expect-error testing invalid input runtime
      expect(() => toPiastres(125.5)).toThrow(/string input/);
    });

    it('rejects malformed string decimals', () => {
      expect(() => toPiastres('12.3.4')).toThrow(/Invalid monetary string/);
      expect(() => toPiastres('abc')).toThrow(/Invalid monetary string/);
      expect(() => toPiastres('')).toThrow(/empty string/);
    });

    it('rejects decimals with precision exceeding 2 decimal places', () => {
      expect(() => toPiastres('12.555')).toThrow(/Invalid monetary string/);
      expect(() => toPiastres('0.001')).toThrow(/Invalid monetary string/);
    });
  });

  describe('toEgp', () => {
    it('formats bigint piastres to EGP decimal string', () => {
      expect(toEgp(12550n)).toBe('125.50');
      expect(toEgp(822000n)).toBe('8220.00');
      expect(toEgp(1n)).toBe('0.01');
      expect(toEgp(0n)).toBe('0.00');
      expect(toEgp(50n)).toBe('0.50');
      expect(toEgp(-12550n)).toBe('-125.50');
    });
  });

  describe('moneyToString & piastresToBigint', () => {
    it('serializes bigint to string', () => {
      expect(moneyToString(12550n)).toBe('12550');
    });

    it('parses string or bigint to BigInt', () => {
      expect(piastresToBigint('12550')).toBe(12550n);
      expect(piastresToBigint(12550n)).toBe(12550n);
    });
  });
});
