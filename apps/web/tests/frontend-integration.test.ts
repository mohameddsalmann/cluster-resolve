import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

describe('Frontend Integration — Zero Mock Guarantee & Architecture', () => {
  it('ensures no production page or component imports from ui-fixtures or fake data', () => {
    const webRoot = resolve(__dirname, '..');
    const appDir = join(webRoot, 'app');
    const compDir = join(webRoot, 'components');
    const libDir = join(webRoot, 'lib');

    const sourceFiles: string[] = [];
    collectFiles(appDir, sourceFiles);
    collectFiles(compDir, sourceFiles);
    collectFiles(libDir, sourceFiles);

    const forbiddenPatterns = [
      'ui-fixtures',
      'demoData',
      'sampleOrders',
      'sampleSuppliers',
      'Math.random()',
    ];

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const file of sourceFiles) {
      if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) continue;
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          violations.push({ file, pattern });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('ensures server-only Supabase secret key is never exposed via NEXT_PUBLIC prefix', () => {
    const webRoot = resolve(__dirname, '..');
    const sourceFiles: string[] = [];
    collectFiles(join(webRoot, 'app'), sourceFiles);
    collectFiles(join(webRoot, 'components'), sourceFiles);
    collectFiles(join(webRoot, 'lib'), sourceFiles);

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('NEXT_PUBLIC_SUPABASE_SECRET_KEY');
      expect(content).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  function collectFiles(dir: string, list: string[]) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        if (entry === 'node_modules' || entry === '.next') continue;
        const stat = statSync(full);
        if (stat.isDirectory()) {
          collectFiles(full, list);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
          list.push(full);
        }
      }
    } catch {
      // directory might not exist yet
    }
  }
});
