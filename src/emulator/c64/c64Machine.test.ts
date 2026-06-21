import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { C64Machine, type C64Roms } from './c64Machine';
import { commodore64 } from '../../dialects/commodore64';

const ROOT = join(__dirname, '../../../public/roms/c64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

/** Read `len` bytes of screen RAM ($0400) as C64 screen codes. */
function screen(m: C64Machine, len = 1000): number[] {
  const c64 = m.machine!;
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(c64.wires.cpuRead(0x0400 + i));
  return out;
}

/** Screen codes: A–Z are 1–26, '.' is 46, space is 32. */
function screenCodes(s: string): number[] {
  return [...s].map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 64;
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

describe('C64Machine', () => {
  it('boots the real ROMs to the READY. prompt', async () => {
    const m = new C64Machine({ roms });
    await m.whenReady();
    for (let i = 0; i < 200; i++) m.runFrame();
    expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
    m.dispose();
  });

  it('loads and runs a program tokenized by the dialect', async () => {
    const { image, errors } = commodore64.tokenize('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    const m = new C64Machine({ roms });
    await m.whenReady();
    m.loadProgram(image);
    // loadProgram queues its boot+inject on a microtask; let it finish.
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 300; i++) m.runFrame();
    expect(contains(screen(m), screenCodes('HELLO'))).toBe(true);
    m.dispose();
  });

  it('detects a runtime error after running a buggy program', async () => {
    // GOTO a non-existent line raises ?UNDEF'D STATEMENT ERROR.
    const { image, errors } = commodore64.tokenize('10 GOTO 999\n');
    expect(errors).toEqual([]);
    const m = new C64Machine({ roms });
    await m.whenReady();
    m.loadProgram(image);
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 400; i++) m.runFrame();
    const report = m.readReport();
    expect(report).not.toBeNull();
    expect(report!.isError).toBe(true);
    expect(report!.message).toContain('ERROR');
    m.dispose();
  });

  it('reports no error after a clean program', async () => {
    const { image } = commodore64.tokenize('10 PRINT "HELLO"\n');
    const m = new C64Machine({ roms });
    await m.whenReady();
    m.loadProgram(image);
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 400; i++) m.runFrame();
    expect(m.readReport()).toBeNull();
    m.dispose();
  });
});
