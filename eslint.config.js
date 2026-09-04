import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import noPlanReferences from './eslint-rules/no-plan-references.js';
import noVagueUiLabels from './eslint-rules/no-vague-ui-labels.js';

// The project's own rules share one plugin namespace, which a flat config may
// define only once; the blocks below scope them to the files they govern.
const local = {
  rules: {
    'no-plan-references': noPlanReferences,
    'no-vague-ui-labels': noVagueUiLabels,
  },
};

export default tseslint.config(
  // Vendored / generated / build output - not ours to lint.
  {
    ignores: [
      '**/dist/**',
      'docs/.vitepress/cache/**',
      'src/emulator/z80/**',
      'src/emulator/6502/**',
      'src/emulator/c64/viciious/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  { plugins: { local } },
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
  // The shared reference tree (src/reference/) is tens of thousands of lines of tables that
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
  // The operation layer (src/ops/) is shared by the command line and the
  // assistant, so it may import neither the filesystem nor the DOM nor the
  // store: the command line has no store and the browser has no filesystem,
  // and one static import from either would put the layer out of reach of the
  // other caller - or drag node into the browser bundle - and nothing would
  // fail. So it fails here instead. What an operation needs from either world
  // arrives through its context (src/ops/types.ts). Type imports are erased at
  // build and are allowed; tests run in node and are exempt.
  {
    files: ['src/ops/**/*.{ts,tsx}'],
    ignores: ['src/ops/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            'fs',
            'path',
            'os',
            'zlib',
            'url',
            'module',
            'child_process',
          ].map((name) => ({
            name,
            message:
              'src/ops/ imports nothing of node; take it from the context.',
          })),
          patterns: [
            {
              group: ['node:*'],
              message:
                'src/ops/ imports nothing of node; take it from the context (src/ops/types.ts).',
              allowTypeImports: true,
            },
            {
              group: ['**/app/store', '**/app/store.ts', '**/storage/settings'],
              message:
                'src/ops/ never reaches the store: a session or the context carries what an operation needs.',
              allowTypeImports: true,
            },
            {
              group: [
                '**/dialects/headless/runListing',
                '**/dialects/headless/headlessCanvas',
                '**/dialects/bootHarness',
                '**/cli/*',
                '**/components/*',
              ],
              message:
                'That module reaches node or the DOM; src/ops/ takes what it needs from the context.',
              allowTypeImports: true,
            },
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
    rules: { 'local/no-plan-references': 'error' },
  },
  // A control's label says what activating it does, in one voice, and does not
  // state a keyboard binding or a set of machines it doesn't read at runtime.
  // The virtual keyboard is exempt: a keycap is labelled with the key it
  // produces, which is specced behaviour, not a tooltip written by hand.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/keyboard/**'],
    rules: { 'local/no-vague-ui-labels': 'error' },
  },
  // Keep ESLint out of Prettier's lane (must be last).
  prettier,
);
