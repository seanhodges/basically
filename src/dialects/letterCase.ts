// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What each machine makes of letter case, stated as facts about its ROM.
 *
 * "Does this machine have lower case?" is not one question. It is four
 * independent facts, and the registered machines cover every combination of
 * them:
 *
 *  - {@link LetterCaseFacts.lowerCase} - whether the character generator can
 *    draw a lower-case shape at all, and whether the shapes it has belong to a
 *    second set the machine switches to at run time;
 *  - {@link LetterCaseFacts.keywordScan} - what the ROM makes of a keyword
 *    spelled in lower case;
 *  - {@link LetterCaseFacts.nameCase} - whether the ROM tells `A` from `a` in a
 *    variable name;
 *  - {@link LetterCaseFacts.encoding} - what the machine's own text encoding
 *    does with a lower-case letter.
 *
 * The last is stated rather than derived from the first, because the two
 * disagree: the Commodores *have* lower-case shapes and still fold, since one
 * stored character draws either case depending on the set in force. A rule with
 * an exception is not a rule.
 *
 * Keyed by dialect id rather than taking a `Dialect`, for the reason
 * {@link ./keywordSpellings} states: the documentation bundle renders the
 * reference pages without a registry, so these tables must be reachable without
 * constructing one. Every consumer here either holds the id already or *is* the
 * dialect's own file.
 *
 * `letterCase.test.ts` requires an entry per registered machine and pins each
 * declaration against the machine's own charset, lint and glyph sources, so a
 * table that stops matching the code fails rather than merely disagreeing.
 */

/** Whether the character generator can draw lower case, and how it is reached. */
export type LowerCaseGlyphs =
  /** No lower-case shape anywhere: the machine draws capitals whatever it stores. */
  | 'none'
  /** Lower case is always available, beside upper case in one set. */
  | 'always'
  /** Lower case lives in a second character set the machine switches to. */
  | 'switched';

/**
 * What the machine makes of a keyword spelled in lower case.
 *
 * `upper-only` means the ROM's scan compares characters against an upper-case
 * table *and* a lower-case letter can reach that scan, so a lower-case spelling
 * is not the keyword there - it is a name, and the program will not do what its
 * author meant.
 *
 * `folded` means a lower-case spelling still ends up as the keyword. Three
 * different machines arrive there: the ROM folds before comparing (the
 * Microsoft family, Locomotive BASIC); no comparison happens at all, because a
 * keyword is a keypress carrying its own token (the Sinclairs); or no
 * lower-case letter can be put in front of the scan in the first place, the
 * machine having no lower-case key (the ASR-33 teletype, the stock Model I).
 * Each machine's note below says which.
 */
export type KeywordCaseScan = 'folded' | 'upper-only';

/** Whether the ROM tells `A` from `a` when it identifies a variable. */
export type NameCase = 'sensitive' | 'folded';

/** What the machine's own text encoding does with a lower-case letter. */
export type SourceEncoding =
  /** Stored as the upper-case character; the two cases are one character. */
  | 'folded'
  /** Stored as its own character, and listed back in the case it was written. */
  | 'preserved';

/** One machine's letter-case facts. */
export interface LetterCaseFacts {
  lowerCase: LowerCaseGlyphs;
  keywordScan: KeywordCaseScan;
  nameCase: NameCase;
  encoding: SourceEncoding;
  /**
   * Set where the dialect's own tokenizer deliberately accepts a lower-case
   * keyword its ROM would refuse, so a listing written in lower case can be
   * pasted in and read. The ROM fact above stays the ROM's; this records the
   * dialect's choice, and the reader is still told the machine will not run it.
   */
  lenient?: true;
  /** Why these four values, on this machine. */
  note: string;
}

/**
 * Dialect id -> its letter-case facts. One entry per registered machine.
 *
 * Derived from each machine's ROM and from the evidence already in the repo -
 * the dialect's own charset, its tokenizer's keyword match, its variable lexis
 * and its glyph sources - never from memory. The behavioural arms of
 * `letterCase.test.ts` re-derive all four from that same code.
 */
