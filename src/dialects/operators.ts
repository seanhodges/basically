import type { Dialect, EditorKeyword } from './types';

/**
 * A machine's operator set, gathered from the two places a dialect keeps it.
 *
 * Most operators are keyword-table entries, because most machines store them as
 * a token. The rest are declared on {@link Dialect.operators}, because the
 * machine stores them some other way - the Sinclair `↑` and `+` are character
 * codes, the BBC copies its symbolic operators through verbatim, and Microsoft
 * BASIC writes `<=` as two tokens rather than one. Nothing about *how* a machine
 * stores an operator should decide whether the editor colours it or the
 * reference page lists it, so both consumers read the union from here.
 */

/**
 * Punctuation that shares the operator token range on some machines.
 *
 * The ZX80 tokenizes `;`, `,`, `(` and `)` exactly as it tokenizes `+`, and
 * tags them `kind: 'operator'` because that is where the ROM keeps them. They
 * are still punctuation: nothing about a port turns on them, and a reference row
 * for each would be nine pages of rows carrying no information. Named here so
 * the one place that has to make an exception says why.
 */
export const OPERATOR_PUNCTUATION: ReadonlySet<string> = new Set([
  '(',
  ')',
  ',',
  ';',
  ':',
]);

/** The operator-kind entries of a keyword table, canonical spellings only. */
export function keywordOperators(keywords: readonly EditorKeyword[]): string[] {
  return keywords.filter((k) => k.kind === 'operator').map((k) => k.word);
}

/**
 * Every operator spelling this machine has: its keyword-table operators plus the
 * ones it declares because they are stored some other way.
 *
 * Punctuation is included - callers that are documenting rather than
 * highlighting filter it out with {@link OPERATOR_PUNCTUATION}.
 */
export function operatorSpellings(
  dialect: Pick<Dialect, 'keywords' | 'operators'>,
): Set<string> {
  return new Set([
    ...keywordOperators(dialect.keywords),
    ...(dialect.operators ?? []),
  ]);
}
