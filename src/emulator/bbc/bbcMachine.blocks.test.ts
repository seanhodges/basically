import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BbcMachine, configureNodeRomPath } from './bbcMachine';
import { tokenizeProgram } from '../../dialects/bbcmicro/tokenizer';
import type { Block } from '../../dialects/types';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Mode-7 screen RAM (0x7C00–0x7FFF) as a string of printable characters. */
function screenText(machine: BbcMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
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

describe('BbcMachine memory-block injection', () => {
  // A block of raw bytes at 0x2E00 (the dialects' defaultAddress) - below the
  // MODE 7 screen and clear of the tiny program, so nothing overwrites it.
  const BLOCK_ADDR = 0x2e00;
  const BLOCK_BYTES = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x42]);
  const block: Block = {
    id: 'b1',
    name: 'Code',
    address: BLOCK_ADDR,
    bytes: BLOCK_BYTES,
    kind: 'code',
  };

  for (const model of ['B', 'Master'] as const) {
    it(`writes a block into RAM before the program runs (${model})`, async () => {
      const machine = new BbcMachine(model);
      const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
      machine.loadProgram(bytes, { blocks: [block] });
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('HELLO BEEB'),
      );
      expect(ran).toBe(true);
      const readBack = Array.from(BLOCK_BYTES, (_, i) =>
        machine.processor.readmem(BLOCK_ADDR + i),
      );
      expect(readBack).toEqual(Array.from(BLOCK_BYTES));
      machine.dispose();
    }, 60000);
  }

  it('runs a program unchanged when no blocks are supplied', async () => {
    const machine = new BbcMachine('B');
    const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO BEEB'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);
});
