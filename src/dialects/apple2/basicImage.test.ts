// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  buildBasicImage,
  IMAGE_HEADER_BYTES,
  parseBasicImage,
} from './basicImage';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { DEFAULT_HIMEM, DEFAULT_LOMEM } from './addresses';

const SOURCE = '10 PRINT "HI"\n20 FOR I=1 TO 10\n30 NEXT I\n40 END';

describe('apple2 image builder', () => {
  it('heads the program with the length SAVE writes', () => {
    const { program } = tokenizeProgram(SOURCE);
    const image = buildBasicImage(program);
    expect(image).toHaveLength(IMAGE_HEADER_BYTES + program.length);
    expect(image[0]! | (image[1]! << 8)).toBe(program.length);
    expect([...image.subarray(IMAGE_HEADER_BYTES)]).toEqual([...program]);
  });

  it('parses its own image back to the program it was built from', () => {
    const { program } = tokenizeProgram(SOURCE);
    const back = parseBasicImage(buildBasicImage(program));
    expect(back.headed).toBe(true);
    expect([...back.program]).toEqual([...program]);
    expect(detokenizeProgram(back.program)).toBe(
      '10 PRINT "HI"\n20 FOR I=1 TO 10\n30 NEXT I\n40 END',
    );
  });

  it('reads a headerless dump as program text rather than losing it', () => {
    const { program } = tokenizeProgram(SOURCE);
    const back = parseBasicImage(program);
    expect(back.headed).toBe(false);
    expect([...back.program]).toEqual([...program]);
  });

  it('refuses a program larger than the workspace it is built for', () => {
    const program = new Uint8Array(4096);
    expect(() =>
      buildBasicImage(program, {
        lomem: 0x0800,
        himem: 0x1000,
        declared: true,
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildBasicImage(program, {
        lomem: DEFAULT_LOMEM,
        himem: DEFAULT_HIMEM,
        declared: false,
      }),
    ).not.toThrow();
  });
});
