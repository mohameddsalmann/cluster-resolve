import { describe, it, expect } from 'vitest';
import { CONFIG_VERSION, forbiddenPhrases } from '../src/index.js';

describe('@cluster/config', () => {
  it('exports a version', () => {
    expect(CONFIG_VERSION).toBe('0.0.0');
  });

  it('exports forbidden phrases array', () => {
    expect(forbiddenPhrases.length).toBeGreaterThan(0);
    expect(forbiddenPhrases).toContain('Cluster production');
  });
});
