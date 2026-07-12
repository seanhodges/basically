import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * TODO (pet Stage 1): buildBasicLanguage over petKeywords with the same
 * BasicLanguageOptions as the C64. See docs/contributing/dialect-plans/pet.md.
 */
export function petLanguageSupport(): Extension {
  throw new Error('pet: not implemented (Stage 1)');
}

export const petCompletionSource: CompletionSource = () => {
  throw new Error('pet: not implemented (Stage 1)');
};
