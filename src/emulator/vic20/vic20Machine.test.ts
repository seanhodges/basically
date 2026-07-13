import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vic20Machine } from './vic20Machine';
import type { Vic20Roms } from './memory';
import { tokenizeProgram } from '../../dialects/vic20/tokenizer';

const ROOT = join(__dirname, '../../../public/roms/vic20');
const roms: Vic20Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

/** Booting the real ROMs and running frames is slow; give a generous budget. */
const BOOT_TIMEOUT_MS = 20_000;

const SCREEN_BASE = 0x1e00;
const SCREEN_CELLS = 22 * 23;

/** Read the visible screen matrix as screen codes (high reverse-video bit off). */
function screen(m: Vic20Machine, len = SCREEN_CELLS): number[] {
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

/** Build the injectable .prg image (load address $1001 + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x10, ...program]);
}

describe('Vic20Machine', () => {
  it(
    'boots the BASIC V2 ROMs to the READY. prompt',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports the 3583-byte free memory figure at boot',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      // The unexpanded VIC-20 banner reads "3583 BYTES FREE".
      expect(contains(screen(m), screenCodes('3583 BYTES FREE'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'injects and runs a program that pokes the screen',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      // POKE screen-code 'A' (1) into the top-left screen cell, then loop so the
      // value stays put while we sample it.
      m.loadProgram(image('10 POKE 7680,1\n20 GOTO 20\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(m.peek(SCREEN_BASE)).toBe(1);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'runs a PRINT program and shows its output on screen',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('HI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
