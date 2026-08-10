import { describe, it, expect } from 'vitest';
import { healthResponseSchema } from '../src/index.js';

describe('@cluster/schemas', () => {
  it('healthResponseSchema validates a correct payload', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', version: '0.0.0' });
    expect(result.success).toBe(true);
  });

  it('healthResponseSchema rejects an invalid status', () => {
    const result = healthResponseSchema.safeParse({ status: 'down', version: '0.0.0' });
    expect(result.success).toBe(false);
  });
});
