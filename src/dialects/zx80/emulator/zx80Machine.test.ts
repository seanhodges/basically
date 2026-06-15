import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Zx80Machine } from './zx80Machine';
import { renderDisplay } from './display';
import { VARS, E_LINE, D_FILE } from '../sysvars';
import { tokenizeProgram } from '../tokenizer';
import { buildOFile } from '../ofile';

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
      renderDisplay(machine.mem, machine.mem.readWord(D_FILE), pixels),
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
});
