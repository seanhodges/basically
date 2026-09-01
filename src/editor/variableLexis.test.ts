// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The lexis table has to name every machine, because its fallback is silent: a
 * missing entry reads as the Sinclair defaults, so a new BBC-like dialect would
 * lose `_` from its names and a new Microsoft-like one would stop crunching -
 * neither raises anything, both quietly change what the lint and the porting
 * guide see.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { VARIABLE_LEXIS, lexisFor, variableRulesFor } from './variableLexis';
import { foldsKeywordCase } from '../dialects/letterCase';

describe('variable lexis', () => {
  it('names every registered machine, and no others', () => {
    expect(Object.keys(VARIABLE_LEXIS).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  it.each(dialects.map((d) => [d.id, d] as const))(
    '%s builds a scanner that knows its own keywords',
    (id, dialect) => {
      const rules = variableRulesFor(id, dialect.keywords);
      expect(rules.keywords.size).toBeGreaterThan(0);
      expect(rules.maxWordLen).toBeGreaterThan(0);
      // The crunched flag on the seam and the one in the lexis are the same
      // fact; a machine crunching in one and not the other reads its own
      // program two different ways.
      expect(rules.crunch !== null).toBe(dialect.crunched === true);
    },
  );
});

/**
 * The three ROM facts that decide when two spellings are one variable, stated
 * per machine and independently of the lexis, so a careless edit to one has to
 * disagree with the other to land.
 *
 * `significant` is how many of a name's characters the ROM keeps. Microsoft
 * BASIC keeps two - `10 MYVAL=11:MYTAG=22` leaves a C64 holding one variable,
 * `MY`, and the collision is what `variableLint` already reports. Every other
 * machine keeps the name whole (`score` and `scott` stay apart on a BBC and a
 * CPC).
 *
 * `case` is whether the ROM tells `A` from `a`. Acorn's BBC BASIC does -
 * `10 a=1:A=2:PRINT a;A` prints 1 and 2 - and so does BASIC-G; the same program
 * prints 2 and 2 on a CPC, and a Spectrum and a C64 are each left holding a
 * single variable A. The Atom rejects a lowercase name outright (ERROR 94), so
 * it folds case with the majority and nothing rides on it. Restated here
 * against the machine's declared letter-case facts, which is where the lexis
 * now takes it from.
 *
 * `dataItems` is what READ does with a DATA item: a BBC and a CPC hand back the
 * string "a" for `10 a=7:DATA a`, while a Spectrum hands back 7 (and 14 for
 * `DATA a*2`, and stops with "Variable not found" for an undefined word). So
 * the same statement holds names on one family and only values on the other.
 * `none` is for the machines with no DATA keyword at all.
 *
 * The Microsoft machines were checked on the C64 and taken to hold for the PET,
 * VIC-20, TRS-80 and Altair, which run the same BASIC and which the variable
 * lint already treats as one family.
 */
const ROM_NAME_FACTS: Record<
  string,
  {
    significant: number | 'all';
    case: 'sensitive' | 'folded';
    dataItems: 'verbatim' | 'evaluated' | 'none';
  }
> = {
  zx80: { significant: 'all', case: 'folded', dataItems: 'none' },
  zx81: { significant: 'all', case: 'folded', dataItems: 'none' },
  atom: { significant: 'all', case: 'folded', dataItems: 'none' },
  zxspectrum: { significant: 'all', case: 'folded', dataItems: 'evaluated' },
  zxspectrum128: { significant: 'all', case: 'folded', dataItems: 'evaluated' },
  bbcmicro: { significant: 'all', case: 'sensitive', dataItems: 'verbatim' },
  bbcmaster: { significant: 'all', case: 'sensitive', dataItems: 'verbatim' },
  cpc464: { significant: 'all', case: 'folded', dataItems: 'verbatim' },
  cpc664: { significant: 'all', case: 'folded', dataItems: 'verbatim' },
  cpc6128: { significant: 'all', case: 'folded', dataItems: 'verbatim' },
  commodore64: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  pet: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  vic20: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  trs80: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  altair8800: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  // Two significant characters like the rest of its family, but case
  // SENSITIVE like a BBC and unlike every other Microsoft derivative here:
  // `10 A=1:a=2:PRINT A;a` prints 1 and 2 on a booted PMD 85, because the
  // crunch stores the name as typed and the lookup compares the bytes.
  pmd85: { significant: 2, case: 'sensitive', dataItems: 'verbatim' },
  // Nothing to truncate: an Integer BASIC name is one letter and at most one
  // digit, so both of its significant characters are always written out and
  // `A1` and `A2` are different variables. Lower case is refused outright, as
  // on the Atom, and there is no DATA keyword to read items from.
  apple1: { significant: 'all', case: 'folded', dataItems: 'none' },
  // The Apple II's Integer BASIC takes a long name and keeps all of it, so
  // nothing truncates here either. Lower case is refused the same way - the
  // keyboard cannot type it and the parser will not take it - and this
  // interpreter has no DATA keyword any more than the Apple I's does.
  apple2: { significant: 'all', case: 'folded', dataItems: 'none' },
  // Applesoft is a Microsoft BASIC where the sibling's is not, so on the same
  // board the name rules change: two significant characters again, and a DATA
  // statement to read items from - the II Plus is the only Apple here with one.
  // Case still folds, because the charset folds it before the interpreter sees
  // it.
  apple2plus: { significant: 2, case: 'folded', dataItems: 'verbatim' },
  // A name is kept in full - there is no truncation - and DATA/REM keep their
  // text verbatim. Lower case is refused outright at the ROM's own line
  // parser (booted and typed: `2 b=6` and `a=2` both come back `ERROR-`), so
  // it folds case with the majority for the same reason the Atom does.
  atari800: { significant: 'all', case: 'folded', dataItems: 'verbatim' },
  atari400: { significant: 'all', case: 'folded', dataItems: 'verbatim' },
  // A Microsoft BASIC on a machine that can type both cases: two significant
  // characters and a verbatim DATA like the rest of the family, and case still
  // folds - unlike the PMD 85, which is the other machine here whose charset
  // preserves case, the MSX ROM folds the name before looking it up.
  hb10p: { significant: 2, case: 'folded', dataItems: 'verbatim' },
};

describe('name facts are stated per machine', () => {
  it('covers every registered machine, and no others', () => {
    expect(Object.keys(ROM_NAME_FACTS).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  it.each(dialects.map((d) => [d.id, d] as const))(
    '%s keeps the lexis and the ROM facts in step',
    (id, dialect) => {
      const facts = ROM_NAME_FACTS[id]!;
      // The resolved lexis, not the authored record: case is declared with the
      // machine's other letter-case facts and filled in here, so reading the
      // record directly would find it absent on every machine.
      const lexis = lexisFor(id);

      expect(lexis.significantChars).toBe(
        facts.significant === 'all' ? undefined : facts.significant,
      );
      expect(lexis.dataIsVerbatim).toBe(
        facts.dataItems === 'verbatim' ? true : undefined,
      );
      expect(lexis.caseSensitive).toBe(facts.case === 'sensitive');
      // The scanner's keyword fold is a different question with a different
      // answer: the PMD 85 tells `A` from `a` in a name and still reads a
      // lower-case keyword, because its dialect is declared lenient.
      expect(lexis.foldsKeywordCase).toBe(foldsKeywordCase(id));

      // Ties the table to the dialect's own keyword data: claiming a machine
      // has no DATA when its table lists one (or the reverse) fails here.
      const hasData = dialect.keywords.some((k) => k.word === 'DATA');
      expect(hasData).toBe(facts.dataItems !== 'none');
    },
  );
});
