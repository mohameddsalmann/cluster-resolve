import { describe, it, expect } from 'vitest';
import { brandTokens } from '../src/index.js';

describe('@cluster/design-tokens', () => {
  it('exports brand color tokens', () => {
    expect(brandTokens.color.brand[500]).toBe('#14b8a6');
  });

  it('exports status colors', () => {
    expect(brandTokens.color.status.critical).toBe('#dc2626');
  });
});
