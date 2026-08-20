// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * How each machine lets a program spell its keywords short, and what a short
 * spelling in a program's text means.
 *
 * Half the machines here accept a shorter spelling than the keyword: the Acorns
 * take a dotted prefix (`P.`), the Commodores a prefix whose last letter is
 * shifted (`pO`), and several read a symbol as a whole command (`?` for PRINT,
 * `'` for REM). Archive listings are written in those notations, so a reader's
 * program contains them - and a spelling is part of a program's text, which is
 * what makes it a porting question rather than a typing convenience.
 *
 * Keyed by dialect id and built from each machine's own keyword tables, in the
 * same spirit as {@link ./charsetProbes}: the resolution *order* is the one that
 * machine's ROM scans, and it is not derivable in general - the BBC's dot lookup
 * deliberately is not token order (`P.` skips PTR/PAGE/PI and lands on PRINT),
 * while the Commodore scan is exactly token order (which is what makes `poS`
 * POS and `pO` POKE). Each machine therefore names its own source below.
 *
 * The porting facts state the same style and symbols as authored data
 * (`PortingFacts.abbreviatedEntry`); `facts-crosscheck.test.ts` pins the two
 * together so the guide and the reader's program cannot disagree about what a
 * spelling means.
 */
import type { KeywordInfo } from './types';
import { zx80Keywords } from './zx80/keywords';
import { zx81Keywords } from './zx81/keywords';
import { spectrumKeywords } from './zxspectrum/keywords';
import { spectrum128Keywords } from './zxspectrum128/keywords';
import {
  BASIC_II,
  BASIC_IV,
  bbcKeywords,
  bbcMasterKeywords,
} from './bbcmicro/keywords';
import { c64Keywords, c64KeywordAliases } from './commodore64/keywords';
import { petKeywords } from './pet/keywords';
import { vic20Keywords } from './vic20/keywords';
import { atomKeywords } from './atom/keywords';
import { trs80Keywords, TRS80_ALIASES } from './trs80/keywords';
import { cpc464Keywords } from './cpc464/keywords';
import { cpc6128Keywords } from './cpc6128/keywords';
import { altair8800Keywords, ALTAIR8800_ALIASES } from './altair8800/keywords';
import { pmd85Keywords, PMD85_ALIASES } from './pmd85/keywords';

/** A short spelling found in a program, and the keyword it stands for. */
export interface SpellingUse {
  /** The spelling as the program writes it, e.g. "P." or "?". */
  spelling: string;
  /** The keyword it resolves to on the machine that wrote it, e.g. "PRINT". */
  keyword: string;
}

/** How one machine reads short spellings. */
export interface KeywordSpellings {
  /** The prefix notation this machine takes, or 'none' where it takes none. */
  style: 'dot' | 'shifted' | 'none';
  /**
   * Keywords in the order this machine's ROM scans when resolving a prefix: a
   * prefix takes the first entry whose spelling begins with it. Empty where the
   * style is 'none'.
   */
  order: string[];
  /** Symbol spellings this machine's tokenizer reads as a whole command. */
  symbols: SpellingUse[];
}

/**
 * Every machine's keyword table, canonical words plus the alias entries that
 * exist purely for entry (`?`, `'`) - which `Dialect.keywords` does not carry.
 *
 * Keyed by dialect id rather than taking a `Dialect`, so the documentation
 * bundle can reach this: the reference pages note each keyword's short
 * spellings beside it, and they render without a registry. Every table here is
 * a leaf data module importing nothing but a type.
 *
 * `keywordSpellings.test.ts` pins this against the registry, so a machine added
 * without an entry fails rather than quietly reporting that it abbreviates
 * nothing.
 */
const TABLES: Record<string, readonly KeywordInfo[]> = {
  zx80: zx80Keywords,
  zx81: zx81Keywords,
  zxspectrum: spectrumKeywords,
  zxspectrum128: spectrum128Keywords,
  bbcmicro: bbcKeywords,
  bbcmaster: bbcMasterKeywords,
  commodore64: [...c64Keywords, ...c64KeywordAliases],
  pet: [...petKeywords, ...c64KeywordAliases],
  vic20: [...vic20Keywords, ...c64KeywordAliases],
  atom: atomKeywords,
  trs80: [...trs80Keywords, ...TRS80_ALIASES],
  cpc464: cpc464Keywords,
  cpc6128: cpc6128Keywords,
  altair8800: [...altair8800Keywords, ...ALTAIR8800_ALIASES],
  pmd85: [...pmd85Keywords, ...PMD85_ALIASES],
};

