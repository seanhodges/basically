// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  basicImagePointers,
  buildBasicImage,
  parseBasicImage,
  programEnd,
} from './basicImage';
import { tokenizeProgram } from './tokenizer';
import { ARYTAB, PROGRAM_BASE, STREND, VARTAB } from './addresses';

describe('apple2plus image builder', () => {
  const { program } = tokenizeProgram('10 PRINT "A"\n20 END\n');

  it('carries the program through unwrapped', () => {
    // Applesoft's program is already the loadable image; the seam exists to
    // say so, and parse is its inverse for the same reason.
    expect(buildBasicImage(program)).toBe(program);
    expect(parseBasicImage(buildBasicImage(program)).program).toEqual(program);
  });

  it('builds pointers that agree with the program', () => {
    const pointers = basicImagePointers(buildBasicImage(program));
    // The byte after the zero link, which is where the machine's own insertion
    // code leaves VARTAB: $0801 + length, the length counting the link.
    const end = PROGRAM_BASE + program.length;
    expect(programEnd(program)).toBe(end);
    expect(pointers).toEqual([
      { address: VARTAB, value: end },
      { address: ARYTAB, value: end },
      { address: STREND, value: end },
    ]);
  });

  it('leaves the string pointers to the cold start and RUN', () => {
    // FRETOP and MEMSIZ are not in the list: a load does not move them, and
    // RUN clears the variables itself.
    const addresses = basicImagePointers(program).map((p) => p.address);
    expect(addresses).not.toContain(0x6f);
    expect(addresses).not.toContain(0x73);
  });
});
