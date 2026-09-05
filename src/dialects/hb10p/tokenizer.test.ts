// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { TXTTAB } from './addresses';

/** The tokenized body of the first line, without link, number or terminator. */
function bodyOf(source: string): number[] {
  const { bytes, errors } = tokenizeProgram(source);
  expect(errors.filter((e) => e.fatal !== false)).toEqual([]);
  const end = bytes.length - 3; // the line's 0x00 and the null link
  return [...bytes.slice(4, end)];
}

describe('hb10p tokenizer', () => {
  it('emits link words that point at the following line', () => {
    const { bytes } = tokenizeProgram('10 A=1\n20 A=2\n30 A=3');
    const links: number[] = [];
    const starts: number[] = [];
    let i = 0;
    while (i + 1 < bytes.length) {
      const link = bytes[i]! | (bytes[i + 1]! << 8);
      if (link === 0) break;
      starts.push(TXTTAB + i);
      links.push(link);
      i = link - TXTTAB;
    }
    // Each link is the address of the next record, and the last one points at
    // the null link that ends the program.
    expect(starts).toEqual([TXTTAB, TXTTAB + 8, TXTTAB + 16]);
    expect(links).toEqual([TXTTAB + 8, TXTTAB + 16, TXTTAB + 24]);
    expect([...bytes.slice(24)]).toEqual([0x00, 0x00]);
  });

  it('encodes each numeric constant with its own type prefix', () => {
    const cases: [string, number[]][] = [
      // 0-9 ride in the token itself, 10-255 take a byte, and the rest of the
      // 16-bit range takes a word.
      ['10 A=0', [0x11]],
      ['10 A=9', [0x1a]],
      ['10 A=10', [0x0f, 0x0a]],
      ['10 A=255', [0x0f, 0xff]],
      ['10 A=256', [0x1c, 0x00, 0x01]],
      ['10 A=32767', [0x1c, 0xff, 0x7f]],
      // Radix literals: hex and octal have tokens, binary has none and is
      // stored as the text the machine parses again at run time.
      ['10 A=&HFF', [0x0c, 0xff, 0x00]],
      ['10 A=&O17', [0x0b, 0x0f, 0x00]],
      ['10 A=&B1010', [0x26, 0x42, 0x31, 0x30, 0x31, 0x30]],
      // BCD floats: exponent in excess-64, then two mantissa digits a byte.
      ['10 A=1.5', [0x1d, 0x41, 0x15, 0x00, 0x00]],
      ['10 A=40000', [0x1d, 0x45, 0x40, 0x00, 0x00]],
      ['10 A=1E+20', [0x1d, 0x55, 0x10, 0x00, 0x00]],
      ['10 A=.001', [0x1d, 0x3e, 0x10, 0x00, 0x00]],
      ['10 A=1234567', [0x1f, 0x47, 0x12, 0x34, 0x56, 0x70, 0x00, 0x00, 0x00]],
    ];
    for (const [source, constant] of cases) {
      expect(bodyOf(source), source).toEqual([0x41, 0xef, ...constant]);
    }
  });

  it('encodes a line reference in its own two-byte form, however small', () => {
    // A constant 5 is one byte; the 5 in GOTO 5 is three, because RENUM has to
    // be able to find it.
    expect(bodyOf('10 GOTO 5')).toEqual([0x89, 0x20, 0x0e, 0x05, 0x00]);
    expect(bodyOf('10 ON X GOTO 10,20')).toEqual([
      0x95, 0x20, 0x58, 0x20, 0x89, 0x20, 0x0e, 0x0a, 0x00, 0x2c, 0x0e, 0x14,
      0x00,
    ]);
  });

  it('encodes the two-byte function tokens behind their 0xFF prefix', () => {
    expect(bodyOf('10 A=LEFT$(B$,1)')).toEqual([
      0x41, 0xef, 0xff, 0x81, 0x28, 0x42, 0x24, 0x2c, 0x12, 0x29,
    ]);
    expect(bodyOf('10 A=VPEEK(0)')).toEqual([
      0x41, 0xef, 0xff, 0x98, 0x28, 0x11, 0x29,
    ]);
  });

  it('stores ELSE and the apostrophe comment behind their hidden colon', () => {
    expect(bodyOf('10 IF A THEN 1 ELSE 2')).toEqual([
      0x8b, 0x20, 0x41, 0x20, 0xda, 0x20, 0x0e, 0x01, 0x00, 0x20, 0x3a, 0xa1,
      0x20, 0x0e, 0x02, 0x00,
    ]);
    expect(bodyOf("10 'note")).toEqual([
      0x3a, 0x8f, 0xe6, 0x6e, 0x6f, 0x74, 0x65,
    ]);
  });

  it('matches keywords with no spaces around them, but not inside a name', () => {
    // The ROM crunches, so a glued loop is a loop...
    expect(bodyOf('10 FORI=1TO9')).toEqual([
      0x82, 0x49, 0xef, 0x12, 0xd9, 0x1a,
    ]);
    // ...and the same greed is why a name may not contain a reserved word.
    expect(bodyOf('10 TOTAL=1')).toEqual([0xd9, 0x54, 0x41, 0x4c, 0xef, 0x12]);
    // A digit after a letter belongs to the name, so it stays text.
    expect(bodyOf('10 A1=2')).toEqual([0x41, 0x31, 0xef, 0x13]);
  });

  it('round-trips a program through tokenize and detokenize', () => {
    const source = [
      '10 SCREEN 2:COLOR 15,4,4',
      '20 FOR I=1 TO 10 STEP 2',
      '30 A=1.5:B#=3.1415926535898:C=&HFFFF',
      '40 PRINT LEFT$(A$,2);MID$(A$,1,3)',
      '50 IF A>1 THEN 100 ELSE 200',
      "60 ' the apostrophe comment",
      '70 REM the spelled one',
      '80 DATA 1,2,ABC',
      '90 VPOKE &H1800,32',
      '100 ON X GOTO 10,20,30',
      '200 END',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    const back = detokenizeProgram(bytes);
    expect(back.warnings).toEqual([]);
    expect(back.source).toBe(source);
    // And the text it gives back builds the same bytes again.
    expect([...tokenizeProgram(back.source).bytes]).toEqual([...bytes]);
  });

  it('reports errors rather than throwing on a malformed line', () => {
    const { errors, bytes } = tokenizeProgram('PRINT "no number"\n20 A=1');
    expect(errors[0]?.message).toBe('Missing line number');
    expect(errors[0]?.line).toBe(1);
    // The good line is still there.
    expect(bytes[2]! | (bytes[3]! << 8)).toBe(20);

    const tooBig = tokenizeProgram('70000 A=1');
    expect(tooBig.errors[0]?.message).toMatch(/out of range/);

    const backwards = tokenizeProgram('20 A=1\n10 A=2');
    expect(backwards.errors[0]?.fatal).toBe(false);
    expect(backwards.errors[0]?.message).toMatch(/not greater than/);
  });
});
