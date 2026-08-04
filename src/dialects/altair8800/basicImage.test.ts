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

const SOURCE = '10 PRINT "HI"\n20 END\n';

describe('altair8800 basic image', () => {
  it('is exactly the tokenized program - there is no container', () => {
    expect([...buildBasicImage(SOURCE)]).toEqual([
      ...tokenizeProgram(SOURCE).program,
    ]);
  });

  it('links each line to the absolute address of the next', () => {
    const image = buildBasicImage(SOURCE);
    let p = 0;
    let addr = PROGRAM_BASE;
    const seen: number[] = [];
    while ((image[p]! | (image[p + 1]! << 8)) !== 0) {
      const link = image[p]! | (image[p + 1]! << 8);
      let end = p + 4;
      while (image[end] !== 0x00) end++;
      const recordLength = end + 1 - p;
      expect(link).toBe(addr + recordLength);
      seen.push(image[p + 2]! | (image[p + 3]! << 8));
      addr = link;
      p = end + 1;
    }
    expect(seen).toEqual([10, 20]);
    // The chain ends where the null link sits, so the last link addresses it.
    expect(addr).toBe(PROGRAM_BASE + image.length - 2);
  });

  it('derives the interpreter pointers from the image length', () => {
    const image = buildBasicImage(SOURCE);
    const end = PROGRAM_BASE + image.length;
    expect(basicImagePointers(image)).toEqual([
      { name: 'TXTTAB', address: TXTTAB, value: PROGRAM_BASE },
      { name: 'VARTAB', address: VARTAB, value: end },
      { name: 'ARYTAB', address: ARYTAB, value: end },
      { name: 'STREND', address: STREND, value: end },
    ]);
    // VARTAB must land on the byte after the 0x0000 end-of-program link, which
    // is also where the last line's link stops - the two agree by construction
    // and this is the check that keeps them agreeing.
    expect(basicImagePointers(image)[1]!.value).toBe(
      PROGRAM_BASE + image.length,
    );
  });

  it('moves every pointer but TXTTAB when the program grows', () => {
    const small = basicImagePointers(buildBasicImage('10 END\n'));
    const big = basicImagePointers(buildBasicImage(SOURCE));
    expect(big[0]!.value).toBe(small[0]!.value);
    for (const i of [1, 2, 3]) {
      expect(big[i]!.value).toBeGreaterThan(small[i]!.value);
    }
  });

  it('parses an image back to its program bytes, dropping appended code', () => {
    const image = buildBasicImage(SOURCE);
    expect([...parseBasicImage(image)]).toEqual([...image]);
    const withCode = Uint8Array.from([...image, 0xc3, 0x00, 0x20]);
    expect([...parseBasicImage(withCode)]).toEqual([...image]);
  });

  it('returns what it can of a truncated chain rather than throwing', () => {
    const image = buildBasicImage(SOURCE);
    const truncated = image.slice(0, image.length - 6);
    expect(() => parseBasicImage(truncated)).not.toThrow();
    expect(parseBasicImage(truncated).length).toBe(truncated.length);
  });
});
