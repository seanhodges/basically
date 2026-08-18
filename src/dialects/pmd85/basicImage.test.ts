// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  basicImagePointers,
  buildBasicImage,
  parseBasicImage,
} from './basicImage';
import { tokenizeProgram } from './tokenizer';
import {
  ARYTAB,
  IMAGE_BODY_OFFSET,
  PROGRAM_BASE,
  STREND,
  TXTTAB,
  VARTAB,
} from './addresses';
import { MONITOR_SIZE } from './romImage';

const source = '10 PRINT "HI"\n20 GOTO 10\n';

describe('pmd85 BASIC-G image', () => {
  it('is the tokenized program, with nothing wrapped round it', () => {
    expect([...buildBasicImage(source)]).toEqual([
      ...tokenizeProgram(source).program,
    ]);
  });

  it('links each line to the address of the next, from the program base', () => {
    const image = buildBasicImage(source);
    let p = 0;
    let addr = PROGRAM_BASE;
    const links: number[] = [];
    while (true) {
      const link = image[p]! | (image[p + 1]! << 8);
      if (link === 0) break;
      links.push(link);
      // Walk the record the hard way - to its 0x00 terminator - and check the
      // link points exactly there, which is what the interpreter's relink pass
      // computes.
      let i = p + 4;
      while (image[i] !== 0x00) i++;
      expect(link).toBe(addr + (i + 1 - p));
      addr = link;
      p = i + 1;
    }
    expect(links).toHaveLength(2);
    // The last link is the byte after the program, which is where the variable
    // pointers land too.
    expect(links.at(-1)).toBe(PROGRAM_BASE + image.length - 2);
  });

  it('parses a built image back to the program bytes it was built from', () => {
    const image = buildBasicImage(source);
    expect([...parseBasicImage(image)]).toEqual([...image]);
    // Trailing bytes (appended machine code) are not part of the program.
    const withTrailer = Uint8Array.from([...image, 0xc9, 0xc9, 0xc9]);
    expect([...parseBasicImage(withTrailer)]).toEqual([...image]);
  });

  it('returns a truncated chain as far as it goes, rather than throwing', () => {
    const image = buildBasicImage(source).slice(0, 6);
    expect(() => parseBasicImage(image)).not.toThrow();
    expect(parseBasicImage(image)).toHaveLength(6);
  });

  it('points the interpreter workspace at the image it just loaded', () => {
    const image = buildBasicImage(source);
    const end = PROGRAM_BASE + image.length;
    expect(basicImagePointers(image)).toEqual([
      { name: 'TXTTAB', address: TXTTAB, value: PROGRAM_BASE },
      { name: 'VARTAB', address: VARTAB, value: end },
      { name: 'ARYTAB', address: ARYTAB, value: end },
      { name: 'STREND', address: STREND, value: end },
    ]);
  });

  it('takes its program base from the interpreter, not from a guess', () => {
    // TXTTAB is a word inside the interpreter image itself, because the
    // interpreter is copied into RAM. Read it back out of the shipped ROM.
    const rom = new Uint8Array(
      readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
    );
    const body = rom.subarray(MONITOR_SIZE + IMAGE_BODY_OFFSET);
    expect(body[TXTTAB]! | (body[TXTTAB + 1]! << 8)).toBe(PROGRAM_BASE);
  });
});
