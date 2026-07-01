import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Minimal, non-type-checked flat config. Type safety for Sol Odyssey is covered
// by `npm run typecheck` (tsc); ESLint here catches lint-level bugs across every
// React app (legacy JSX + strict TS alike).
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Allow underscore-prefixed throwaways (unused params, ignored catch
      // bindings) — a deliberate idiom across these apps, not dead code.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Empty `catch (_) {}` is the intentional "degrade silently" pattern here.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // These apps use `any` sparingly at untyped boundaries; strict typing for
      // Sol Odyssey is enforced by `npm run typecheck`, not here.
      '@typescript-eslint/no-explicit-any': 'off',

      // react-hooks v7 ships several new, opinionated rules that flag legitimate
      // patterns in the design-locked legacy apps (see LEGACY.md — bugfixes
      // only). Keep the high-value correctness rules on; quiet the stylistic
      // ones rather than churn locked code.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
    },
  },
)
