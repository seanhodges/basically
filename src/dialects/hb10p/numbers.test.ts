// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  decodeNumber,
  encodeInteger,
  encodeLineRef,
  parseNumber,
} from './numbers';

/** The bytes a literal is stored as. */
const bytesOf = (text: string): number[] => parseNumber(text, 0)!.bytes;

describe('hb10p numeric constants', () => {
  it('keeps a float in binary-coded decimal, exponent first', () => {
    // 1.5 is 0.15 x 10^1: exponent 0x40 + 1, then two mantissa digits a byte.
    expect(bytesOf('1.5')).toEqual([0x1d, 0x41, 0x15, 0x00, 0x00]);
    // 0.001 is 0.1 x 10^-2, so the exponent goes below the bias.
    expect(bytesOf('.001')).toEqual([0x1d, 0x3e, 0x10, 0x00, 0x00]);
    // Fourteen digits fit a double exactly, which is the point of storing
    // decimal: the fifteenth is rounded away, not the fifth.
    expect(bytesOf('3.1415926535898#')).toEqual([
      0x1f, 0x41, 0x31, 0x41, 0x59, 0x26, 0x53, 0x58, 0x98,
    ]);
  });

  it('carries out of the mantissa into the exponent when it rounds', () => {
    // Six digits of 9.9999999 round up to 10, which is one digit and an
    // exponent one higher rather than seven digits.
    expect(bytesOf('9.9999999!')).toEqual([0x1d, 0x42, 0x10, 0x00, 0x00]);
  });

  it('picks the type from the literal, not from the value', () => {
    // A bare whole number is an integer while it fits, then a single.
    expect(bytesOf('5')).toEqual([0x16]);
    expect(bytesOf('5!')).toEqual([0x1d, 0x41, 0x50, 0x00, 0x00]);
    expect(bytesOf('5#')).toEqual([
      0x1f, 0x41, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    // `E` names a single and `D` a double, whatever the digits say.
    expect(bytesOf('1E1')![0]).toBe(0x1d);
    expect(bytesOf('1D1')![0]).toBe(0x1f);
    // More than six significant digits needs a double to hold them.
    expect(bytesOf('1234567')![0]).toBe(0x1f);
    // `%` rounds its literal to a whole number.
    expect(bytesOf('1.7%')).toEqual([0x13]);
  });

  it('reads &H and &O as tokens and leaves &B as text', () => {
    expect(bytesOf('&HFFFF')).toEqual([0x0c, 0xff, 0xff]);
    expect(bytesOf('&O17')).toEqual([0x0b, 0x0f, 0x00]);
    // A bare & is octal too, as it is on the rest of the family.
    expect(bytesOf('&17')).toEqual([0x0b, 0x0f, 0x00]);
    // There is no binary token, so the digits stay where the run-time parser
    // can read them again.
    expect(bytesOf('&B1010')).toEqual([0x26, 0x42, 0x31, 0x30, 0x31, 0x30]);
  });

  it('reports an exponent the machine cannot hold', () => {
    expect(parseNumber('1E70', 0)?.error).toBe('Number out of range');
    expect(parseNumber('70000%', 0)?.error).toBe('Number out of range');
  });

  it('finds nothing where there is no number', () => {
    expect(parseNumber('ABC', 0)).toBeNull();
    expect(parseNumber('.X', 0)).toBeNull();
    expect(parseNumber('&', 0)).toBeNull();
  });

  it('encodes an integer in the shortest form and a line reference in the longest', () => {
    expect(encodeInteger(0)).toEqual([0x11]);
    expect(encodeInteger(9)).toEqual([0x1a]);
    expect(encodeInteger(10)).toEqual([0x0f, 0x0a]);
    expect(encodeInteger(300)).toEqual([0x1c, 0x2c, 0x01]);
    expect(encodeLineRef(5)).toEqual([0x0e, 0x05, 0x00]);
    expect(encodeLineRef(65529)).toEqual([0x0e, 0xf9, 0xff]);
  });

  it('marks a decoded float whose digits alone would read as another type', () => {
    // Without the marker the tokenizer would store 5 as an integer and 1.5 as
    // a single, and the file would stop being byte-exact.
    expect(decodeNumber([0x1d, 0x41, 0x50, 0x00, 0x00], 0)?.text).toBe('5!');
    expect(
      decodeNumber([0x1f, 0x41, 0x15, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0)
        ?.text,
    ).toBe('1.5#');
    // Where the digits already say which type it is, nothing is added.
    expect(decodeNumber([0x1d, 0x41, 0x15, 0x00, 0x00], 0)?.text).toBe('1.5');
  });

  it('gives every constant back in a form that re-encodes to itself', () => {
    for (const text of [
      '0',
      '9',
      '10',
      '255',
      '256',
      '32767',
      '&HFF',
      '&O17',
      '1.5',
      '.001',
      '40000',
      '1E+20',
      '1E-20',
      '5!',
      '1.5#',
      '1234567',
      '3.1415926535898#',
    ]) {
      const bytes = bytesOf(text);
      const back = decodeNumber(bytes, 0)!;
      expect(back.length, text).toBe(bytes.length);
      expect(bytesOf(back.text), `${text} -> ${back.text}`).toEqual(bytes);
    }
  });
});
