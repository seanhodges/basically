import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BbcMachine, configureNodeRomPath } from './bbcMachine';
import { tokenizeProgram } from '../../dialects/bbcmicro/tokenizer';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Mode-7 screen RAM (0x7C00–0x7FFF) as a string of printable characters. */
function screenText(machine: BbcMachine): string {
  let text = '';
  for (let addr = 0x7c00; addr < 0x8000; addr++) {
    const b = machine.processor.readmem(addr);
    text += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
  }
  return text;
}

/** Run frames (yielding to the microtask queue) until the predicate holds. */
async function runUntil(
  machine: BbcMachine,
  predicate: () => boolean,
  maxFrames = 500,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    // Let async work (ROM loads, the tokenizer pipeline) make progress.
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('BbcMachine (jsbeeb adapter)', () => {
  it('boots the OS to the BASIC banner in mode 7', async () => {
    const machine = new BbcMachine();
    await machine.whenReady();
    const booted = await runUntil(machine, () => {
      const text = screenText(machine);
      return text.includes('BBC Computer 32K') && text.includes('BASIC');
    });
    expect(booted).toBe(true);
    machine.dispose();
  }, 30000);

  it('loads and runs a BASIC program', async () => {
    const machine = new BbcMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO BEEB'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('feeds virtual-keyboard tokens into the key matrix', async () => {
    const machine = new BbcMachine();
    await machine.whenReady();
    await runUntil(machine, () =>
      screenText(machine).includes('BBC Computer 32K'),
    );
    machine.setKey('KeyA', true);
    for (let i = 0; i < 10; i++) machine.runFrame();
    machine.setKey('KeyA', false);
    for (let i = 0; i < 10; i++) machine.runFrame();
    // The prompt line now shows the typed character.
    expect(screenText(machine)).toContain('>A');
    machine.dispose();
  }, 30000);

  it('reads BASIC variables from a running program', async () => {
    const machine = new BbcMachine();
    const src =
      '10 A=5.5\n20 B%=42\n30 C$="HI"\n40 DIM D(3)\n50 D(1)=7\n55 DIM E(2,4)\n60 END\n';
    const { bytes } = tokenizeProgram(src);
    machine.loadProgram(bytes);
    // Key off the resident integer (high-confidence format) to know the
    // program has run, then snapshot everything.
    const ready = await runUntil(machine, () =>
      machine.readVariables().some((v) => v.name === 'B%' && v.value === '42'),
    );
    expect(ready).toBe(true);
    const vars = machine.readVariables();
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'A', kind: 'number', value: '5.5' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'B%', kind: 'number', value: '42' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'C$', kind: 'string', value: '"HI"' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({
        name: 'D(',
        kind: 'number-array',
        value: '[3] = 0, 7, 0, 0',
      }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'E(', kind: 'number-array' }),
    );
    machine.dispose();
  }, 60000);

  it('detects a runtime error after running a buggy program', async () => {
    const machine = new BbcMachine();
    // Referencing an undefined variable raises a BASIC error via BRK.
    const { bytes } = tokenizeProgram('10 PRINT zzq\n');
    machine.loadProgram(bytes);
    const faulted = await runUntil(machine, () => {
      const r = machine.readReport();
      return r !== null && r.isError;
    });
    expect(faulted).toBe(true);
    const report = machine.readReport()!;
    expect(report.isError).toBe(true);
    expect(report.message.length).toBeGreaterThan(0);
    machine.dispose();
  }, 60000);

  it('reports no error after a clean program', async () => {
    const machine = new BbcMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
    machine.loadProgram(bytes);
    await runUntil(machine, () => screenText(machine).includes('HELLO BEEB'));
    for (let i = 0; i < 20; i++) machine.runFrame();
    expect(machine.readReport()).toBeNull();
    machine.dispose();
  }, 60000);

  it('reports 896×600 as its visible display size', () => {
    const machine = new BbcMachine();
    expect(machine.displayWidth).toBe(896);
    expect(machine.displayHeight).toBe(600);
    machine.dispose();
  });
});
