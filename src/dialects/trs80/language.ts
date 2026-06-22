import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { trs80Keywords } from './keywords';

// Stage 1 will pass BasicLanguageOptions here (suffixChars '$%!#', no hex/binary
// prefix — Level II has no &H/&B). See docs/dialect-plans/trs80.md.
export const trs80CompletionSource: CompletionSource =
  buildCompletionSource(trs80Keywords);

export function trs80LanguageSupport(): Extension {
  return buildBasicLanguage(trs80Keywords, trs80CompletionSource);
}
