// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import { indexKeyDefs } from './controllerConfig';
import { keyNameCandidates, keyVocabulary, resolveKeyName } from './keyNames';

/**
 * The shared key vocabulary, held to every registered machine.
 *
 * Pure and fast: nothing here boots a machine or reads a ROM, because the
 * resolver reads a layout and nothing else. The ROM-level proof - that every
 * name a machine offers actually presses a cell that emits something - is the
 * every-machine crosscheck in `src/ai/machineObservability.test.ts`, which
 * already boots every dialect for the assistant's sake; a second battery
 * booting them all again would be among the slowest files in the suite for no
 * fact the first does not establish.
 */

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const DIGITS = [...'0123456789'];

/** The part of the vocabulary every registered machine has. */
const UNIVERSAL = [...LETTERS, ...DIGITS, 'SPACE', 'ENTER', 'SHIFT'];

describe('every machine answers to the universal names', () => {
  it.each(dialects.map((d) => d.id))('%s', (id) => {
    const layout = getDialect(id)!.keyboardLayout;
    for (const name of UNIVERSAL) {
      expect(resolveKeyName(layout, name), `${id} has no ${name}`).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
    }
  });

  it('lists every universal name in the vocabulary it publishes', () => {
    for (const dialect of dialects) {
      const vocabulary = new Set(keyVocabulary(dialect.keyboardLayout));
      expect(
        UNIVERSAL.filter((name) => !vocabulary.has(name)),
        `${dialect.id} does not offer these`,
      ).toEqual([]);
    }
  });
});

/**
 * The concepts only some machines have, and why the rest do not offer them.
 *
 * Absence is the honest answer - a machine with no escape key must not map
 * `ESCAPE` onto some other key it does have - so every machine is either
 * covered or excused by name, and a new machine has to join one side or the
 * other.
 *
 * A reason here is about the keyboard the IDE draws, which is what the resolver
 * reads: several of these machines have a key on the real hardware that their
 * layout carries no keycap for, and the answer to wanting it is a keycap in the
 * layout, never a special case in the resolver.
 */
const NO_SUCH_KEY: Record<string, Record<string, string>> = {
  DELETE: {
    // A forward delete, not a rub-out: the machine's own DEL takes the
    // character the cursor is on, and 0x08 comes from the CURSOR-left key.
    // Offering it as DELETE would make one name mean two different things.
    pmd85: 'the DEL key deletes forwards; the rub-out is CURSOR left',
  },
  ESCAPE: {
    zx81: 'no escape keycap on the machine',
    zx80: 'no escape keycap on the machine',
    zxspectrum: 'no escape keycap on the machine',
    zxspectrum128: 'no escape keycap on the machine',
    commodore64: 'no escape keycap on the machine',
    vic20: 'no escape keycap on the machine',
    pet: 'no escape keycap on the machine',
    trs80: 'no escape keycap on the machine',
    pmd85: 'no escape keycap on the machine',
    ge235: 'a teletype: no escape keycap on the machine',
    cpc464: 'the layout carries no ESC keycap',
    cpc664: 'the layout carries no ESC keycap',
    cpc6128: 'the layout carries no ESC keycap',
    hb10p: 'the layout carries no ESC keycap',
  },
  CTRL: {
    zx81: 'no CTRL keycap on the machine',
    zx80: 'no CTRL keycap on the machine',
    zxspectrum: 'no CTRL keycap on the machine',
    zxspectrum128: 'no CTRL keycap on the machine',
    pet: 'no CTRL keycap on the machine',
    trs80: 'no CTRL keycap on the machine',
    pmd85: 'no CTRL keycap on the machine',
    bbcmicro: 'the layout declares no CTRL modifier',
    bbcmaster: 'the layout declares no CTRL modifier',
    atom: 'the layout declares no CTRL modifier',
    commodore64: 'the layout declares no CTRL modifier',
    vic20: 'the layout declares no CTRL modifier',
    cpc464: 'the layout declares no CTRL modifier',
    cpc664: 'the layout declares no CTRL modifier',
    cpc6128: 'the layout declares no CTRL modifier',
    samcoupe: 'the layout declares no CTRL modifier',
    ge235: 'the layout declares no CTRL modifier',
  },
  UP: {
    altair8800: 'a front panel and a teletype: no cursor keys',
    apple1: 'an ASCII keyboard with no cursor addressing to move in',
    apple2: 'two arrows only, both on the base layer, and neither goes up',
    apple2plus: 'two arrows only, both on the base layer, and neither goes up',
    ge235: 'paper, not a screen: the carriage only moves forward',
  },
  DOWN: {
    altair8800: 'a front panel and a teletype: no cursor keys',
    apple1: 'an ASCII keyboard with no cursor addressing to move in',
    apple2: 'two arrows only, both on the base layer, and neither goes down',
    apple2plus:
      'two arrows only, both on the base layer, and neither goes down',
    ge235: 'paper, not a screen: the carriage only moves forward',
    // The Monitor's key-code table gives the cell below the left arrow no code
    // at all, so the editing block has three arrows and no fourth.
    pmd85: 'the machine has three cursor keys and no fourth',
  },
  LEFT: {
    altair8800: 'a front panel and a teletype: no cursor keys',
    apple1: 'an ASCII keyboard with no cursor addressing to move in',
    // The same keycap is the rub-out here, which is why the resolver reads the
    // declared action rather than the arrow drawn on the cap.
    apple2: 'the left arrow is the rub-out, and is offered as DELETE',
    apple2plus: 'the left arrow is the rub-out, and is offered as DELETE',
    ge235: 'paper, not a screen: the carriage only moves forward',
  },
  RIGHT: {
    altair8800: 'a front panel and a teletype: no cursor keys',
    apple1: 'an ASCII keyboard with no cursor addressing to move in',
    ge235: 'paper, not a screen: the carriage only moves forward',
  },
};

