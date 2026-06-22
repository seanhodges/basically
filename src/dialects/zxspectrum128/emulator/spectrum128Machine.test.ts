import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Spectrum128Machine } from './spectrum128Machine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap } from '../tapfile';

const ROM_PATH = join(__dirname, '../../../../public/roms/zxspectrum128.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

/**
 * Map each ROM font glyph (8 bytes) to its char code, for OCR of the screen. The
 * 128 BASIC editor renders text with the 48 BASIC font, which lives at 0x3C00
 * within ROM 1 — file offset 0x4000 + 0x3C00.
 */
function fontSignatures(): Map<string, number> {
  const map = new Map<string, number>();
  for (let c = 32; c <= 127; c++) {
    const base = 0x4000 + 0x3c00 + c * 8;
    const sig = Array.from({ length: 8 }, (_, i) => rom[base + i]!).join(',');
    if (!map.has(sig)) map.set(sig, c);
  }
  return map;
}

function bitmapAddr(y: number, xb: number): number {
  return (
    0x4000 | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
  );
}

function readScreen(
  sigs: Map<string, number>,
  machine: Spectrum128Machine,
  row: number,
  col: number,
  len: number,
): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const xb = col + i;
    const bytes = Array.from({ length: 8 }, (_, r) =>
      machine.mem.readScreen(bitmapAddr(row * 8 + r, xb)),
    );
    const code = sigs.get(bytes.join(','));
    s += code === undefined ? '?' : String.fromCharCode(code);
  }
  return s;
}

// Stage 2 of docs/dialect-plans/zxspectrum128.md: boot the real 128 ROM, drive
// the menu to "128 BASIC", inject + run a program, and assert on the displayed
// bank. Skips cleanly when public/roms/zxspectrum128.rom is absent (it is not
// committed — see ATTRIBUTION.md and the plan's "do not commit a fabricated ROM").
const suite = hasRom ? describe : describe.skip;

suite('Spectrum128Machine (needs public/roms/zxspectrum128.rom)', () => {
  const SIGNATURES = fontSignatures();

  it('flash-loads and runs 10 PRINT "HELLO" via the 128 menu', () => {
    const machine = new Spectrum128Machine({ rom });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 50; i++) machine.runFrame();
    expect(readScreen(SIGNATURES, machine, 0, 0, 5)).toBe('HELLO');
  });

  it('runs a PLAY/paging program without faulting on the AY writes', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 PLAY "cde"\n20 PRINT "DONE"\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();
    expect(readScreen(SIGNATURES, machine, 0, 0, 4)).toBe('DONE');
  });

  it('reads program variables after running', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 LET A=5\n20 LET B$="HI"\n30 STOP\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();
    const byName = Object.fromEntries(
      machine.readVariables().map((v) => [v.name, v]),
    );
    expect(byName['A']).toMatchObject({ kind: 'number', value: '5' });
    expect(byName['B$']).toMatchObject({ kind: 'string', value: '"HI"' });
  });

  it('reports a runtime error after a buggy program', () => {
    const machine = new Spectrum128Machine({ rom });
    // Reading an undefined variable is report 2 ("Variable not found").
    const { bytes } = tokenizeProgram('10 PRINT a\n');
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 60; i++) machine.runFrame();
    const report = machine.readReport();
    expect(report.isError).toBe(true);
    expect(report.code).toBe('2');
  });

  it('pages RAM banks 0-7 and reads them back over the 0xC000 window', () => {
    const machine = new Spectrum128Machine({ rom });
    machine.reset();
    for (let bank = 0; bank < 8; bank++) {
      machine.mem.writePort7ffd(bank);
      machine.mem.write(0xc000, 0xa0 + bank);
    }
    for (let bank = 0; bank < 8; bank++) {
      machine.mem.writePort7ffd(bank);
      expect(machine.mem.read(0xc000)).toBe(0xa0 + bank);
    }
  });

  it('steps through a loop and pauses at a breakpoint', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 FOR i=1 TO 1000\n20 LET a=i\n30 NEXT i\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    const line = machine.currentLine();
    expect(line === 10 || line === 20 || line === 30).toBe(true);
    let hit: { paused: boolean; line: number | null } | null = null;
    for (let i = 0; i < 5000; i++) {
      const res = machine.debugStep({
        breakpoints: new Set([20]),
        mode: 'run',
        fromLine: null,
      });
      if (res.paused) {
        hit = res;
        break;
      }
    }
    expect(hit).toEqual({ paused: true, line: 20 });
  });
});
