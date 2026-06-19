import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Enforce the domain-hook seam: only files in src/hooks/ may import useAppContext.
  // Pages and components must go through useAuth, useJobs, useBusiness, etc.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/hooks/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '../AppContext',
            importNames: ['useAppContext'],
            message: 'Use a domain hook (useAuth, useJobs, etc.) instead of useAppContext directly.',
          },
          {
            name: './AppContext',
            importNames: ['useAppContext'],
            message: 'Use a domain hook (useAuth, useJobs, etc.) instead of useAppContext directly.',
          },
        ],
      }],
    },
  },
])
