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
  {
    // SQL template literal restriction — only in db repository files
    files: ['lib/db/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TemplateLiteral[tag.name!='sql']",
          message:
            'Template literals are not allowed for SQL. Use the `sql` tagged template from lib/db instead.',
        },
      ],
    },
  },
];

export default eslintConfig;
