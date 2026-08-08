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
