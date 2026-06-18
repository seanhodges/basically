import { describe, expect, it } from 'vitest';
import { readBbcVariables, decodeBbcReal, type BbcMemPort } from './vars';

/**
 * A byte-addressable fake of 6502 RAM satisfying the read/readWord port. Helpers
 * lay out resident integers, the head-pointer table, and chain entries by hand.
 * The byte layouts here were verified against real jsbeeb in bbcMachine.test.ts.
 */
function makeRam(): { ram: Uint8Array; mem: BbcMemPort } {
  const ram = new Uint8Array(0x10000);
  const mem: BbcMemPort = {
    read: (a) => ram[a]!,
    readWord: (a) => ram[a]! | (ram[a + 1]! << 8),
  };
  return { ram, mem };
}

const set = (ram: Uint8Array, addr: number, ...bytes: number[]) =>
  bytes.forEach((b, i) => (ram[addr + i] = b & 0xff));
const word = (n: number) => [n & 0xff, (n >> 8) & 0xff];
/** Head-pointer table slot for a first character. */
const headSlot = (c: string) => 0x0480 + (c.charCodeAt(0) - 0x40) * 2;
/** BBC real bytes: exponent first (excess-&80), then mantissa big-endian. */
const REAL_5_5 = [0x83, 0x30, 0x00, 0x00, 0x00];
const REAL_7 = [0x83, 0x60, 0x00, 0x00, 0x00];
const REAL_NEG1 = [0x81, 0x80, 0x00, 0x00, 0x00];

describe('decodeBbcReal', () => {
  it('decodes exponent-first 5-byte reals', () => {
    expect(decodeBbcReal([0x81, 0x00, 0x00, 0x00, 0x00])).toBe(1);
    expect(decodeBbcReal(REAL_5_5)).toBe(5.5);
    expect(decodeBbcReal(REAL_7)).toBe(7);
    expect(decodeBbcReal(REAL_NEG1)).toBe(-1);
    expect(decodeBbcReal([0, 0, 0, 0, 0])).toBe(0);
  });
});

describe('readBbcVariables', () => {
  it('surfaces only non-zero resident integers A%–Z%', () => {
    const { ram, mem } = makeRam();
    set(ram, 0x0404, 42, 0, 0, 0); // A% = 42
    set(ram, 0x0468, 0xff, 0xff, 0xff, 0xff); // Z% = -1
    // B% left at 0 — must be skipped.
    expect(readBbcVariables(mem)).toEqual([
      { name: 'A%', kind: 'number', value: '42', ref: expect.anything() },
      { name: 'Z%', kind: 'number', value: '-1', ref: expect.anything() },
    ]);
  });

  it('decodes a real scalar from its chain', () => {
    const { ram, mem } = makeRam();
    set(ram, headSlot('G'), ...word(0x1900));
    set(ram, 0x1900, ...word(0), 0x00, ...REAL_5_5); // next=0, name "", value
    expect(readBbcVariables(mem)).toEqual([
      { name: 'G', kind: 'number', value: '5.5', ref: expect.anything() },
    ]);
  });

  it('decodes a dynamic (multi-char) integer', () => {
    const { ram, mem } = makeRam();
    set(ram, headSlot('N'), ...word(0x1900));
    // name rest "UM%" (full name "NUM%"), then 4-byte LE int 1000.
    set(ram, 0x1900, ...word(0), 0x55, 0x4d, 0x25, 0x00, ...word(1000), 0, 0);
    expect(readBbcVariables(mem)).toEqual([
      { name: 'NUM%', kind: 'number', value: '1000', ref: expect.anything() },
    ]);
  });

  it('decodes a string scalar via its descriptor', () => {
    const { ram, mem } = makeRam();
    set(ram, headSlot('H'), ...word(0x1900));
    // name rest "$", then descriptor: ptr(2) maxlen(1) len(1).
    set(ram, 0x1900, ...word(0), 0x24, 0x00, ...word(0x1a00), 4, 2);
    set(ram, 0x1a00, 0x48, 0x49); // "HI"
    expect(readBbcVariables(mem)).toEqual([
      { name: 'H$', kind: 'string', value: '"HI"', ref: expect.anything() },
    ]);
  });

  it('decodes a 1-D number array with a value preview', () => {
    const { ram, mem } = makeRam();
    set(ram, headSlot('D'), ...word(0x1900));
    // name rest "(", then descriptor: headerLen(3) + dim count(4), then 4 reals.
    set(
      ram,
      0x1900,
      ...word(0),
      0x28,
      0x00,
      3,
      ...word(4),
      ...[0, 0, 0, 0, 0],
      ...REAL_7,
      ...[0, 0, 0, 0, 0],
      ...[0, 0, 0, 0, 0],
    );
    expect(readBbcVariables(mem)).toEqual([
      {
        name: 'D(',
        kind: 'number-array',
        value: '[3] = 0, 7, 0, 0',
        ref: expect.anything(),
      },
    ]);
  });

  it('follows the chain across multiple entries and stops at a zero head', () => {
    const { ram, mem } = makeRam();
    set(ram, headSlot('A'), ...word(0x1900));
    set(ram, 0x1900, ...word(0x1910), 0x00, ...REAL_5_5); // A -> next 0x1910
    set(ram, 0x1910, ...word(0), 0x42, 0x00, ...REAL_7); // name "AB", value 7
    expect(readBbcVariables(mem).map((v) => v.name)).toEqual(['A', 'AB']);
  });

  it('returns nothing when every chain head is zero', () => {
    const { mem } = makeRam();
    expect(readBbcVariables(mem)).toEqual([]);
  });
});