export const LETTER_CASE: Record<string, LetterCaseFacts> = {
  zx80: {
    lowerCase: 'none',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note:
      'The 64-glyph Sinclair font has capitals and nothing else, and the ' +
      'charset maps both cases onto the one character, so a lower-case letter ' +
      'is stored as the capital. A keyword is a keypress carrying its own ' +
      'token, so no scan ever compares its spelling.',
  },
  zx81: {
    lowerCase: 'none',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note: 'As the ZX80: the same 64-glyph font, and the same one-key keyword entry.',
  },
  zxspectrum: {
    lowerCase: 'always',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note:
      'The 48K font is full ASCII, lower case included, and the charset keeps ' +
      'the two cases apart - a listing comes back in the case it was written. ' +
      'Keywords are still keypresses with their own tokens, so no spelling is ' +
      'compared; and the ROM masks case when it identifies a variable, so ' +
      '`a` and `A` are one.',
  },
  zxspectrum128: {
    lowerCase: 'always',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note: 'As the 48K, whose font and variable handling the 128 inherits.',
  },
  bbcmicro: {
    lowerCase: 'always',
    keywordScan: 'upper-only',
    nameCase: 'sensitive',
    encoding: 'preserved',
    note:
      'The one family here that distinguishes case in both directions. The MOS ' +
      'font draws both cases, the charset stores both, BASIC II matches a ' +
      'keyword byte for byte against an upper-case table (so `print` lists ' +
      'back as five characters and fails at RUN), and `10 a=1:A=2` really is ' +
      'two variables.',
  },
  bbcmaster: {
    lowerCase: 'always',
    keywordScan: 'upper-only',
    nameCase: 'sensitive',
    encoding: 'preserved',
    note: 'As the Micro; BASIC IV changed the keyword table, not the case rules.',
  },
  commodore64: {
    lowerCase: 'switched',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note:
      'The character ROM holds two sets and the machine switches between them, ' +
      'so the same stored character draws `A` in the graphics set and `a` in ' +
      'the text set. That is why the encoding folds despite the shapes ' +
      'existing: PETSCII has one code for the pair, and the scan never sees a ' +
      'lower-case letter of its own.',
  },
  pet: {
    lowerCase: 'switched',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note: 'As the C64: one PETSCII code per letter, drawn by whichever set is in force.',
  },
  vic20: {
    lowerCase: 'switched',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note: 'As the C64.',
  },
  atom: {
    lowerCase: 'none',
    keywordScan: 'upper-only',
    nameCase: 'folded',
    encoding: 'preserved',
    lenient: true,
    note:
      'The MC6847 has 64 shapes and no lower case - codes 0x60-0x7E come out ' +
      'as inverse capitals - but the charset stores the lower-case byte, so a ' +
      'lower-case keyword survives into the program and then fails at RUN, ' +
      'the ROM matching keywords byte for byte. The tokenizer reads it anyway ' +
      'and reports it. Case does not decide a name here either way: the ROM ' +
      'refuses a lower-case name outright with ERROR 94.',
  },
  trs80: {
    lowerCase: 'none',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note:
      'The one machine here whose encoding preserves a case its display has ' +
      'not got. The stock Model I stores seven bits of a character but ' +
      'addresses only six of them in video RAM, so every letter is drawn as a ' +
      'capital; the byte is kept as written all the same, so a tape from a ' +
      'machine that did have the lower-case mod round-trips exactly. Nothing ' +
      'the machine can type reaches the crunch in lower case.',
  },
  cpc464: {
    lowerCase: 'always',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note:
      'The CPC character matrix draws both cases and the charset stores both, ' +
      'so a listing keeps the case it was written in. Locomotive BASIC folds ' +
      'a keyword before matching it - `print` lists back as PRINT - and folds ' +
      'a variable name too.',
  },
  cpc6128: {
    lowerCase: 'always',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note: 'As the 464; BASIC 1.1 changed neither the font nor the case rules.',
  },
  altair8800: {
    lowerCase: 'none',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'preserved',
    note:
      'There is no character generator on this machine at all - the shapes ' +
      'belong to whatever terminal is on the far end of the serial line, and ' +
      'the ASR-33 it is modelled on has no lower case, so nothing here can ' +
      'draw or type one. The charset is 7-bit ASCII and keeps whatever byte ' +
      'it is given, which is why the encoding preserves.',
  },
  pmd85: {
    lowerCase: 'always',
    keywordScan: 'upper-only',
    nameCase: 'sensitive',
    encoding: 'preserved',
    lenient: true,
    note:
      "Monitor 2's font carries lower case in its second run (0x60-0x7F) and " +
      'the charset stores it, but the crunch compares raw bytes against an ' +
      'upper-case table, so a lower-case keyword is stored as characters and ' +
      'fails at RUN. The tokenizer accepts it anyway, because a lower-case ' +
      'listing is what a reader pastes in, and reports it. Names are compared ' +
      'byte for byte, so `10 A=1:a=2` is two variables - read off a running ' +
      'machine, since nothing about a Microsoft derivative predicts it.',
  },
  apple1: {
    lowerCase: 'none',
    keywordScan: 'folded',
    nameCase: 'folded',
    encoding: 'folded',
    note:
      'The Signetics 2513 holds 64 shapes, capitals among them and no lower ' +
      'case, and the keyboard strapping puts them at 0xA0-0xDF. The charset ' +
      'maps both cases onto the one code, so a lower-case letter is stored as ' +
      'the capital and a lower-case keyword is the keyword.',
  },
  atari800: {
    lowerCase: 'always',
    keywordScan: 'upper-only',
    nameCase: 'folded',
    encoding: 'preserved',
    lenient: true,
    note:
      "AltirraOS's font carries lower case as its own shapes and the charset " +
      'stores it as typed, but booting the real ROM and typing a line with a ' +
      'lower-case letter in it - `2 b=6`, or `a=2` at the prompt - shows the ' +
      'cartridge refuses the whole line outright (`ERROR-`, no code and no ' +
      '`at line`): there is no legal program with a lower-case name to tell ' +
      'apart from its capital, so nothing rides on `sensitive` versus ' +
      "`folded` and the tokenizer's own choice to fold wins. The same test " +
      'with a keyword (`PRINT`) is refused the identical way, which is what ' +
      '`upper-only` records; the tokenizer reads a lower-case keyword anyway ' +
      "and says so (`lenient`), exactly as the Atom's and the PMD 85's do.",
  },
  atari400: {
    lowerCase: 'always',
    keywordScan: 'upper-only',
    nameCase: 'folded',
    encoding: 'preserved',
    lenient: true,
    note: "The 400 shares the 800's BASIC cartridge and OS font byte for byte.",
  },
};

