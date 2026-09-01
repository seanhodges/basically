// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a variable name looks like on each machine, stated once.
 *
 * Three consumers need this and none of them can ask the `Dialect` for it: the
 * highlighter and completion bake it into `languageSupport()` per dialect
 * (`src/dialects/<id>/language.ts`), the variable lint next door needs it to
 * recognise a name at all, and the porting guide's program analyser
 * (`src/app/programVocabulary.ts`) needs it to report the names a program uses.
 * The lint used to spell its half out per family, which is two places for one
 * rule; this is the one.
 *
 * Only the fields that decide what a *name* is: the extra characters a name may
 * contain, the type markers that end one, the literal prefix whose digits must
 * not be read as a name, and whether the ROM crunches. `graphicsEscapes`,
 * `binaryPrefix` and `extraOperators` stay in each dialect's `language.ts` -
 * they style tokens rather than delimit names.
 *
 * `variableLexis.test.ts` requires an entry per registered machine, so the
 * omission that would read a BBC `MY_NAME` as two names fails the build.
 */
import type { EditorKeyword } from '../dialects/types';
import { keywordSpellingsFor } from '../dialects/keywordSpellings';
import {
  distinguishesNameCase,
  foldsKeywordCase,
} from '../dialects/letterCase';
import {
  buildIdentifierRegexes,
  type BasicLanguageOptions,
} from './basicLanguage';
import { makeCrunchMatcher } from './crunch';
import type { VarNameRules } from './variables';

/**
 * The name lexis, plus the two ROM facts about names that `BasicLanguageOptions`
 * has no business carrying (it is the highlighter's type, shared with every
 * dialect's `language.ts`).
 */
export interface VariableLexis extends BasicLanguageOptions {
  /**
   * How many of a name's characters the ROM actually keeps, when it keeps only
   * some. Microsoft BASIC stores two, so `SCORE` and `SCOTT` are one variable in
   * RAM; everything else stores the name in full. Unset means fully significant.
   *
   * Not derivable from `crunched`, though the machines coincide today: eating
   * spaces and truncating names are separate ROM behaviours, and a machine with
   * one and not the other would silently get the wrong answer.
   */
  significantChars?: number;
  /**
   * Whether the ROM tells `A` from `a`. Filled in from
   * {@link ../dialects/letterCase} rather than authored here: the same fact
   * decides what the highlighter colours, what the porting comparison reports
   * and what a screen read says, and two of those used to answer it
   * differently. The field stays because it is the variable scanner's input
   * shape; only its authoring moved.
   */
  caseSensitive?: boolean;
  /**
   * Whether READ takes a DATA item literally instead of evaluating it, which
   * decides whether a word inside DATA is a variable at all.
   *
   * Verified against the ROMs, because the families disagree: on a BBC and on a
   * CPC, `10 a=7:DATA a` READs the *string* "a", so DATA holds values and its
   * words are not names. On a Spectrum the item is an expression - the same
   * program READs 7, `DATA a*2` READs 14, and an undefined word stops with
   * "Variable not found" - so Sinclair DATA words are real variable usages.
   */
  dataIsVerbatim?: boolean;
}

/**
 * BASIC-G's lexis: the Microsoft rules it shares with the Altair, plus this
 * machine's own `'FF` hex literal, whose digits must not be read as a variable
 * name. Named rather than written inline so its one deviation has somewhere to
 * be explained.
 *
 * Case is where it leaves the family, and it is the BBC's company it keeps
 * rather than the Altair's: BASIC-G stores a name as typed and compares the
 * bytes, so `10 A=1:a=2` really is two variables and prints 1 and 2. That fact
 * is declared with the machine's other case facts, not here - see
 * {@link lexisFor}.
 */
const PMD85_LEXIS: VariableLexis = {
  suffixChars: '$',
  hexPrefix: "'",
  crunched: true,
  significantChars: 2,
  dataIsVerbatim: true,
};

/**
 * Integer BASIC's lexis. Its names are one letter and at most one digit - `A1` is a variable, `AB` and
 * `A12` are syntax errors - so both significant characters are always written
 * out and `significantChars` has nothing to truncate. `$` is the only marker,
 * and the ROM crunches: it skips spaces everywhere outside a string literal and
 * a REM body.
 */
const APPLE1_LEXIS: VariableLexis = { suffixChars: '$', crunched: true };

/**
 * SAM BASIC's lexis. `NAMTOBUF` in the ROM's lookvar.asm takes a first letter
 * then letters, digits and `_`, folds the name to lower case and skips spaces
 * inside it, so `hi score` and `hiscore` are one variable; `$` is the only type
 * marker, there being no integer type; and `&FF` is a hex literal whose letters
 * are not a name. Names are fully significant, so nothing truncates - a string
 * or array name longer than ten characters is rejected outright rather than
 * shortened, which is a lint rule and not a lexis one.
 *
 * Not in {@link VARIABLE_LEXIS}: that table names exactly the registered
 * machines, and this one is not registered yet.
 */
export const SAMCOUPE_LEXIS: VariableLexis = {
  nameChars: '_',
  suffixChars: '$',
  hexPrefix: '&',
};

