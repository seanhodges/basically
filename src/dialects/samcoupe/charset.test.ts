import { describe, it, expect } from 'vitest';
import { CharsetError } from '../types';
import {
  samcoupeCharset,
  decodeSpan,
  parseChar,
  CONTROL_CODES,
} from './charset';
import { BLOCK_GRAPHIC_UNICODE, UDG_UNICODE } from './graphics';

describe('samcoupe charset', () => {
  it('keeps ASCII and the three glyphs the ROM font redraws', () => {
    expect(Array.from(samcoupeCharset.toMachine('AZ az 09'))).toEqual([
      0x41, 0x5a, 0x20, 0x61, 0x7a, 0x20, 0x30, 0x39,
    ]);
    // CHARSRC draws an up arrow at 0x5E, a pound at 0x60 and a copyright at
    // 0x7F, the last being the glyph UPACK patches bit 6 into by hand.
    expect(Array.from(samcoupeCharset.toMachine('↑£©'))).toEqual([
      0x5e, 0x60, 0x7f,
    ]);
    expect(samcoupeCharset.glyph(0x5e)).toBe('↑');
    // '^' and '`' are the keys those two are reached by.
    expect(Array.from(samcoupeCharset.toMachine('^`'))).toEqual([0x5e, 0x60]);
  });

  it('lights the block-graphics quadrants in the ROM POUDG order', () => {
    // bit 1 top left, bit 0 top right, bit 3 bottom left, bit 2 bottom right -
    // not the Sinclair order, which puts the top left on bit 0.
    expect(BLOCK_GRAPHIC_UNICODE[0x81]).toBe('▝');
    expect(BLOCK_GRAPHIC_UNICODE[0x82]).toBe('▘');
    expect(BLOCK_GRAPHIC_UNICODE[0x84]).toBe('▗');
    expect(BLOCK_GRAPHIC_UNICODE[0x88]).toBe('▖');
    expect(BLOCK_GRAPHIC_UNICODE[0x80]).toBe(' ');
    expect(BLOCK_GRAPHIC_UNICODE[0x8f]).toBe('█');
  });

  it('names the twenty-five user-defined graphics A to Y', () => {
    expect(Object.keys(UDG_UNICODE)).toHaveLength(25);
    expect(UDG_UNICODE[0x90]).toBe('\u{1f130}');
    expect(UDG_UNICODE[0xa8]).toBe('\u{1f148}');
    // Either spelling reaches the same byte.
    expect(Array.from(samcoupeCharset.toMachine('\u{1f130}\\a\\Y'))).toEqual([
      0x90, 0x90, 0xa8,
    ]);
  });

  it('writes print-control sequences as brace directives', () => {
    expect(
      Array.from(samcoupeCharset.toMachine('{PEN 2}{AT 1,3}{TAB 7}')),
    ).toEqual([0x10, 2, 0x16, 1, 3, 0x17, 7, 0]);
    // INK is a spelling of PEN on this machine, in a directive as in a program.
    expect(Array.from(samcoupeCharset.toMachine('{INK 2}'))).toEqual([0x10, 2]);
    expect(samcoupeCharset.toUnicode([0x10, 2, 0x16, 1, 3])).toBe(
      '{PEN 2}{AT 1,3}',
    );
    // A TAB whose discarded second operand is not zero has no directive
    // spelling, so the byte stays raw rather than losing what follows it.
    expect(samcoupeCharset.toUnicode([0x17, 7, 9])).toBe('{0x17}{0x07}{0x09}');
    expect(Object.keys(CONTROL_CODES)).toHaveLength(8);
  });

  it('round-trips every byte, and rejects a character the machine lacks', () => {
    // 0x0D is the line terminator and decodes to a newline, which is not a
    // character the machine stores; every other byte must survive the trip.
    const codes = Array.from({ length: 256 }, (_, i) => i).filter(
      (c) => c !== 0x0d,
    );
    const text = samcoupeCharset.toUnicode(codes);
    expect(Array.from(samcoupeCharset.toMachine(text))).toEqual(codes);
    // Each byte on its own too, so a control code's operands cannot mask a gap.
    for (const code of codes) {
      const span = decodeSpan([code], 0, 1);
      expect(Array.from(parseChar(span.text, 0).codes), `code ${code}`).toEqual(
        [code],
      );
    }
    expect(() => samcoupeCharset.toMachine('€')).toThrow(CharsetError);
  });
});