/** The registered machines this module knows a keyword table for. */
export const spellingDialectIds: readonly string[] = Object.keys(TABLES);

/**
 * Where each machine's prefix-resolution order comes from.
 *
 * The Acorns and the Commodores each answer this differently and neither answer
 * is guessable, so both are taken from the table the machine's own tokenizer
 * resolves against:
 *
 *  - the BBCs scan the ROM's dot-abbreviation lookup table, which is not token
 *    order;
 *  - the Atom scans its command words in declaration order, and only its
 *    commands - a dot opens a statement there;
 *  - the Commodores scan their reserved-word table, whose order is the token
 *    order (token = table index + $80).
 */
const ORDERS: Record<
  string,
  { style: 'dot' | 'shifted'; of(table: readonly KeywordInfo[]): string[] }
> = {
  bbcmicro: {
    style: 'dot',
    of: () => BASIC_II.abbreviations.map((k) => k.word),
  },
  bbcmaster: {
    style: 'dot',
    of: () => BASIC_IV.abbreviations.map((k) => k.word),
  },
  atom: {
    style: 'dot',
    of: (table) => table.filter((k) => k.kind === 'command').map((k) => k.word),
  },
  commodore64: { style: 'shifted', of: byToken },
  pet: { style: 'shifted', of: byToken },
  vic20: { style: 'shifted', of: byToken },
};

/**
 * What a symbol spelling means where its own token cannot say.
 *
 * A symbol usually shares the keyword's token - `?` carries PRINT's byte on
 * every Microsoft-family machine, and the TRS-80's `'` carries REM's - so the
 * table states the pairing itself. The Amstrads are the exception: their `'`
 * has a token of its own, so nothing in the machine's tables records that it
 * opens the same comment REM does.
 */
const SYMBOL_MEANS: Record<string, string> = { "'": 'REM' };

/**
 * A symbol whose spelling *is* the keyword contributes no short spelling, so it
 * is dropped rather than reported as an abbreviation of itself. BASIC-G is the
 * case: its `_` is a spelled keyword in its own right - the statement that
 * prints into the dialogue line and waits for a key - and `?` is the alias that
 * reaches it.
 */
function isAbbreviation(spelling: string, keyword: string): boolean {
  return spelling !== keyword;
}

/**
 * Alphabetic keywords in ascending token order - the Commodore scan order.
 *
 * The alias spellings drop out with the operators: they are `?` and `^`, and a
 * prefix is a prefix of a spelled word.
 */
function byToken(table: readonly KeywordInfo[]): string[] {
  return [...table]
    .filter((k) => /^[A-Za-z]/.test(k.word))
    .sort((a, b) => a.token - b.token)
    .map((k) => k.word);
}

const cache = new Map<string, KeywordSpellings>();

/** How the machine `dialectId` reads short spellings of its keywords. */
export function keywordSpellingsFor(dialectId: string): KeywordSpellings {
  const cached = cache.get(dialectId);
  if (cached) return cached;

  const table = TABLES[dialectId] ?? [];
  const source = ORDERS[dialectId];
  // Commands only: a symbol standing for an operator (`^` for `↑`) is the
  // operator facts' business, and carrying it here would report one difference
  // twice. A machine where the symbol is an operator in its own right - `?` on
  // the Acorns, which is byte indirection - declares it as one and contributes
  // nothing here, which is what keeps the Atom's `?` from being read as PRINT.
  const words = new Map(
    table
      .filter((k) => /^[A-Za-z]/.test(k.word))
      .map((k) => [k.token, k.word] as const),
  );
  // First entry wins: a machine's own table comes before its aliases, so on a
  // BASIC-G `?` resolves to `_`, the spelled keyword that shares its token.
  const canonical = new Map<number, string>();
  for (const k of table)
    if (!canonical.has(k.token)) canonical.set(k.token, k.word);

  const symbols: SpellingUse[] = table
    .filter((k) => k.kind === 'command' && !/[A-Za-z]/.test(k.word))
    .map((k) => ({
      spelling: k.word,
      keyword:
        words.get(k.token) ??
        SYMBOL_MEANS[k.word] ??
        canonical.get(k.token) ??
        k.word,
    }))
    .filter((use) => isAbbreviation(use.spelling, use.keyword));

  const spellings: KeywordSpellings = {
    style: source?.style ?? 'none',
    order: source?.of(table) ?? [],
    symbols,
  };
  cache.set(dialectId, spellings);
  return spellings;
}

