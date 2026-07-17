import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vic20Machine } from './vic20Machine';
import type { Vic20Roms } from './memory';
import type { MemoryBlock } from '../../dialects/types';
import { tokenizeProgram } from '../../dialects/vic20/tokenizer';

const ROOT = join(__dirname, '../../../public/roms/vic20');
const roms: Vic20Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

const BOOT_TIMEOUT_MS = 20_000;

/** Build the injectable .prg image (load address $1001 + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x10, ...program]);
}

describe('Vic20Machine memory blocks', () => {
  it(
    'writes a block into RAM before RUN, readable back at its address',
    async () => {
      const bytes = [0xde, 0xad, 0xbe, 0xef];
      const block: MemoryBlock = {
        id: 'blk1',
        name: 'data1',
        address: 0x1c00,
        bytes: Uint8Array.from(bytes),
        kind: 'data',
      };
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'), { blocks: [block] });
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      for (let i = 0; i < bytes.length; i++) {
        expect(m.peek(0x1c00 + i)).toBe(bytes[i]);
      }
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'loads normally when no blocks are supplied',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      // No block was supplied, so this user-RAM byte stays at its power-on zero.
      expect(m.peek(0x1c00)).toBe(0);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
