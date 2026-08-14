import { describe, it, expect } from 'vitest';
import { createDatasetSchema, datasetModeSchema, moneyStringSchema } from '../src/index.js';

describe('@cluster/schemas', () => {
  describe('datasetModeSchema', () => {
    it('accepts valid modes LIVE, IMPORTED_REAL, SAMPLE', () => {
      expect(datasetModeSchema.parse('LIVE')).toBe('LIVE');
      expect(datasetModeSchema.parse('IMPORTED_REAL')).toBe('IMPORTED_REAL');
      expect(datasetModeSchema.parse('SAMPLE')).toBe('SAMPLE');
    });

    it('rejects invalid mode values', () => {
      expect(() => datasetModeSchema.parse('INVALID')).toThrow();
      expect(() => datasetModeSchema.parse('TESTING')).toThrow();
    });
  });

  describe('createDatasetSchema', () => {
    it('validates a correct payload', () => {
      const result = createDatasetSchema.safeParse({
        name: 'Test Dataset',
        mode: 'SAMPLE',
        description: 'Benchmark synthetic data',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createDatasetSchema.safeParse({
        name: '',
        mode: 'SAMPLE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('moneyStringSchema', () => {
    it('accepts valid decimal strings', () => {
      expect(moneyStringSchema.parse('125.50')).toBe('125.50');
      expect(moneyStringSchema.parse('8220.00')).toBe('8220.00');
      expect(moneyStringSchema.parse('0.01')).toBe('0.01');
      expect(moneyStringSchema.parse('100')).toBe('100');
    });

    it('rejects invalid decimal strings or 3+ decimals', () => {
      expect(() => moneyStringSchema.parse('12.555')).toThrow();
      expect(() => moneyStringSchema.parse('abc')).toThrow();
    });
  });
});
