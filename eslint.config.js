import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import noPlanReferences from './eslint-rules/no-plan-references.js';

export default tseslint.config(
  // Vendored / generated / build output - not ours to lint.
  {
    ignores: [
      'dist/**',
      'docs/.vitepress/cache/**',
      'src/emulator/z80/**',
      'src/emulator/6502/**',
      'src/emulator/c64/viciious/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The AudioWorklet processor runs in the worklet global scope, not the DOM -
  // give it the worklet globals so no-undef doesn't fire on them.
  {
    files: ['src/audio/ringBufferProcessor.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        AudioWorkletProcessor: 'readonly',
        registerProcessor: 'readonly',
        sampleRate: 'readonly',
        currentTime: 'readonly',
        currentFrame: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow intentionally-unused args/vars prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // The shared reference tree (src/reference/) is ~12,000 lines of tables that
  // only the AI assistant needs, and only once the user sends something. It is
  // reached through a dynamic import in src/ai/machineReference.ts so it lands
  // in chunks of its own; one static import from anywhere in the app would put
  // the lot back in the initial download, and nothing would fail. So it fails
  // here instead.
  //
  // `import()` is untouched (this rule only sees static imports), as are type
  // imports, which are erased at build. The tree itself is exempt - its modules
  // are each other's siblings - and so are tests, which vitest runs in node.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/reference/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/reference/*', '**/reference/**/*'],
              message:
                'Load the reference data on demand instead: import() it (see src/ai/machineReference.ts), or import only its types.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // Comments describe the code, not the plan that produced it. Per-dialect
  // plans and OpenSpec change folders are deleted once the work ships, so a
  // comment naming one is dead the day the work lands - and half of them
  // described work that never shipped. src/ai and the AI panel are exempt: an
  // apply "plan" is live vocabulary there, not a document.
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    ignores: ['src/ai/**', 'src/components/AiPanel.tsx'],
    plugins: { local: { rules: { 'no-plan-references': noPlanReferences } } },
    rules: { 'local/no-plan-references': 'error' },
  },
  // Keep ESLint out of Prettier's lane (must be last).
  prettier,
);
