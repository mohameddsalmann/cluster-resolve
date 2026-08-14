import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

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
