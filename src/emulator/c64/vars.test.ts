import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readC64Variables, decodeC64Float, type C64MemPort } from './vars';
import { C64Machine, type C64Roms } from './c64Machine';
import { commodore64 } from '../../dialects/commodore64';

/**
 * A byte-addressable fake of C64 RAM satisfying the read/readWord port. Helpers
 * lay out the zero-page pointers and scalar/array entries by hand. The byte
 * layouts here mirror what real CBM BASIC produces (cross-checked by the
 * real-ROM integration test below).
 */
function makeRam(): { ram: Uint8Array; mem: C64MemPort } {
  const ram = new Uint8Array(0x10000);
  const mem: C64MemPort = {
    read: (a) => ram[a]!,
    readWord: (a) => ram[a]! | (ram[a + 1]! << 8),
  };
  return { ram, mem };
}

const set = (ram: Uint8Array, addr: number, ...bytes: number[]) =>
  bytes.forEach((b, i) => (ram[addr + i] = b & 0xff));
const word = (n: number) => [n & 0xff, (n >> 8) & 0xff];

// MFLPT reals: exponent (excess-$80) first, then mantissa big-endian with the
// top mantissa bit standing in for the sign.
const REAL_5 = [0x83, 0x20, 0x00, 0x00, 0x00];
const REAL_7 = [0x83, 0x60, 0x00, 0x00, 0x00];
const REAL_NEG1 = [0x81, 0x80, 0x00, 0x00, 0x00];

describe('decodeC64Float', () => {
  it('decodes exponent-first 5-byte MFLPT reals', () => {
    expect(decodeC64Float([0x81, 0x00, 0x00, 0x00, 0x00])).toBe(1);
    expect(decodeC64Float(REAL_5)).toBe(5);
    expect(decodeC64Float(REAL_7)).toBe(7);
    expect(decodeC64Float(REAL_NEG1)).toBe(-1);
    expect(decodeC64Float([0, 0, 0, 0, 0])).toBe(0);
  });
});

describe('readC64Variables', () => {
  it('returns nothing when the variable area is empty', () => {
    const { ram, mem } = makeRam();
    set(ram, 0x2d, ...word(0x0900)); // VARTAB
    set(ram, 0x2f, ...word(0x0900)); // ARYTAB == VARTAB (no scalars)
    set(ram, 0x31, ...word(0x0900)); // STREND == ARYTAB (no arrays)
    expect(readC64Variables(mem)).toEqual([]);
  });

  it('decodes scalars (real, integer, string) and a number array', () => {
    const { ram, mem } = makeRam();
    const vartab = 0x0900;
    // 3 scalars × 7 bytes, then one array.
    const arytab = vartab + 3 * 7; // 0x0915
    set(ram, 0x2d, ...word(vartab));
    set(ram, 0x2f, ...word(arytab));

    // A = 5 (real): both name-byte high bits clear.
    set(ram, vartab, 0x41, 0x00, ...REAL_5);
    // B% = 42 (integer): both high bits set; value is signed 16-bit big-endian.
    set(ram, vartab + 7, 0xc2, 0x80, 0x00, 0x2a, 0x00, 0x00, 0x00);
    // C$ = "HI" (string): first high bit clear, second set; descriptor is
    // [len][ptrLo][ptrHi].
    set(ram, vartab + 14, 0x43, 0x80, 0x02, ...word(0x0a00), 0x00, 0x00);
    set(ram, 0x0a00, 0x48, 0x49); // PETSCII "HI"

    // DIM C(3) real array, element 1 = 7. Header (name 2 + offset 2 + ndim 1 +
    // one big-endian dim 2 = 7) then 4 reals; offset to next = 7 + 4*5 = 27.
    const arr = arytab;
    set(
      ram,
      arr,
      0x44, // 'D', real array
      0x00,
      ...word(27),
      1, // ndim
      0x00, // dim size big-endian: 4
      0x04,
      ...[0, 0, 0, 0, 0],
      ...REAL_7,
      ...[0, 0, 0, 0, 0],
      ...[0, 0, 0, 0, 0],
    );
    set(ram, 0x31, ...word(arr + 27)); // STREND past the one array

    expect(readC64Variables(mem)).toEqual([
      { name: 'A', kind: 'number', value: '5', ref: expect.anything() },
      { name: 'B%', kind: 'number', value: '42', ref: expect.anything() },
      { name: 'C$', kind: 'string', value: '"HI"', ref: expect.anything() },
      {
        name: 'D()',
        kind: 'number-array',
        value: '[3] = 0, 7, 0, 0',
        ref: expect.anything(),
      },
    ]);
  });

  it('skips DEF FN definitions (first high bit set, second clear)', () => {
    const { ram, mem } = makeRam();
    set(ram, 0x2d, ...word(0x0900));
    set(ram, 0x2f, ...word(0x0907));
    set(ram, 0x31, ...word(0x0907));
    set(ram, 0x0900, 0xc6, 0x00, 0, 0, 0, 0, 0); // FN F — must be skipped
    expect(readC64Variables(mem)).toEqual([]);
  });
});

const ROOT = join(__dirname, '../../../public/roms/c64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

describe('C64Machine.readVariables (real ROMs)', () => {
  it('reads program variables after running', async () => {
    const { image, errors } = commodore64.tokenize(
      '10 A=5\n20 B$="HI"\n30 DIM C(3)\n40 C(1)=7\n',
    );
    expect(errors).toEqual([]);
    const m = new C64Machine({ roms });
    await m.whenReady();
    m.loadProgram(image);
    // loadProgram queues its boot+inject on a microtask; let it finish.
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 300; i++) m.runFrame();

    const vars = m.readVariables();
    const byName = new Map(vars.map((v) => [v.name, v]));
    expect(byName.get('A')).toMatchObject({ kind: 'number', value: '5' });
    expect(byName.get('B$')).toMatchObject({ kind: 'string', value: '"HI"' });
    const arr = byName.get('C()');
    expect(arr?.kind).toBe('number-array');
    expect(arr?.value).toContain('[3]');
    expect(arr?.value).toContain('7');
    m.dispose();
  }, 30000);
});
