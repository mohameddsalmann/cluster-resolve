import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['node_modules/', '.next/', 'playwright-report/', 'test-results/', 'next-env.d.ts'],
  },
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
];

export default eslintConfig;
