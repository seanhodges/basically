import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { zx80EditorKeywords } from './keywords';

export const zx80CompletionSource: CompletionSource = buildCompletionSource(
  zx80EditorKeywords,
  constructsByDialect.zx80,
);

export function zx80LanguageSupport(): Extension {
  return buildBasicLanguage(zx80EditorKeywords, zx80CompletionSource);
}
