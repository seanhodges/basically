import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { bbcKeywords } from './keywords';

export const bbcCompletionSource: CompletionSource = buildCompletionSource(
  bbcKeywords,
  constructsByDialect.bbcmicro,
);

export function bbcLanguageSupport(): Extension {
  // BBC variable names may contain '_' and end in '%' (integer) or '$' (string);
  // '%'/'\' are not block-graphics escapes here.
  return buildBasicLanguage(bbcKeywords, bbcCompletionSource, {
    nameChars: '_',
    suffixChars: '$%',
    graphicsEscapes: false,
    hexPrefix: '&',
    binaryPrefix: '%',
  });
}
