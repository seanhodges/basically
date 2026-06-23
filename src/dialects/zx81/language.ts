import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { zx81Keywords } from './keywords';

export const zx81CompletionSource: CompletionSource = buildCompletionSource(
  zx81Keywords,
  constructsByDialect.zx81,
);

export function zx81LanguageSupport(): Extension {
  return buildBasicLanguage(zx81Keywords, zx81CompletionSource);
}
