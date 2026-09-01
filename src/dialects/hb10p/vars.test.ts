import { describe, expect, it } from 'vitest';
import { readVariables } from './vars';
import { parseNumber } from './numbers';
import {
  ARYTAB,
  DEFTBL,
  STREND,
  VARTAB,
  type MsxMemPort,
} from '../../emulator/msx/workspace';

/**
 * Pure decoder tests over a hand-built RAM image in the exact MSX BASIC layout
 * read off the booted HB-10P. These need no ROM; the end-to-end walk of a real
 * program's storage is in src/emulator/msx/introspection.test.ts.
 */
function makeMem(): {
  ram: Uint8Array;
  port: MsxMemPort;
  setWord: (addr: number, value: number) => void;
} {
  const ram = new Uint8Array(0x10000);
  const setWord = (addr: number, value: number) => {
    ram[addr] = value & 0xff;
    ram[addr + 1] = (value >> 8) & 0xff;
  };
  // Every letter defaults to double, as a clean boot leaves it.
  ram.fill(8, DEFTBL, DEFTBL + 26);
  return {
    ram,
    port: {
      peek: (addr) => ram[addr & 0xffff]!,
      peekWord: (addr) =>
        ram[addr & 0xffff]! | (ram[(addr + 1) & 0xffff]! << 8),
    },
    setWord,
  };
}

/** A float's stored bytes: the tokenizer's own encoder, less its type token. */
function floatBytes(literal: string): number[] {
  return parseNumber(literal, 0)!.bytes.slice(1);
}

const name = (text: string): number[] => [
  text.charCodeAt(0),
  text.length > 1 ? text.charCodeAt(1) : 0,
];

describe('hb10p variable reader', () => {
  it('reads all four value types, including double precision', () => {
    const { ram, port, setWord } = makeMem();
    ram.set([0x48, 0x49], 0x9000); // the characters "HI" a descriptor points at

    let p = 0x8100;
    const emit = (bytes: number[]) => {
      for (const b of bytes) ram[p++] = b;
    };
    // A% = -2 (integer, 2 bytes signed LE)
    emit([2, ...name('A'), 0xfe, 0xff]);
    // BB = 1.5 (double: the default type, so it shows with no suffix)
    emit([8, ...name('BB'), ...floatBytes('1.5#')]);
    // C! = 2.5 (single, the type an unsuffixed value would NOT get here)
    emit([4, ...name('C'), ...floatBytes('2.5')]);
    // D$ = "HI" (a three-byte descriptor: length then address)
    emit([3, ...name('D'), 2, 0x00, 0x90]);
    setWord(VARTAB, 0x8100);
    setWord(ARYTAB, p);
    setWord(STREND, p);

    expect(readVariables(port)).toEqual([
      { name: 'A%', kind: 'number', value: '-2' },
      { name: 'BB', kind: 'number', value: '1.5' },
      { name: 'C!', kind: 'number', value: '2.5' },
      { name: 'D$', kind: 'string', value: '"HI"' },
    ]);
  });

  it('takes each name’s suffix from the default-type table', () => {
    // MSX BASIC stores no suffix: DEFINT/DEFSNG/DEFDBL decide which type a bare
    // name means, so the same integer entry is `Z` after DEFINT Z and `A%`
    // under the boot default.
    const { ram, port, setWord } = makeMem();
    ram[DEFTBL + 25] = 2; // DEFINT Z
    let p = 0x8100;
    for (const b of [
      2,
      ...name('Z'),
      7,
      0,
      8,
      ...name('Z2'),
      ...floatBytes('3#'),
    ])
      ram[p++] = b;
    setWord(VARTAB, 0x8100);
    setWord(ARYTAB, p);
    setWord(STREND, p);

    expect(readVariables(port).map((v) => v.name)).toEqual(['Z', 'Z2#']);
  });

  it('walks arrays, reporting the shape the program DIMmed', () => {
    const { ram, port, setWord } = makeMem();
    let p = 0x8100;
    const emit = (bytes: number[]) => {
      for (const b of bytes) ram[p++] = b;
    };
    setWord(VARTAB, p);
    setWord(ARYTAB, p);
    // DIM E%(1,2): six 2-byte elements, bounds stored last dimension first.
    const elements = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    emit([2, ...name('E'), 1 + 4 + elements.length, 0, 2, 3, 0, 2, 0]);
    emit(elements);
    setWord(STREND, p);

    expect(readVariables(port)).toEqual([
      {
        name: 'E%()',
        kind: 'number-array',
        value: '[2,3] = 3, 0, 0, 0, 0, 0',
      },
    ]);
  });

  it('says nothing while the pointers are implausible', () => {
    // Mid-boot and mid-injection both leave the three pointers out of order,
    // and a walk started then would report the last program's storage.
    const { port, setWord } = makeMem();
    setWord(VARTAB, 0x8200);
    setWord(ARYTAB, 0x8100);
    setWord(STREND, 0x8100);
    expect(readVariables(port)).toEqual([]);
  });

  it('stops at a type byte the interpreter could not have written', () => {
    // A stride taken from a corrupt byte would walk off into the arrays and
    // print whatever it found, so an unknown type ends the walk instead.
    const { ram, port, setWord } = makeMem();
    let p = 0x8100;
    for (const b of [2, ...name('A'), 1, 0, 6, ...name('B'), 0, 0, 0, 0, 0, 0])
      ram[p++] = b;
    setWord(VARTAB, 0x8100);
    setWord(ARYTAB, p);
    setWord(STREND, p);
    expect(readVariables(port).map((v) => v.name)).toEqual(['A%']);
  });
});
