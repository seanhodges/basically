import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Zx80Machine } from './zx80Machine';
import { renderDisplay } from './display';
import { VARS, E_LINE, D_FILE } from '../sysvars';

const ROM = new Uint8Array(
  readFileSync(path.resolve(__dirname, '../../../../public/roms/zx80.rom')),
);

/**
 * Foundation test for the ZX80 machine. The emulator wires the vendored Z80
 * core to the 4K ZX80 ROM with the ZX81-style display trick (minus the NMI
 * generator the ZX80 lacks). This proves the unmodified ROM boots and sets up
 * its system variables; the full BASIC load/run path is still being mapped
 * (see docs/dialect-roadmap.md and Zx80Machine.loadProgram).
 */
describe('Zx80Machine (foundation)', () => {
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
});
