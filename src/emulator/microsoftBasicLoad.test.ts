import { describe, expect, it } from 'vitest';
import { loadMicrosoftBasicProgram } from './microsoftBasicLoad';
import type { MemoryBlock } from '../dialects/types';

/** A 64K address space that records the order it was written in. */
function fakeMemory() {
  const bytes = new Uint8Array(0x10000);
  const order: string[] = [];
  return {
    bytes,
    order,
    write(address: number, value: number) {
      bytes[address] = value;
      order.push(`write ${address}`);
    },
    writeWord(address: number, value: number) {
      bytes[address] = value & 0xff;
      bytes[address + 1] = value >> 8;
      order.push(`word ${address}`);
    },
  };
}

const block = (address: number, bytes: number[]): MemoryBlock => ({
  id: 'b',
  name: 'blk',
  address,
  bytes: Uint8Array.from(bytes),
  kind: 'code',
});

describe('loadMicrosoftBasicProgram', () => {
  it('writes the image at the program base and sets the workspace words', () => {
    const memory = fakeMemory();
    loadMicrosoftBasicProgram(memory, Uint8Array.from([0xaa, 0xbb]), {
      programBase: 0x1000,
      pointers: [
        { address: 0x40a4, value: 0x1000 },
        { address: 0x40a6, value: 0x1002 },
      ],
      typeRun: () => {},
    });
    expect([...memory.bytes.subarray(0x1000, 0x1002)]).toEqual([0xaa, 0xbb]);
    expect([...memory.bytes.subarray(0x40a4, 0x40a8)]).toEqual([
      0x00, 0x10, 0x02, 0x10,
    ]);
  });

  it('pokes blocks after the program and its pointers, before RUN', () => {
    const memory = fakeMemory();
    const seen: string[] = [];
    loadMicrosoftBasicProgram(memory, Uint8Array.from([1]), {
      programBase: 0x1000,
      pointers: [{ address: 0x40a4, value: 0x1000 }],
      blocks: [block(0x8000, [0x11, 0x22])],
      typeRun: () => seen.push('run'),
    });
    expect([...memory.bytes.subarray(0x8000, 0x8002)]).toEqual([0x11, 0x22]);
    expect(memory.order).toEqual([
      'write 4096',
      'word 16548',
      'write 32768',
      'write 32769',
    ]);
    expect(seen).toEqual(['run']);
  });

  it('wraps a block that runs off the top of the address space', () => {
    const memory = fakeMemory();
    loadMicrosoftBasicProgram(memory, new Uint8Array(0), {
      programBase: 0x1000,
      pointers: [],
      blocks: [block(0xffff, [0x11, 0x22])],
      typeRun: () => {},
    });
    expect(memory.bytes[0xffff]).toBe(0x11);
    expect(memory.bytes[0x0000]).toBe(0x22);
  });

  it('still types RUN for a document with no blocks', () => {
    let ran = false;
    loadMicrosoftBasicProgram(fakeMemory(), new Uint8Array(0), {
      programBase: 0,
      pointers: [],
      typeRun: () => {
        ran = true;
      },
    });
    expect(ran).toBe(true);
  });
});