/**
 * Dialect id → its name lexis. `{}` is a statement, not an omission: the
 * Sinclair machines take the defaults (`$` the only marker, no extra name
 * characters, no hex prefix, no crunching, and DATA items that are expressions).
 */
export const VARIABLE_LEXIS: Record<string, VariableLexis> = {
  zx80: {},
  zx81: {},
  zxspectrum: {},
  zxspectrum128: {},
  // `_` is a name character here, and `&FF` a hex literal whose letters are not.
  bbcmicro: {
    nameChars: '_',
    suffixChars: '$%',
    hexPrefix: '&',
    dataIsVerbatim: true,
  },
  bbcmaster: {
    nameChars: '_',
    suffixChars: '$%',
    hexPrefix: '&',
    dataIsVerbatim: true,
  },
  // No markers at all: `$` is a prefix operator (`$addr`), and `#` opens a hex
  // literal where the other Acorn machine uses `&`.
  atom: { suffixChars: '', hexPrefix: '#' },
  commodore64: {
    suffixChars: '$%',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  pet: {
    suffixChars: '$%',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  vic20: {
    suffixChars: '$%',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  trs80: {
    suffixChars: '$%!#',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  // 8K BASIC predates the `%`/`!`/`#` type tags, so `$` is the only marker.
  altair8800: {
    suffixChars: '$',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  cpc464: { suffixChars: '$%!', hexPrefix: '&H?', dataIsVerbatim: true },
  cpc664: { suffixChars: '$%!', hexPrefix: '&H?', dataIsVerbatim: true },
  cpc6128: { suffixChars: '$%!', hexPrefix: '&H?', dataIsVerbatim: true },
  pmd85: PMD85_LEXIS,
  apple1: APPLE1_LEXIS,
  // The Apple II keeps a name in full - `LONGVARIABLENAME=1` stores every
  // character - so nothing truncates. `$` is the only marker, there being no
  // second numeric type, and the entry parser skips spaces outside a string.
  apple2: { suffixChars: '$', crunched: true },
  // Applesoft is a Microsoft BASIC, so a name is two significant characters and
  // `%` marks an integer beside `$` for a string. Spaces are crunched out and
  // DATA keeps its items verbatim, both as on the rest of the family.
  apple2plus: {
    suffixChars: '$%',
    crunched: true,
    significantChars: 2,
    dataIsVerbatim: true,
  },
  // Names are fully significant and the ROM ignores spaces everywhere outside
  // a string literal (`atariCrunched` in `dialects/atari800/language.ts`);
  // `$` is the only type marker, there being no `%` integer suffix. REM and
  // DATA keep their text verbatim - confirmed by the tokenizer's own
  // `ATARI_VERBATIM` and pinned against the ROM in `tokenizerRom.test.ts`.
  atari800: { suffixChars: '$', crunched: true, dataIsVerbatim: true },
  atari400: { suffixChars: '$', crunched: true, dataIsVerbatim: true },
};

/**
 * Build the variable scanner's rules from a lexis and the keyword table.
 *
 * `spellings` rides on the lexis so the scanner and the highlighter take it
 * from one place; {@link variableRulesFor} fills it in from the dialect id,
 * which is how every caller inside the app reaches this.
 */
export function variableRules(
  options: VariableLexis,
  keywords: EditorKeyword[],
): VarNameRules {
  const { headRe, varRe } = buildIdentifierRegexes(options);
  const words = keywords
    .filter((k) => /^[A-Z]/.test(k.word))
    .map((k) => k.word);
  const set = new Set(words);
  return {
    headRe,
    varRe,
    keywords: set,
    maxWordLen: words.length ? Math.max(...words.map((w) => w.length)) : 0,
    hexRe: options.hexPrefix
      ? new RegExp(`^${options.hexPrefix}[0-9A-Fa-f]+`)
      : null,
    callPrefixes: ['PROC', 'FN'].filter((w) => set.has(w)),
    crunch: options.crunched ? makeCrunchMatcher(set) : null,
    dataIsVerbatim: options.dataIsVerbatim ?? false,
    spellings: options.spellings ?? null,
    foldsKeywordCase: options.foldsKeywordCase ?? true,
  };
}

/**
 * The full lexis for a registered machine: what {@link VARIABLE_LEXIS} authors,
 * plus the two case facts filled in from {@link ../dialects/letterCase}.
 *
 * This is the derivation boundary. Case is declared once, beside the machine's
 * other ROM facts, and every consumer of a lexis - the scanner, the lint, the
 * usages view, the program vocabulary - takes it from here, so no two of them
 * can answer the same question differently.
 *
 * An unknown id falls back to the defaults rather than throwing: the caller may
 * be the program analyser behind a docs drawer that is a build behind, and
 * reading a name as a Sinclair would beats reading none at all.
 */
export function lexisFor(dialectId: string): VariableLexis {
  return {
    ...(VARIABLE_LEXIS[dialectId] ?? {}),
    caseSensitive: distinguishesNameCase(dialectId),
    foldsKeywordCase: foldsKeywordCase(dialectId),
  };
}

/** The scanner's rules for a registered machine. */
export function variableRulesFor(
  dialectId: string,
  keywords: EditorKeyword[],
): VarNameRules {
  return variableRules(
    { ...lexisFor(dialectId), spellings: keywordSpellingsFor(dialectId) },
    keywords,
  );
}
