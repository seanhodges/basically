import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { zx80Keywords } from './keywords';

export const zx80CompletionSource: CompletionSource =
  buildCompletionSource(zx80Keywords);

export function zx80LanguageSupport(): Extension {
  return buildBasicLanguage(zx80Keywords, zx80CompletionSource);
}
