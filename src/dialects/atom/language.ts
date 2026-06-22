import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { atomKeywords } from './keywords';

/**
 * Generic CodeMirror language support, driven by the (currently empty) Atom
 * keyword table. STUB — Stage 1 sets the real `BasicLanguageOptions` quirks
 * (hex prefix, indirection operators, dot-abbreviation, etc.).
 */
export const atomCompletionSource: CompletionSource =
  buildCompletionSource(atomKeywords);

export function atomLanguageSupport(): Extension {
  return buildBasicLanguage(atomKeywords, atomCompletionSource, {});
}
