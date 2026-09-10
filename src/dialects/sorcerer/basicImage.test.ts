// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  basicImagePointers,
  buildBasicImage,
  parseBasicImage,
} from './basicImage';
import { tokenizeProgram } from './tokenizer';
import { ARYTAB, PROGRAM_BASE, STREND, TXTTAB, VARTAB } from './addresses';

const imageFor = (source: string): Uint8Array =>
  buildBasicImage(tokenizeProgram(source).program);

describe('sorcerer BASIC image', () => {
  it('is the tokenized program, with nothing wrapped around it', () => {
    const { program } = tokenizeProgram('10 END\n');
    const image = buildBasicImage(program);
    expect([...image]).toEqual([...program]);
    // A copy, so a caller cannot write through it into the tokenizer's output.
    expect(image.buffer).not.toBe(program.buffer);
  });

  it('points TXTTAB at the program base whatever the program is', () => {
    for (const source of ['', '10 END\n', '10 PRINT "HI"\n20 GOTO 10\n']) {
      const pointers = basicImagePointers(imageFor(source));
      expect(pointers[0]).toEqual({ address: TXTTAB, value: PROGRAM_BASE });
    }
  });

  it('derives control-area pointers that agree with the image', () => {
    const image = imageFor('10 PRINT "HI"\n20 GOTO 10\n');
    const end = PROGRAM_BASE + image.length;
    expect(basicImagePointers(image)).toEqual([
      { address: TXTTAB, value: PROGRAM_BASE },
      { address: VARTAB, value: end },
      { address: ARYTAB, value: end },
      { address: STREND, value: end },
    ]);
  });

  it('leaves an empty program where NEW leaves one', () => {
    // NEW writes the two-byte null link at TXTTAB and sets VARTAB to the byte
    // after it, so an empty image has to produce the same three addresses.
    const image = imageFor('');
    expect([...image]).toEqual([0x00, 0x00]);
    for (const pointer of basicImagePointers(image).slice(1)) {
      expect(pointer.value).toBe(PROGRAM_BASE + 2);
    }
  });

  it('parses back only as far as the end-of-program marker', () => {
    const image = imageFor('10 END\n');
    const withCode = Uint8Array.from([...image, 0xc9, 0xc9]);
    expect([...parseBasicImage(withCode)]).toEqual([...image]);
  });

  it('returns a truncated chain as far as it goes', () => {
    const image = imageFor('10 END\n');
    const cut = image.subarray(0, image.length - 3);
    expect([...parseBasicImage(cut)]).toEqual([...cut]);
  });
});
