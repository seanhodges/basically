import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * CodeMirror language support for Locomotive BASIC. Stage 1 builds this over
 * `src/editor/basicLanguage.ts` with `suffixChars: '$%!'`, `hexPrefix: '&'`
 * and `binaryPrefix: '&X'`. See docs/contributing/dialect-plans/cpc464.md.
 */
export function cpcLanguageSupport(): Extension {
  throw new Error('cpc464: not implemented');
}

export const cpcCompletionSource: CompletionSource = () => {
  throw new Error('cpc464: not implemented');
};
