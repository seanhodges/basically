import { describe, it, expect } from 'vitest';
import { readLocoVariables, type LocoMemPort } from './vars';
import { locoSysVars } from './sysvars';
import { encodeLocoFloat } from './numbers';

/**
 * Pure decoder tests over a hand-built RAM image mirroring the exact Locomotive
 * BASIC 1.0 variable layout verified against the real 464 ROM. These run without
 * the (copyright) ROM; the ROM-driven end-to-end checks live in
 * src/emulator/cpc/cpcIntrospection.test.ts.
 */
function makeMem(): {
  ram: Uint8Array;
  port: LocoMemPort;
  setWord: (addr: number, val: number) => void;
} {
  const ram = new Uint8Array(0x10000);
  const setWord = (addr: number, val: number) => {
    ram[addr] = val & 0xff;
    ram[addr + 1] = (val >> 8) & 0xff;
  };
  const port: LocoMemPort = {
    read: (addr) => ram[addr & 0xffff]!,
    readWord: (addr) => ram[addr & 0xffff]! | (ram[(addr + 1) & 0xffff]! << 8),
  };
  return { ram, port, setWord };
}

/** Name chars with bit 7 set on the last, as the ROM stores them. */
function nameBytes(name: string): number[] {
  return [...name].map((c, i) =>
    i === name.length - 1 ? c.charCodeAt(0) | 0x80 : c.charCodeAt(0),
  );
}

describe('readLocoVariables', () => {
  const sysvars = locoSysVars('basic10');

  it('decodes integer, real, string and array variables', () => {
    const { ram, port, setWord } = makeMem();

    // "HI" string characters the descriptor points at.
    ram[0x0100] = 'H'.charCodeAt(0);
    ram[0x0101] = 'I'.charCodeAt(0);

    let p = 0x0170;
    const emit = (bytes: number[]) => {
      for (const b of bytes) ram[p++] = b;
    };
    const prefix = [0x00, 0x00];

    // A = 3.5 (real, type 04)
    emit([...prefix, ...nameBytes('A'), 0x04, ...encodeLocoFloat(3.5)]);
    // B% = 5 (integer, type 01, 2-byte LE)
    emit([...prefix, ...nameBytes('B'), 0x01, 0x05, 0x00]);
    // C$ = "HI" (string, type 02: len + pointer)
    emit([...prefix, ...nameBytes('C'), 0x02, 0x02, 0x00, 0x01]);
    const arrStart = p;

    // Q(2) real array, Q(1) = 9: entry-length = dims(1)+dim(2)+3*5 = 18
    emit([
      ...prefix,
      ...nameBytes('Q'),
      0x04,
      18,
      0x00, // entry length (LE)
      0x01, // 1 dimension
      0x03,
      0x00, // 3 elements
      ...encodeLocoFloat(0),
      ...encodeLocoFloat(9),
      ...encodeLocoFloat(0),
    ]);
    const arrEnd = p;

    setWord(sysvars.varStart, 0x0170);
    setWord(sysvars.arrStart, arrStart);
    setWord(sysvars.arrEnd, arrEnd);

    const vars = readLocoVariables(port, sysvars);
    const byName = (n: string) => vars.find((v) => v.name === n);

    expect(byName('A')).toMatchObject({ kind: 'number', value: '3.5' });
    expect(byName('B%')).toMatchObject({ kind: 'number', value: '5' });
    expect(byName('C$')).toMatchObject({ kind: 'string', value: '"HI"' });
    expect(byName('Q()')).toMatchObject({
      kind: 'number-array',
      value: '[3] = 0, 9, 0',
    });
  });

  it('decodes multi-character names and negative integers', () => {
    const { ram, port, setWord } = makeMem();
    let p = 0x0170;
    const emit = (bytes: number[]) => {
      for (const b of bytes) ram[p++] = b;
    };
    // AB% = -7 (two-byte two's complement 0xFFF9)
    emit([0x00, 0x00, ...nameBytes('AB'), 0x01, 0xf9, 0xff]);
    const end = p;
    setWord(sysvars.varStart, 0x0170);
    setWord(sysvars.arrStart, end);
    setWord(sysvars.arrEnd, end);

    expect(readLocoVariables(port, sysvars)).toEqual([
      { name: 'AB%', kind: 'number', value: '-7' },
    ]);
  });

  it('returns nothing when the pointers are implausible (mid-boot)', () => {
    const { port, setWord } = makeMem();
    setWord(sysvars.varStart, 0x0200);
    setWord(sysvars.arrStart, 0x0100); // arrStart < varStart
    setWord(sysvars.arrEnd, 0x0100);
    expect(readLocoVariables(port, sysvars)).toEqual([]);
  });
});
