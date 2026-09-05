import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { foldsKeywordCase } from '../letterCase';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import type { EditorKeyword } from '../types';
import { bbcKeywords, bbcMasterKeywords, bbcOperators } from './keywords';

export const bbcCompletionSource: CompletionSource = buildCompletionSource(
  bbcKeywords,
  constructsByDialect.bbcmicro,
);

export const bbcMasterCompletionSource: CompletionSource =
  buildCompletionSource(bbcMasterKeywords, constructsByDialect.bbcmaster);

/**
 * The two Acorn machines share every lexical rule and differ only in their
 * keyword table: BASIC IV has words the Micro never had. Each therefore takes
 * its own table and its own dotted-spelling order. A prefix reaches the first
 * keyword its ROM scans that begins with it, so reading a Master listing
 * against the Micro's order would expand its abbreviations to the wrong
 * commands - and highlighting it against the Micro's table would draw the
 * Master's own keywords as variable names.
 */
function acornLanguageSupport(
  dialectId: string,
  keywords: EditorKeyword[],
  completionSource: CompletionSource,
): Extension {
  // BBC variable names may contain '_' and end in '%' (integer) or '$' (string);
  // '%'/'\' are not block-graphics escapes here.
  return buildBasicLanguage(keywords, completionSource, {
    spellings: keywordSpellingsFor(dialectId),
    // The one family here that matches its keyword table byte for byte, so
    // `print` is a variable name and `p.` is a name and a full stop.
    foldsKeywordCase: foldsKeywordCase(dialectId),
    operators: bbcOperators,
    nameChars: '_',
    suffixChars: '$%',
    graphicsEscapes: false,
    hexPrefix: '&',
    binaryPrefix: '%',
  });
}

export function bbcLanguageSupport(): Extension {
  return acornLanguageSupport('bbcmicro', bbcKeywords, bbcCompletionSource);
}

export function bbcMasterLanguageSupport(): Extension {
  return acornLanguageSupport(
    'bbcmaster',
    bbcMasterKeywords,
    bbcMasterCompletionSource,
  );
}
