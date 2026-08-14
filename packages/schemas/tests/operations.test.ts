import { describe, expect, it } from 'vitest';
import { evaluateDatasetSchema } from '../src/operations';

describe('Phase 4 evaluation contract', () => {
  it('accepts an empty request or an explicit-timezone asOf timestamp', () => {
    expect(evaluateDatasetSchema.parse({})).toEqual({});
    expect(evaluateDatasetSchema.parse({ asOf: '2026-08-14T00:00:00Z' }).asOf).toBeDefined();
  });

  it('rejects arbitrary policy inputs and ambiguous timestamps', () => {
    expect(evaluateDatasetSchema.safeParse({ asOf: '2026-08-14T00:00:00' }).success).toBe(false);
    expect(evaluateDatasetSchema.safeParse({ threshold: 10 }).success).toBe(false);
  });
});
