import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * TODO (vic20 Stage 1): buildBasicLanguage over the (re-exported C64) keyword
 * table with the same BasicLanguageOptions as the C64.
 * See docs/contributing/dialect-plans/vic20.md.
 */
export function vic20LanguageSupport(): Extension {
  throw new Error('vic20: not implemented (Stage 1)');
}

export const vic20CompletionSource: CompletionSource = () => {
  throw new Error('vic20: not implemented (Stage 1)');
};
