import { describe, expect, it } from 'vitest';
import {
  readSinclairScreenText,
  sinclairScreenChar,
  SINCLAIR_SCREEN_COLS,
  SINCLAIR_SCREEN_ROWS,
} from './sinclairScreenText';
import { zx81Charset } from './zx81/charset';

const NEWLINE = 0x76;
const DFILE = 0x4000;

/** A display file at {@link DFILE}: a leading NEWLINE, then the given rows. */
function display(rows: readonly (readonly number[])[]): (a: number) => number {
  const bytes = [NEWLINE, ...rows.flatMap((row) => [...row, NEWLINE])];
  return (addr) => bytes[addr - DFILE] ?? NEWLINE;
}

function read(rows: readonly (readonly number[])[]) {
  return readSinclairScreenText({
    read: display(rows),
    dfile: DFILE,
    charset: zx81Charset,
    newline: NEWLINE,
  });
}

describe('sinclairScreenChar', () => {
  it('reads an inverse graphics code as the shape it draws', () => {
    // 0x80 is inverse space, which is a solid block on the screen - a reader
    // that only ever masked bit 7 off would report it as a space and a maze
    // drawn out of them would come back blank.
    expect(sinclairScreenChar(zx81Charset, 0x80)).toBe('█');
  });

  it('reads an inverse letter as the letter it draws', () => {
    // An inverse letter has no character of its own (the charset spells it as
    // a `%A` escape), so the cell reports the letter rather than a marker.
    expect(sinclairScreenChar(zx81Charset, 0x26 | 0x80)).toBe(
      sinclairScreenChar(zx81Charset, 0x26),
    );
    expect(sinclairScreenChar(zx81Charset, 0x26)).toBe('A');
  });

  it('reads an inverse digit as the digit it draws', () => {
    // Every code the display file can hold folds into a glyph once bit 7 is
    // off, which is why the fallback is a mask rather than a lookup table.
    expect(sinclairScreenChar(zx81Charset, 0x1c | 0x80)).toBe('0');
  });
});

describe('readSinclairScreenText', () => {
  it('pads short rows and a short file out to the full rectangle', () => {
    const screen = read([[0x2d, 0x2a, 0x31, 0x31, 0x34]])!; // HELLO, nothing else
    expect(screen.cols).toBe(SINCLAIR_SCREEN_COLS);
    expect(screen.rows).toBe(SINCLAIR_SCREEN_ROWS);
    expect(screen.lines).toHaveLength(SINCLAIR_SCREEN_ROWS);
    for (const line of screen.lines) {
      expect([...line]).toHaveLength(SINCLAIR_SCREEN_COLS);
    }
    expect(screen.lines[0]).toBe('HELLO'.padEnd(SINCLAIR_SCREEN_COLS));
    expect(screen.lines[1]!.trim()).toBe('');
  });

  it('is null when the display-file pointer is not usable yet', () => {
    expect(
      readSinclairScreenText({
        read: () => 0,
        dfile: 0,
        charset: zx81Charset,
        newline: NEWLINE,
      }),
    ).toBeNull();
  });
});
