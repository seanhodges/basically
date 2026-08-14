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
import { VARIABLE_LEXIS, variableRulesFor } from './variableLexis';

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
 * The two ROM facts about names, stated per machine and independently of the
 * lexis, so a careless edit to one has to disagree with the other to land.
 *
 * `significant` is how many of a name's characters the ROM keeps. Microsoft
 * BASIC keeps two - the collision it causes is what `variableLint` already
 * reports - and every other machine keeps the name whole.
 *
 * `dataItems` is what READ does with a DATA item, checked on the machines: a
 * BBC and a CPC hand back the string "a" for `10 a=7:DATA a`, while a Spectrum
 * hands back 7 (and 14 for `DATA a*2`, and stops with "Variable not found" for
 * an undefined word). So the same statement holds names on one family and only
 * values on the other. `none` is for the machines with no DATA keyword at all.
 */
const ROM_NAME_FACTS: Record<
  string,
  { significant: number | 'all'; dataItems: 'verbatim' | 'evaluated' | 'none' }
> = {
  zx80: { significant: 'all', dataItems: 'none' },
  zx81: { significant: 'all', dataItems: 'none' },
  atom: { significant: 'all', dataItems: 'none' },
  zxspectrum: { significant: 'all', dataItems: 'evaluated' },
  zxspectrum128: { significant: 'all', dataItems: 'evaluated' },
  bbcmicro: { significant: 'all', dataItems: 'verbatim' },
  bbcmaster: { significant: 'all', dataItems: 'verbatim' },
  cpc464: { significant: 'all', dataItems: 'verbatim' },
  cpc6128: { significant: 'all', dataItems: 'verbatim' },
  commodore64: { significant: 2, dataItems: 'verbatim' },
  pet: { significant: 2, dataItems: 'verbatim' },
  vic20: { significant: 2, dataItems: 'verbatim' },
  trs80: { significant: 2, dataItems: 'verbatim' },
  altair8800: { significant: 2, dataItems: 'verbatim' },
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
      const lexis = VARIABLE_LEXIS[id]!;

      expect(lexis.significantChars).toBe(
        facts.significant === 'all' ? undefined : facts.significant,
      );
      expect(lexis.dataIsVerbatim).toBe(
        facts.dataItems === 'verbatim' ? true : undefined,
      );

      // Ties the table to the dialect's own keyword data: claiming a machine
      // has no DATA when its table lists one (or the reverse) fails here.
      const hasData = dialect.keywords.some((k) => k.word === 'DATA');
      expect(hasData).toBe(facts.dataItems !== 'none');
    },
  );
});
