import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

// Automatically load .env.local for integration tests against hosted Supabase
const envLocalPath = resolve(__dirname, '.env.local');
if (existsSync(envLocalPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envLocalPath);
    } else {
      loadEnvFileSimple(envLocalPath);
    }
  } catch {
    loadEnvFileSimple(envLocalPath);
  }
}

function loadEnvFileSimple(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: [
      { find: /^@cluster\/core\/(.+)$/, replacement: `${resolve(__dirname, '../../packages/core/src')}/$1` },
      { find: /^@cluster\/schemas\/(.+)$/, replacement: `${resolve(__dirname, '../../packages/schemas/src')}/$1` },
      { find: '@cluster/core', replacement: resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@cluster/schemas', replacement: resolve(__dirname, '../../packages/schemas/src/index.ts') },
      { find: '@cluster/design-tokens', replacement: resolve(__dirname, '../../packages/design-tokens/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, '.') },
    ],
  },
});
