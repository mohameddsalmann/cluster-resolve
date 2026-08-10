import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'coverage/'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
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
);
