import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PetMachine, type PetRoms } from './petMachine';
import type { Block } from '../../dialects/types';
import { tokenizeProgram } from '../../dialects/pet/tokenizer';

const ROOT = join(__dirname, '../../../public/roms/pet');
const roms: PetRoms = {
  basicB: readFileSync(join(ROOT, 'basic-4-b000.901465-23.bin')),
  basicC: readFileSync(join(ROOT, 'basic-4-c000.901465-20.bin')),
  basicD: readFileSync(join(ROOT, 'basic-4-d000.901465-21.bin')),
  editor: readFileSync(join(ROOT, 'edit-4-40-n-50Hz.901498-01.bin')),
  kernal: readFileSync(join(ROOT, 'kernal-4.901465-22.bin')),
  character: readFileSync(join(ROOT, 'characters-2.901447-10.bin')),
};

const BOOT_TIMEOUT_MS = 20_000;

const SCREEN_BASE = 0x8000;

/** Read `len` screen-RAM cells as screen codes. */
function screen(m: PetMachine, len = 1000): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(m.peek(SCREEN_BASE + i) & 0x7f);
  return out;
}

/** Screen codes: A–Z are 1–26. */
function screenCodes(s: string): number[] {
  return [...s].map((ch) =>
    ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 64 : 32,
  );
}

function contains(haystack: number[], needle: number[]): boolean {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((v, j) => haystack[i + j] === v)) return true;
  }
  return false;
}

/** Build the injectable .prg image (load address $0401 + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x04, ...program]);
}

describe('PetMachine memory blocks', () => {
  it(
    'writes a block into RAM before RUN, readable back at its address',
    async () => {
      const bytes = [0x11, 0x22, 0x33, 0x44, 0x55];
      const block: Block = {
        id: 'blk1',
        name: 'data1',
        address: 0x7000,
        bytes: Uint8Array.from(bytes),
        kind: 'memory',
      };
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'), { blocks: [block] });
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 200; i++) m.runFrame();
      for (let i = 0; i < bytes.length; i++) {
        expect(m.peek(0x7000 + i)).toBe(bytes[i]);
      }
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'loads normally when no blocks are supplied',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 200; i++) m.runFrame();
      // The block-less path still boots, injects and runs the program.
      expect(contains(screen(m), screenCodes('HI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
