import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const funnelFiles = ['apps/funnels/**/*.{js,jsx,ts,tsx}'];
const workspaceTypeScriptFiles = [
  'apps/**/*.{ts,tsx}',
  'packages/**/*.{ts,tsx}',
];

export default tseslint.config(
  {
    ignores: [
      '**/.astro/**',
      '**/.trigger/**',
      '**/.wrangler/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    ...react.configs.flat.recommended,
    files: funnelFiles,
  },
  {
    ...react.configs.flat['jsx-runtime'],
    files: funnelFiles,
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: funnelFiles,
  },
  eslintConfigPrettier,
  {
    files: workspaceTypeScriptFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: funnelFiles,
    settings: { react: { version: 'detect' } },
  },
);