/** The declared facts for a registered machine, or undefined for an unknown id. */
export function letterCaseFor(dialectId: string): LetterCaseFacts | undefined {
  return LETTER_CASE[dialectId];
}

/**
 * Whether a keyword spelled in lower case is read as that keyword here.
 *
 * Three routes to yes, and the encoding is the one that is easy to miss: on a
 * machine whose text encoding folds, the ROM never sees a lower-case letter at
 * all, so a rule of the form "the ROM compares characters, therefore compare
 * case-sensitively" would stop six machines recognising `print`.
 *
 * An unknown id folds, which is what every dialect did before this table
 * existed and what the docs drawer wants when it is a build behind.
 */
export function foldsKeywordCase(dialectId: string): boolean {
  const facts = letterCaseFor(dialectId);
  if (!facts) return true;
  return (
    facts.keywordScan === 'folded' ||
    facts.encoding === 'folded' ||
    facts.lenient === true
  );
}

/**
 * Whether a lower-case keyword should be reported here as one the machine will
 * not run.
 *
 * The ROM matches by character *and* the encoding preserves, so the lower-case
 * letter really does reach the scan and really is refused. Declared leniency
 * does not silence this: being lenient about what can be opened is not a claim
 * that the machine will run it.
 */
export function warnsOnLowerCaseKeyword(dialectId: string): boolean {
  const facts = letterCaseFor(dialectId);
  if (!facts) return false;
  return facts.keywordScan === 'upper-only' && facts.encoding === 'preserved';
}

/** Whether this machine's ROM tells `A` from `a` when identifying a variable. */
export function distinguishesNameCase(dialectId: string): boolean {
  return letterCaseFor(dialectId)?.nameCase === 'sensitive';
}

/**
 * The spelling a name is compared under: itself where the ROM tells the cases
 * apart, folded where it does not.
 *
 * One helper rather than a `toUpperCase()` at each site, so the editor's lint,
 * its usages view, the program vocabulary and the porting comparison cannot
 * answer "are these two spellings one variable?" differently.
 */
export function foldNameCase(name: string, caseSensitive: boolean): string {
  return caseSensitive ? name : name.toUpperCase();
}
