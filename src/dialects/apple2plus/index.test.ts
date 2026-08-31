// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { apple2Charset } from '../apple2/charset';
import { COLD_START_BYTES_FREE } from './addresses';

describe('apple2plus dialect', () => {
  it('shares the sibling’s charset rather than copying it', () => {
    // The 2513 font and the normal/flash/inverse encoding belong to the board,
    // not to the BASIC in its sockets. Identity rather than equality: a copy
    // could drift, and there is no second mapping here to test.
    expect(apple2plus.charset).toBe(apple2Charset);
  });

  it('tokenizes and lists a program back through the seam', () => {
    const source = '10 HGR : HCOLOR= 3\n20 HPLOT 0,0 TO 279,159\n';
    const { image, errors, byteSize } = apple2plus.tokenize(source);
    expect(errors).toEqual([]);
    expect(byteSize).toBe(image.length);
    expect(apple2plus.detokenize(image)).toBe(source);
  });

  it('lints the name the parser will break', () => {
    // LATCH stores as L, the AT token and CH. The tokenizer reproduces that;
    // this is where the reader is told.
    const errors = apple2plus.lint('10 LATCH=1\n');
    expect(errors.some((e) => /LATCH/.test(e.message))).toBe(true);
  });

  it('declares the workspace the machine reports', () => {
    // $C000 - $0801. `PRINT FRE(0)` answers two less, having already spent the
    // empty program's zero link.
    expect(COLD_START_BYTES_FREE).toBe(47103);
    expect(apple2plus.programRamBytes).toBe(COLD_START_BYTES_FREE);
  });
});
