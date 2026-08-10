import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/', '.next/', 'playwright-report/', 'test-results/', 'next-env.d.ts'],
  },
  {
    rules: {
      // No empty catch blocks (observability rule)
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
  {
    // packages/core purity boundary — enforced when core is imported
    files: ['**/packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'postgres', message: 'packages/core must not import I/O modules' },
            { name: 'next', message: 'packages/core must not import I/O modules' },
            { name: '@supabase/supabase-js', message: 'packages/core must not import I/O modules' },
            { name: 'fs', message: 'packages/core must not import I/O modules' },
            { name: 'http', message: 'packages/core must not import I/O modules' },
            { name: 'https', message: 'packages/core must not import I/O modules' },
          ],
          patterns: ['db/*', 'http/*', 'next/*'],
        },
      ],
    },
  },
];

export default eslintConfig;
