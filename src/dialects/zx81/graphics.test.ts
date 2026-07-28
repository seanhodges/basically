import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ZX81_GRAPHICS } from './graphics';
import { GRAPHIC_UNICODE } from './charset';

/**
 * Re-derive which key types which block graphic from the real ROM's keyboard
 * tables, so the palette teaches the machine's own keyboard rather than a
 * memory of it.
 *
 * The ROM keeps three 39-entry tables, indexed by the same key order the
 * keyboard matrix scans in (`KEYS` below) - the unshifted characters at
 * 0x007D+E, the shifted ones at 0x00A4+E, and the graphics ones at 0x00C7+E,
 * where E is 1-39 for a key and 40-78 for that key with SHIFT.
 *
 * The decode at 0x04DF is what ties them together. With `MODE` 2 (graphics) it
 * loads the key's character from the first two tables and, if that character is
 * below 0x40, simply sets bit 7 - the inverse-video form. A character of 0x40
 * or above (a token) takes the other branch and indexes the graphics table
 * instead. The twenty block graphics are therefore exactly the shifted keys
 * whose shifted meaning is a token, plus the solid block, which is unshifted
 * SPACE arriving as the inverse of 0x00.
 */

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/zx81.rom')),
);

/** Key order of the ROM's tables: the matrix rows, five keys each, SHIFT aside. */
const KEYS = [
  'Z','X','C','V',
  'A','S','D','F','G',
  'Q','W','E','R','T',
  '1','2','3','4','5',
  '0','9','8','7','6',
  'P','O','I','U','Y',
  'NEWLINE','L','K','J','H',
  'SPACE','.','M','N','B',
] as const; // prettier-ignore

const UNSHIFTED = 0x007d;
const SHIFTED = 0x00a4;
const GRAPHICS = 0x00c7;
/** The ROM's newline character, which the graphics branch handles separately. */
const NEWLINE = 0x76;
/** Characters below this are ordinary; 0x40 and above are keyword tokens. */
const TOKEN_FIRST = 0x40;

/** What graphics mode types for key index `i` (1-39), shifted or not. */
function graphicsModeCode(i: number, shift: boolean): number | null {
  const char = rom[(shift ? SHIFTED : UNSHIFTED) + i]!;
  if (char === NEWLINE) return null;
  if (char < TOKEN_FIRST) return char | 0x80; // inverse video
  // The graphics table is indexed by E, which carries the shift: SHIFT+key is
  // key index + 39, the same offset that picked the shifted character above.
  return rom[GRAPHICS + i + (shift ? KEYS.length : 0)]!;
}

describe('ZX81 graphics keys from the ROM keyboard tables', () => {
  /** key -> the graphics code that key types, derived from the ROM. */
  const derived = new Map<string, number>();
  for (const [i, key] of KEYS.entries()) {
    for (const shift of [false, true]) {
      const code = graphicsModeCode(i + 1, shift);
      if (code !== null && GRAPHIC_UNICODE[code] !== undefined)
        derived.set(key, code);
    }
  }

  it('puts a graphic on twenty keys plus the solid block on SPACE', () => {
    expect(derived.size).toBe(21);
    expect(derived.get('SPACE')).toBe(0x80);
  });

  it('agrees with the palette on every key', () => {
    const palette = new Map(ZX81_GRAPHICS.map((g) => [g.key, g.code]));
    expect(Object.fromEntries(palette)).toEqual(Object.fromEntries(derived));
  });

  it('shows each key the character the charset renders that code as', () => {
    for (const { key, code, char } of ZX81_GRAPHICS)
      expect(char, `key ${key}`).toBe(GRAPHIC_UNICODE[code]);
  });

  it('reaches every graphics code exactly once', () => {
    const codes = ZX81_GRAPHICS.map((g) => g.code).sort((a, b) => a - b);
    expect(codes).toEqual([...new Set(codes)]);
    expect(codes).toEqual(
      Object.keys(GRAPHIC_UNICODE)
        .map(Number)
        .sort((a, b) => a - b),
    );
  });
});
