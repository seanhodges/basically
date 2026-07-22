import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { cpc464Keywords } from './keywords';

export const cpcCompletionSource: CompletionSource = buildCompletionSource(
  cpc464Keywords,
  constructsByDialect.cpc464,
);

export function cpcLanguageSupport(): Extension {
  // Locomotive variable names take '%' (integer), '!' (real) or '$' (string)
  // suffixes; hex literals are '&7F00' and binary '&X101'. '%'/'\' are not
  // graphics escapes here.
  return buildBasicLanguage(cpc464Keywords, cpcCompletionSource, {
    suffixChars: '$%!',
    graphicsEscapes: false,
    hexPrefix: '&H?',
    binaryPrefix: '&X',
  });
}
