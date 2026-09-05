// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The shared vocabulary of the canonical samples, across every registered
 * dialect.
 *
 * `sampleKit.test.ts` pins the catalogue - same file names, same titles, same
 * order on every machine. This pins what is *inside* the programs: someone
 * switching machines should meet the same greeting, the same maze goal and the
 * same kaleidoscope prompts, so that what differs between two dialects is the
 * BASIC and not the product.
 *
 * Every rule here is checked against the text the user sees - the string
 * literals - not against the code around them, because how a machine prints is
 * exactly what is allowed to differ. A machine that genuinely cannot express a
 * rule drops the whole sample instead (the TRS-80 ships no `kaleido`, the ZX80
 * and the Atom no `breakout`); there is no half-ported sample with a missing
 * greeting.
 */

import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import type { Dialect, SampleFile } from './types';
import { LOWER_CASE_KEYWORD_HINT } from '../editor/keywordCase';
import { strictCharacterErrors } from '../app/strictCharacters';

/**
 * The double-quoted string literals of a program, which is everything the
 * sample puts on screen. Sinclair machines carry their inverse-video and
 * graphics characters as `%X` / `{0xNN}` escapes inside those literals, so the
 * text is compared with the escapes still in it and the letter-only helper
 * below is what sees through them.
 */
function literals(text: string): string {
  return [...text.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]!).join('\n');
}

/**
 * The letters of a program's on-screen text, upper-cased with everything else
 * dropped. This is how a banner is recognised whatever the machine spaces or
 * escapes it into: the ZX81 prints `"%B%A%S%I%C%A%L%L%Y"` and the ZX80
 * `"B A S I C A L L Y"`, and both are the same word to a reader.
 */