describe('the concepts only some machines have', () => {
  it('offers each one wherever it exists, and excuses the rest by name', () => {
    for (const [name, excused] of Object.entries(NO_SUCH_KEY)) {
      const missing = dialects
        .filter((d) => resolveKeyName(d.keyboardLayout, name) === undefined)
        .map((d) => d.id);
      expect(
        missing.filter((id) => excused[id] === undefined),
        `${name} resolves on neither of these; excuse each in NO_SUCH_KEY ` +
          'with a reason, or give its layout a keycap to resolve from',
      ).toEqual([]);
      expect(
        Object.keys(excused).filter((id) => !missing.includes(id)),
        `${name} now resolves on these; take them out of NO_SUCH_KEY`,
      ).toEqual([]);
    }
  });

  it('excuses only registered dialects', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const excused of Object.values(NO_SUCH_KEY)) {
      for (const id of Object.keys(excused)) {
        expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
      }
    }
  });
});

describe('what a name resolves to', () => {
  it('resolves every alias to exactly what its canonical name presses', () => {
    const aliases: [string, string][] = [
      ['RETURN', 'ENTER'],
      ['NEWLINE', 'ENTER'],
      ['BACKSPACE', 'DELETE'],
      ['RUBOUT', 'DELETE'],
      ['ESC', 'ESCAPE'],
    ];
    for (const dialect of dialects) {
      const layout = dialect.keyboardLayout;
      for (const [alias, canonical] of aliases) {
        const wanted = resolveKeyName(layout, canonical);
        if (wanted === undefined) continue;
        expect(
          resolveKeyName(layout, alias),
          `${dialect.id}: ${alias} is not ${canonical}`,
        ).toEqual(wanted);
      }
    }
  });

  it('never lists an alias, so one key is offered under one name', () => {
    for (const dialect of dialects) {
      const vocabulary = keyVocabulary(dialect.keyboardLayout);
      for (const alias of ['RETURN', 'NEWLINE', 'BACKSPACE', 'RUBOUT', 'ESC']) {
        expect(vocabulary, `${dialect.id} lists ${alias}`).not.toContain(alias);
      }
    }
  });

  it('folds case, so a schedule may be written in either', () => {
    for (const dialect of dialects) {
      const layout = dialect.keyboardLayout;
      expect(resolveKeyName(layout, 'enter'), dialect.id).toEqual(
        resolveKeyName(layout, 'ENTER'),
      );
      expect(resolveKeyName(layout, ' space '), dialect.id).toEqual(
        resolveKeyName(layout, 'SPACE'),
      );
    }
  });

  it('refuses a name it does not know rather than finding a neighbour', () => {
    for (const dialect of dialects) {
      for (const nonsense of ['WARP', 'F99', 'KeyÅ', '']) {
        expect(
          resolveKeyName(dialect.keyboardLayout, nonsense),
          `${dialect.id} resolved "${nonsense}"`,
        ).toBeUndefined();
      }
    }
  });

  it('still resolves every one of a layout’s own key ids', () => {
    // What keeps already-written scripts and the browser spec's `PRESS KeyA`
    // working now that the assistant is told the vocabulary instead.
    for (const dialect of dialects) {
      const layout = dialect.keyboardLayout;
      for (const [id, def] of indexKeyDefs(layout)) {
        if (def.emits.length === 0) continue;
        expect(
          resolveKeyName(layout, id),
          `${dialect.id} no longer resolves its own id ${id}`,
        ).toEqual(expect.arrayContaining([expect.any(String)]));
      }
    }
  });
});

describe('one name, one key', () => {
  it('resolves each name to a single set of tokens on each machine', () => {
    // Where two keys yield the same tokens it is not ambiguity at all - the
    // CPCs and the MSX declare their cursor cells twice, as a non-rendered
    // controller key and as a CURSOR legend. Where they genuinely differ the
    // resolver must not choose: the layout is what gets fixed.
    for (const dialect of dialects) {
      const ambiguous = [...keyNameCandidates(dialect.keyboardLayout)]
        .filter(([, lists]) => lists.length > 1)
        .map(
          ([name, lists]) =>
            `${name}: ${lists.map((l) => l.join('+')).join(' vs ')}`,
        );
      expect(ambiguous, `${dialect.id} names one key two ways`).toEqual([]);
    }
  });

  it('publishes a stable, sorted vocabulary', () => {
    // The assistant's system prompt carries this list, and a prefix cache is
    // worth nothing if the same dialect composes different bytes twice.
    for (const dialect of dialects) {
      const once = keyVocabulary(dialect.keyboardLayout);
      expect(keyVocabulary(dialect.keyboardLayout), dialect.id).toEqual(once);
      expect(once, `${dialect.id} is not sorted`).toEqual([...once].sort());
    }
  });
});

describe('a machine whose key positions and key meanings disagree', () => {
  it('presses the PMD 85 key that types Z, not the one its id is named for', () => {
    // The PMD 85 is a Czechoslovak QWERTZ board whose matrix tokens are DOM
    // `KeyboardEvent.code` names, and those are positional: the key that types
    // Z sits where a QWERTY board has Y, so it emits `KeyY`. Resolving a letter
    // off the id would press the wrong key here and say nothing about it.
    const layout = getDialect('pmd85')!.keyboardLayout;

    expect(resolveKeyName(layout, 'Z')).toEqual(['KeyY']);
    expect(resolveKeyName(layout, 'Y')).toEqual(['KeyZ']);
    // The ids themselves still resolve, as the ids they are.
    expect(resolveKeyName(layout, 'KeyZ')).toEqual(['KeyZ']);
  });
});
