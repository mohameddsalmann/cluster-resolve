import { describe, it, expect } from 'vitest';
import { statusTokens } from '../src/index.js';

describe('@cluster/design-tokens', () => {
  it('exports semantic status colors', () => {
    expect(statusTokens.status.critical).toBe('#dc2626');
  });

  it('exports all expected status levels', () => {
    const keys = Object.keys(statusTokens.status);
    expect(keys).toContain('critical');
    expect(keys).toContain('high');
    expect(keys).toContain('medium');
    expect(keys).toContain('low');
    expect(keys).toContain('ok');
    expect(keys).toContain('neutral');
    expect(keys).toContain('unknown');
  });
});
