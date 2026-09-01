import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/** CodeMirror highlighting and languageData for SAM BASIC. */
export function samcoupeLanguageSupport(): Extension {
  throw new Error('samcoupe: not implemented');
}

/** Keyword and construct autocomplete for SAM BASIC. */
export const samcoupeCompletionSource: CompletionSource = () => {
  throw new Error('samcoupe: not implemented');
};
