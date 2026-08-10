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
    alias: {
      '@': resolve(__dirname, '.'),
      '@cluster/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@cluster/schemas': resolve(__dirname, '../../packages/schemas/src/index.ts'),
      '@cluster/design-tokens': resolve(__dirname, '../../packages/design-tokens/src/index.ts'),
    },
  },
});
