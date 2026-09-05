// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { BAS_TOKENIZED_MARKER, buildBasFile, importBasFile } from './basfile';
import { tokenizeProgram } from './tokenizer';
import { TXTTAB } from './addresses';

const SOURCE = '10 PRINT"HI"\n20 GOTO 10';

describe('hb10p .bas container', () => {
  it('writes the 0xFF tokenized marker ahead of the program', () => {
    const { bytes } = tokenizeProgram(SOURCE);
    const file = buildBasFile(bytes);
    expect(file[0]).toBe(BAS_TOKENIZED_MARKER);
    expect([...file.slice(1)]).toEqual([...bytes]);
    expect(importBasFile(file).source).toBe(SOURCE);
  });

  it('relinks the line pointers to the program base on import', () => {
    // A machine with the disk ROM fitted starts its program area lower, so a
    // file from one carries links this base would never write.
    const { bytes } = tokenizeProgram(SOURCE);
    const moved = Uint8Array.from(bytes);
    const shift = 0x6000;
    let i = 0;
    while (i + 1 < moved.length) {
      const link = moved[i]! | (moved[i + 1]! << 8);
      if (link === 0) break;
      const next = link - TXTTAB;
      const shifted = link - shift;
      moved[i] = shifted & 0xff;
      moved[i + 1] = (shifted >> 8) & 0xff;
      i = next;
    }
    const back = importBasFile(buildBasFile(moved));
    expect(back.source).toBe(SOURCE);
    // Re-tokenizing puts the links back on this machine's base.
    expect([...tokenizeProgram(back.source).bytes]).toEqual([...bytes]);
  });

  it('reads an ASCII listing as text rather than as tokens', () => {
    const listing = Uint8Array.from([
      ...[...'10 PRINT"HI"'].map((c) => c.charCodeAt(0)),
      0x0d,
      0x0a,
      ...[...'20 GOTO 10'].map((c) => c.charCodeAt(0)),
      0x0d,
      0x0a,
      0x1a, // the end-of-file mark MSX BASIC writes after an ASCII SAVE
    ]);
    const back = importBasFile(listing);
    expect(back.source).toBe(SOURCE);
    expect(back.warnings).toEqual([
      'The file is an ASCII listing rather than a tokenized program, so it has been read as text.',
    ]);
  });
});
