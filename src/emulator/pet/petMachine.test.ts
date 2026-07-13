import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PetMachine, type PetRoms } from './petMachine';
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

/**
 * Booting the real ROMs and running frames is slow, so give these cases a
 * generous per-test budget (the boot dominates every one).
 */
const BOOT_TIMEOUT_MS = 20_000;

const SCREEN_BASE = 0x8000;

/** Read `len` screen-RAM cells as screen codes. */
function screen(m: PetMachine, len = 1000): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(m.peek(SCREEN_BASE + i) & 0x7f);
  return out;
}

/** Screen codes: A–Z are 1–26, '0'–'9' are 48–57, '.' is 46, space is 32. */
function screenCodes(s: string): number[] {
  return [...s].map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 64;
    if (ch >= '0' && ch <= '9') return ch.charCodeAt(0);
    if (ch === '.') return 46;
    return 32;
  });
}

function contains(haystack: number[], needle: number[]): boolean {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Build the injectable .prg image (load address + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x04, ...program]);
}

describe('PetMachine', () => {
  it(
    'boots the BASIC 4.0 ROMs to the READY. prompt',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports the 31743-byte free memory figure at boot',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      // The BASIC 4.0 banner reads "31743 BYTES FREE".
      expect(contains(screen(m), screenCodes('31743 BYTES FREE'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'injects and runs a program that pokes the screen',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      // POKE the screen-code for 'A' (1) into the top-left screen cell, then
      // sit in a loop so the value stays put while we sample it.
      m.loadProgram(image('10 POKE 32768,1\n20 GOTO 20\n'));
      // loadProgram boots + injects synchronously on the ready microtask; run
      // frames to let RUN take and the program execute.
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(m.peek(SCREEN_BASE)).toBe(1);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'runs a PRINT program and shows its output on screen',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('HI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