/** A run of letters followed by the dot that abbreviates them. */
const DOTTED = /^([A-Za-z]+)\./;
/** A lower-case run closed by one upper-case letter: the shifted-letter form. */
const SHIFTED = /^([a-z]+)([A-Z])/;

/**
 * The short spelling at `text[i]`, resolved as `spellings` reads it, or null
 * where the text there is not one.
 *
 * The prefix rules are each machine's own. A dotted prefix that spells a whole
 * keyword is that keyword rather than an abbreviation (`AND.` is AND then a
 * dot), and so is a shifted-letter prefix (`gO` is GO, not GOTO) - in both
 * cases the tokenizer takes the full spelling, and this has to agree with it or
 * the guide would report an expansion the program does not need.
 */
export function spellingAt(
  text: string,
  i: number,
  spellings: KeywordSpellings,
): (SpellingUse & { length: number }) | null {
  for (const { spelling, keyword } of spellings.symbols) {
    if (text.startsWith(spelling, i)) {
      return { spelling, keyword, length: spelling.length };
    }
  }

  const rest = text.slice(i);
  const match =
    spellings.style === 'dot'
      ? DOTTED.exec(rest)
      : spellings.style === 'shifted'
        ? SHIFTED.exec(rest)
        : null;
  if (!match) return null;

  const prefix = (
    spellings.style === 'dot' ? match[1]! : match[1]! + match[2]!
  ).toUpperCase();
  if (spellings.order.includes(prefix)) return null;
  const keyword = spellings.order.find((w) => w.startsWith(prefix));
  if (keyword === undefined) return null;
  return { spelling: match[0]!, keyword, length: match[0]!.length };
}

/**
 * The shortest prefix abbreviation of `word` on this machine, or null where it
 * has none.
 *
 * A prefix takes the *first* word in the machine's scan order it begins, so a
 * keyword an earlier one is a prefix of cannot be abbreviated at all: PRINT is
 * always reached as PRINT# on the Commodores, which is exactly why `?` exists.
 * A prefix that spells a whole keyword is that keyword rather than an
 * abbreviation, so `gO` is GO and reaching GOTO takes one letter more.
 */
function prefixAbbreviation(
  word: string,
  spellings: KeywordSpellings,
): string | null {
  const { style, order } = spellings;
  if (style === 'none') return null;
  const whole = new Set(order);
  // A dot marks the abbreviation itself, so one letter and a dot is a spelling
  // (`P.`); a shifted letter has to be preceded by an unshifted one to be
  // distinguishable from a keyword typed in capitals, so those start at two.
  for (let n = style === 'dot' ? 1 : 2; n < word.length; n++) {
    const prefix = word.slice(0, n);
    // The abbreviating character is a dot or a shifted letter, so a spelling's
    // own `(`, `#` or `$` can never be the last one typed.
    if (!/^[A-Z]+$/.test(prefix)) break;
    if (whole.has(prefix)) continue;
    if (order.find((w) => w.startsWith(prefix)) !== word) continue;
    return style === 'dot'
      ? `${prefix}.`
      : prefix.slice(0, -1).toLowerCase() + prefix[n - 1];
  }
  return null;
}

/**
 * Every keyword this machine lets a program spell short, with the spellings -
 * shortest first - a reader would find in a listing.
 *
 * Both notations at once, because a machine can have one without the other and
 * the Commodores have both: POKE is `pO` and PRINT, which no prefix reaches, is
 * `?`. Keyed by the keyword's canonical spelling, which is how the reference
 * pages and the porting comparison name a keyword.
 */
export function shortSpellingsFor(dialectId: string): Map<string, string[]> {
  const spellings = keywordSpellingsFor(dialectId);
  const out = new Map<string, string[]>();
  const add = (keyword: string, spelling: string) => {
    const existing = out.get(keyword);
    if (existing) existing.push(spelling);
    else out.set(keyword, [spelling]);
  };

  for (const word of spellings.order) {
    const short = prefixAbbreviation(word, spellings);
    if (short !== null) add(word, short);
  }
  for (const { spelling, keyword } of spellings.symbols) add(keyword, spelling);

  for (const list of out.values()) {
    list.sort((a, b) => a.length - b.length || a.localeCompare(b));
  }
  return out;
}
