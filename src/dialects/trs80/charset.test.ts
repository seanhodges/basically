import { describe, expect, it } from 'vitest';
import { trs80Charset } from './charset';

describe('trs80 charset', () => {
  it('maps ASCII 0x20–0x7F to itself', () => {
    const text = '10 PRINT "HELLO, WORLD!"';
    expect(trs80Charset.toUnicode(trs80Charset.toMachine(text))).toBe(text);
  });

  it('preserves lower case as its own codes (Model III fidelity)', () => {
    // The old build folded a–z onto A–Z; the total charset keeps every byte
    // distinct so a Model III program round-trips its case.
    expect(Array.from(trs80Charset.toMachine('abc'))).toEqual([
      0x61, 0x62, 0x63,
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

  it('is total: every byte 0x00–0xFF round-trips decode → parse', () => {
    for (let b = 0; b <= 0xff; b++) {
      const text = trs80Charset.toUnicode([b]);
      const back = Array.from(trs80Charset.toMachine(text));
      expect(
        back,
        `byte 0x${b.toString(16)} via ${JSON.stringify(text)}`,
      ).toEqual([b]);
    }
  });

  it('escapes control codes, blank-graphics and compression codes', () => {
    expect(trs80Charset.toUnicode([0x00])).toBe('{0x00}');
    expect(trs80Charset.toUnicode([0x0c])).toBe('{0x0C}');
    expect(trs80Charset.toUnicode([0x7f])).toBe('{0x7F}');
    expect(trs80Charset.toUnicode([0x80])).toBe('{0x80}'); // blank graphics
    expect(trs80Charset.toUnicode([0xc0])).toBe('{0xC0}'); // compression code
    expect(trs80Charset.toUnicode([0xff])).toBe('{0xFF}');
  });

  it('escapes a literal { only when the following bytes read as an escape', () => {
    // A bare brace stays a brace; a brace that would start a valid escape is
    // itself escaped so the text round-trips.
    expect(trs80Charset.toUnicode([0x7b, 0x41, 0x7d])).toBe('{A}');
    const collide = [0x7b, 0x30, 0x78, 0x30, 0x43, 0x7d]; // "{0x0C}" as bytes
    expect(trs80Charset.toUnicode(collide)).toBe('{0x7B}0x0C}');
    expect(
      Array.from(trs80Charset.toMachine(trs80Charset.toUnicode(collide))),
    ).toEqual(collide);
  });
});
