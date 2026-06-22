import { describe, expect, it } from 'vitest';
import { trs80Charset } from './charset';

describe('trs80 charset', () => {
  it('maps ASCII 0x20–0x7F to itself', () => {
    const text = '10 PRINT "HELLO, WORLD!"';
    expect(trs80Charset.toUnicode(trs80Charset.toMachine(text))).toBe(text);
  });

  it('folds lower case onto the upper-case codes the Model I shows', () => {
    expect(Array.from(trs80Charset.toMachine('abc'))).toEqual([
      0x41, 0x42, 0x43,
    ]);
  });

  it('renders the block-graphics cells to Unicode sextant forms', () => {
    // 0x80 = blank pattern -> SPACE, 0xBF = full pattern -> full block.
    expect(trs80Charset.glyph(0x80)).toBe(' ');
    expect(trs80Charset.glyph(0xbf)).toBe('█');
    // 0x95 = 0b010101 left half, 0xAA = 0b101010 right half.
    expect(trs80Charset.glyph(0x95)).toBe('▌');
    expect(trs80Charset.glyph(0xaa)).toBe('▐');
    // 0xC0–0xFF repeat the same patterns as 0x80–0xBF.
    expect(trs80Charset.glyph(0xff)).toBe(trs80Charset.glyph(0xbf));
  });

  it('round-trips a block-graphics glyph through toMachine → toUnicode', () => {
    const glyph = trs80Charset.glyph(0x9a); // an arbitrary sextant
    expect(Array.from(trs80Charset.toMachine(glyph))).toEqual([0x9a]);
    expect(trs80Charset.toUnicode([0x9a])).toBe(glyph);
  });

  it('rejects characters with no TRS-80 equivalent', () => {
    expect(() => trs80Charset.toMachine('café')).toThrow();
  });
});
