import { describe, expect, it } from 'vitest';
import { c64Charset } from './charset';

describe('C64 PETSCII charset', () => {
  it('round-trips upper-case BASIC text', () => {
    const text = '10 PRINT "HELLO, WORLD!"';
    expect(c64Charset.toUnicode(c64Charset.toMachine(text))).toBe(text);
  });

  it('folds lower case onto the upper-case default set', () => {
    expect(Array.from(c64Charset.toMachine('abc'))).toEqual([0x41, 0x42, 0x43]);
  });

  it('maps the C64-specific glyphs to their PETSCII codes', () => {
    expect(Array.from(c64Charset.toMachine('£↑←π'))).toEqual([
      0x5c, 0x5e, 0x5f, 0xff,
    ]);
    expect(c64Charset.toUnicode([0x5c, 0x5e, 0x5f, 0xff])).toBe('£↑←π');
  });

  it('rejects characters with no C64 equivalent', () => {
    expect(() => c64Charset.toMachine('10 PRINT "█"')).toThrow();
  });
});
