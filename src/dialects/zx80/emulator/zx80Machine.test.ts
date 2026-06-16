import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Zx80Machine } from './zx80Machine';
import { renderDisplay } from './display';
import { VARS, E_LINE, D_FILE, DF_END } from '../sysvars';
import { Zx80Memory } from './memory';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import { NEWLINE } from '../charset';
import { tokenizeProgram } from '../tokenizer';
import { buildOFile } from '../ofile';

/** Read the whole display file back as a flat array of character codes. */
function displayBytes(machine: Zx80Machine): number[] {
  const dFile = machine.mem.readWord(D_FILE);
  const out: number[] = [];
  let addr = dFile;
  for (let i = 0; i < 24 * 33 + 1 && addr < 0x10000; i++, addr++) {
    out.push(machine.mem.read(addr));
  }
  return out;
}

/** True if the given run of character codes appears anywhere on screen. */
function displayContains(machine: Zx80Machine, needle: number[]): boolean {
  const d = displayBytes(machine);
  outer: for (let i = 0; i + needle.length <= d.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (d[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Read the first non-empty display-file row back as plain ASCII text. */
function firstTextRow(machine: Zx80Machine): string {
  const dFile = machine.mem.readWord(D_FILE);
  let addr = dFile;
  for (let row = 0; row < 24; row++) {
    let text = '';
    for (let col = 0; col < 32; col++) {
      const b = machine.mem.read(addr++);
      if (b === 0x76) break;
      const c = b & 0x7f;
      if (c >= 0x1c && c <= 0x25) text += String.fromCharCode(48 + (c - 0x1c));
      else if (c >= 0x26 && c <= 0x3f)
        text += String.fromCharCode(65 + (c - 0x26));
      else if (c !== 0) text += '?';
      else text += ' ';
    }
    if (text.trim() !== '') return text.trim();
  }
  return '';
}

const ROM = new Uint8Array(
  readFileSync(path.resolve(__dirname, '../../../../public/roms/zx80.rom')),
);

/**
 * Tests for the ZX80 machine. The emulator wires the vendored Z80 core to the
 * 4K ZX80 ROM with the ZX81-style display trick (minus the NMI generator the
 * ZX80 lacks). These prove the unmodified ROM boots and sets up its system
 * variables, and that the full tokenize → buildOFile → loadProgram → run path
 * produces the program's output on screen.
 */
describe('Zx80Machine', () => {
  it('rejects a ROM that is not 4K', () => {
    expect(
      () => new Zx80Machine({ rom: new Uint8Array(8192), ramKb: 16 }),
    ).toThrow();
  });

  it('boots the real ROM and initialises its system variables', () => {
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    for (let i = 0; i < 200; i++) machine.runFrame();

    const vars = machine.mem.readWord(VARS);
    const eLine = machine.mem.readWord(E_LINE);
    const dFile = machine.mem.readWord(D_FILE);

    // After boot the pointers form the ZX80's ascending layout in RAM:
    // VARS <= E_LINE < D_FILE, all above the 40-byte system-variable block.
    expect(vars).toBeGreaterThanOrEqual(0x4028);
    expect(eLine).toBeGreaterThanOrEqual(vars);
    expect(dFile).toBeGreaterThan(eLine);
    expect(dFile).toBeLessThan(0x8000);

    // The empty display file is 24 NEWLINE-terminated rows.
    let newlines = 0;
    for (let i = 0; i < 24; i++) {
      if (machine.mem.read(dFile + i) === 0x76) newlines++;
    }
    expect(newlines).toBe(24);

    machine.dispose();
  });

  it('renders a frame without throwing', () => {
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    for (let i = 0; i < 50; i++) machine.runFrame();
    const pixels = new Uint8ClampedArray(
      machine.displayWidth * machine.displayHeight * 4,
    );
    // Render directly via the exported helper to avoid a DOM canvas in node.
    expect(() =>
      renderDisplay(
        machine.mem,
        machine.mem.readWord(D_FILE),
        machine.mem.readWord(DF_END),
        pixels,
      ),
    ).not.toThrow();
    machine.dispose();
  });

  it('loads and auto-runs a program, producing its output', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT 6+7');
    expect(errors).toEqual([]);
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    machine.loadProgram(buildOFile(bytes));
    // After LOAD + RUN the program prints 13 to the display file.
    for (let i = 0; i < 40; i++) machine.runFrame();
    expect(firstTextRow(machine)).toBe('13');
    machine.dispose();
  });

  it('loads and runs a program that PRINTs a quoted string', () => {
    // Regression: the ZX80 quote is code 0x01, not the ZX81's 0x0B. With the
    // wrong quote code the ROM mis-parsed the string and filled the screen with
    // garbage; here the literal must render verbatim.
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"');
    expect(errors).toEqual([]);
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    machine.loadProgram(buildOFile(bytes));
    for (let i = 0; i < 40; i++) machine.runFrame();
    // H E L L O in ZX80 (= ZX81) letter codes.
    expect(displayContains(machine, [0x2d, 0x2a, 0x31, 0x31, 0x34])).toBe(true);
    machine.dispose();
  });

  it('stops rendering at DF_END instead of overrunning the display file', () => {
    // Regression: the ZX80 display file is collapsed and ends at DF_END. The
    // renderer used to draw a fixed 24 rows, spilling the program/edit area
    // above the display file onto the screen as garbage (a stray source
    // listing). It must stop at DF_END and leave later rows blank.
    const memory = new Zx80Memory(ROM, 16);
    const dfile = 0x4400;
    let a = dfile;
    // Two content rows: 'H'+NEWLINE, 'E'+NEWLINE.
    for (const b of [0x2d, NEWLINE, 0x2a, NEWLINE]) memory.write(a++, b);
    const dfEnd = a;
    // "Garbage" sitting immediately past DF_END that must NOT be drawn.
    for (const b of [0x3f, 0x3f, 0x3f, NEWLINE]) memory.write(a++, b);

    const pixels = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    renderDisplay(memory, dfile, dfEnd, pixels);

    expect(rowHasInk(pixels, 0)).toBe(true); // 'H'
    expect(rowHasInk(pixels, 1)).toBe(true); // 'E'
    expect(rowHasInk(pixels, 2)).toBe(false); // garbage past DF_END: blank
  });

  it('renders a looping PRINT program without garbage below its output', () => {
    // Full path: the hello sample prints 5 lines + a banner, then idles in a
    // delay loop (FOR J...NEXT J). During that idle the only on-screen content
    // is rows 0-7; everything below must stay blank (no source-listing spill).
    const src = [
      '10 REM HELLO',
      '20 CLS',
      '30 FOR I=1 TO 5',
      '40 PRINT "HELLO FROM THE ZX80"',
      '50 NEXT I',
      '60 PRINT',
      '70 PRINT "B A S I C A L L Y"',
      '80 FOR J=1 TO 2000',
      '90 NEXT J',
      '100 GOTO 20',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    machine.loadProgram(buildOFile(bytes));
    for (let i = 0; i < 60; i++) machine.runFrame();

    const pixels = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    renderDisplay(
      machine.mem,
      machine.mem.readWord(D_FILE),
      machine.mem.readWord(DF_END),
      pixels,
    );
    // Output occupies the top 8 character rows; the rest of the screen is blank.
    expect(rowHasInk(pixels, 1)).toBe(true); // a "HELLO" line
    for (let row = 8; row < 24; row++) {
      expect(rowHasInk(pixels, row)).toBe(false);
    }
    machine.dispose();
  });
});

/** True if any pixel in character row `row` (8px tall) is darker than white. */
function rowHasInk(pixels: Uint8ClampedArray, row: number): boolean {
  const y0 = row * 8;
  for (let y = y0; y < y0 + 8; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      if (pixels[(y * DISPLAY_WIDTH + x) * 4] < 0x80) return true;
    }
  }
  return false;
}
