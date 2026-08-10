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
import type { Dialect, KeywordInfo } from './types';
import { BASIC_II, BASIC_IV } from './bbcmicro/keywords';
import { c64KeywordAliases } from './commodore64/keywords';
import { TRS80_ALIASES } from './trs80/keywords';
import { ALTAIR8800_ALIASES } from './altair8800/keywords';

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
 * The alias entries a machine's keyword table declares beside its canonical
 * words. `Dialect.keywords` carries the canonical table only, so the symbol
 * spellings that exist purely for entry (`?`, `'`) are reached here.
 */
const ALIASES: Record<string, readonly KeywordInfo[]> = {
  commodore64: c64KeywordAliases,
  pet: c64KeywordAliases,
  vic20: c64KeywordAliases,
  trs80: TRS80_ALIASES,
  altair8800: ALTAIR8800_ALIASES,
};

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
  { style: 'dot' | 'shifted'; of(d: Dialect): string[] }
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
    of: (d) =>
      d.keywords.filter((k) => k.kind === 'command').map((k) => k.word),
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

/** Alphabetic keywords in ascending token order - the Commodore scan order. */
function byToken(dialect: Dialect): string[] {
  return [...dialect.keywords]
    .filter((k) => /^[A-Za-z]/.test(k.word))
    .sort((a, b) => a.token - b.token)
    .map((k) => k.word);
}

const cache = new Map<string, KeywordSpellings>();

/** How `dialect` reads short spellings of its keywords. */
export function keywordSpellingsFor(dialect: Dialect): KeywordSpellings {
  const cached = cache.get(dialect.id);
  if (cached) return cached;

  const source = ORDERS[dialect.id];
  // Commands only: a symbol standing for an operator (`^` for `↑`) is the
  // operator facts' business, and carrying it here would report one difference
  // twice. A machine where the symbol is an operator in its own right - `?` on
  // the Acorns, which is byte indirection - declares it as one and contributes
  // nothing here, which is what keeps the Atom's `?` from being read as PRINT.
  const words = new Map(
    dialect.keywords
      .filter((k) => /^[A-Za-z]/.test(k.word))
      .map((k) => [k.token, k.word]),
  );
  const symbols: SpellingUse[] = [
    ...dialect.keywords,
    ...(ALIASES[dialect.id] ?? []),
  ]
    .filter((k) => k.kind === 'command' && !/[A-Za-z]/.test(k.word))
    .map((k) => ({
      spelling: k.word,
      keyword: words.get(k.token) ?? SYMBOL_MEANS[k.word] ?? k.word,
    }));

  const spellings: KeywordSpellings = {
    style: source?.style ?? 'none',
    order: source?.of(dialect) ?? [],
    symbols,
  };
  cache.set(dialect.id, spellings);
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