function letters(text: string): string {
  return literals(text)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/** The dialects that ship `name`, paired with that sample. */
function shipping(name: string): [Dialect, SampleFile][] {
  return dialects.flatMap((d) => {
    const sample = d.samples.find((s) => s.name === name);
    return sample ? [[d, sample] as [Dialect, SampleFile]] : [];
  });
}

/** Assert `predicate` of every dialect shipping `name`, naming the failures. */
function everyShipper(
  name: string,
  predicate: (text: string) => boolean,
): void {
  const shippers = shipping(name);
  expect(shippers.length, `no dialect ships ${name}`).toBeGreaterThan(0);
  const failures = shippers
    .filter(([, sample]) => !predicate(sample.text))
    .map(([dialect]) => dialect.id);
  expect(
    failures,
    `${name} is off-convention on: ${failures.join(', ')}`,
  ).toEqual([]);
}

describe('hello speaks the same way on every machine', () => {
  it('greets the user', () => {
    // The word, not the whole phrase: `HELLO FROM THE <machine>` is the house
    // form, but a narrow screen shortens it - the VIC-20 has 22 columns and
    // says `HELLO VIC-20`, the CPC in MODE 0 has 20 and says `HELLO CPC!`.
    everyShipper('hello.bas', (text) => letters(text).includes('HELLO'));
  });

  it('signs off with the BASICALLY banner', () => {
    everyShipper('hello.bas', (text) => letters(text).includes('BASICALLY'));
  });
});

describe('maze sets the same goal on every machine', () => {
  it('tells the player on screen to reach the E', () => {
    // The exit is `E` everywhere, so the hint that names it is the same hint
    // everywhere. The controls beside it are the machine's own - W A S D, the
    // Sinclair 5 6 7 8 cluster, the Atom's Z X K M, the PMD 85's function keys.
    everyShipper('maze.bas', (text) => /REACH/.test(literals(text)));
  });

  it('says YOU ESCAPED on the way out', () => {
    // Some machines pad it with trailing spaces to overwrite a longer line, and
    // some add the exclamation mark, so the pinned part is the two words.
    everyShipper('maze.bas', (text) => letters(text).includes('YOUESCAPED'));
  });
});

describe('breakout keeps the same scoreboard on every machine', () => {
  it('labels the score', () => {
    everyShipper('breakout.bas', (text) => /SCORE/.test(literals(text)));
  });

  it('says GAME OVER when the ball is lost', () => {
    everyShipper('breakout.bas', (text) => letters(text).includes('GAMEOVER'));
  });
});

describe('kaleido asks for the same three parameters on every machine', () => {
  /**
   * The rules below are about the parameters a machine-code routine is handed,
   * so they apply to the dialects that carry one - as a block, or as the
   * Sinclairs' `#BIN` REM. A dialect that ships no kaleidoscope at all (the
   * TRS-80) is out of scope for the same reason.
   */
  const parameterised = shipping('kaleido.bas').filter(
    ([dialect, sample]) =>
      sample.blocks !== undefined || dialect.supportsBinaryLines === true,
  );

  it('is worth checking on more than one machine', () => {
    expect(parameterised.length).toBeGreaterThan(4);
  });

  it('names the picture', () => {
    // The whole source, not just the literals: most machines name it in the
    // opening REM (`KALEIDOSCOPE - MACHINE CODE DRAWS, BASIC ASKS`) and the
    // Sinclairs print it as a heading instead. Both are text the user reads.
    for (const [dialect, sample] of parameterised) {
      expect(sample.text.toUpperCase(), dialect.id).toContain('KALEIDOSCOPE');
    }
  });

  it('prompts for seed, twist and passes, in that order, with their ranges', () => {
    // The ranges are what make the prompt answerable without reading the
    // assembly. Seed and twist are a byte on every machine; the pass ceiling is
    // the machine's own - the Apple 1 stops at 4 because a pass is eight
    // seconds at one character per video field.
    for (const [dialect, sample] of parameterised) {
      const text = literals(sample.text);
      expect(text, dialect.id).toMatch(/SEED \(0-255\)/);
      expect(text, dialect.id).toMatch(/TWIST \(0-255\)/);
      expect(text, dialect.id).toMatch(/PASSES \(1-\d\)/);
      const order = ['SEED', 'TWIST', 'PASSES'].map((p) => text.indexOf(p));
      expect(
        [...order].sort((a, b) => a - b),
        dialect.id,
      ).toEqual(order);
    }
  });

  it('goes back for another picture instead of ending', () => {
    // Every machine with a block loops: the sample is a toy you turn, not a
    // demo that runs once.
    for (const [dialect, sample] of parameterised) {
      expect(sample.text, dialect.id).toMatch(/GO ?TO/i);
    }
  });
});

describe('no bundled sample is written in a case its machine will not run', () => {
  // The lower-case-keyword report generalised to four machines at once, so
  // this exists to catch a sample that gets it wrong rather than the reader.
  // Every sample of every registered machine, because a sample is the first
  // thing anyone opens.
  it('raises no lower-case-keyword diagnostic anywhere', () => {
    const flagged: string[] = [];
    for (const dialect of dialects) {
      for (const sample of dialect.samples) {
        for (const error of dialect.lint(sample.text)) {
          if (error.message.startsWith(LOWER_CASE_KEYWORD_HINT))
            flagged.push(
              `${dialect.id}/${sample.name}:${error.line} ${error.message}`,
            );
        }
      }
    }
    expect(flagged).toEqual([]);
  });
});

describe('no bundled sample is refused by Strict characters', () => {
  // The setting ships off, so a refused sample would not break anything - it
  // would simply mean the IDE disagreeing with a listing it bundles, the first
  // one anybody opens. Cheaper to keep them clean.
  //
  // What this caught: the C64 breakout accepted its paddle keys as `"A" OR
  // "a"`, reaching for the shifted key. PETSCII has one code for the pair, so
  // both literals were the same byte and the second clause never did anything;
  // it is gone rather than excused.
  it('leaves no character the machine would store as another', () => {
    const flagged: string[] = [];
    for (const dialect of dialects) {
      for (const sample of dialect.samples) {
        for (const error of strictCharacterErrors(sample.text, dialect, true)) {
          flagged.push(
            `${dialect.id}/${sample.name}:${error.line} ${error.message}`,
          );
        }
      }
    }
    expect(flagged).toEqual([]);
  });
});
