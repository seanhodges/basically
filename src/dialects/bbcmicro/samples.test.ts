import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { bbcSamples } from './samples';
import { bbcmicro } from './index';
import { tokenizeProgram } from './tokenizer';
import {
  BbcMachine,
  configureNodeRomPath,
} from '../../emulator/bbc/bbcMachine';

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

async function runUntil(
  machine: BbcMachine,
  predicate: () => boolean,
  maxFrames = 500,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('bbcmicro sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of bbcSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('matches the canonical sample set shared with the other dialects', () => {
    expect(bbcSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'breakout.bas',
      'dodger.bas',
      'circles.bas',
      'maze.bas',
    ]);
  });

  it('hello is the starter offered for a fresh document', () => {
    expect(bbcmicro.samples[0]!.name).toBe('hello.bas');
  });

  it('the mode-7 maze draws its walls in the emulator', async () => {
    const maze = bbcSamples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new BbcMachine();
    machine.loadProgram(bytes);
    // The maze prints a 9-row wall map, then the "REACH E TO WIN" prompt on the
    // line below it — so the prompt only appears once every wall row is drawn.
    const drawn = await runUntil(machine, () =>
      screenText(machine).includes('REACH E TO WIN'),
    );
    expect(drawn).toBe(true);
    // Teletext stores '#' as 0x5F (0x23 renders as '£'); count the wall cells.
    let walls = 0;
    for (let addr = 0x7c00; addr < 0x8000; addr++) {
      if (machine.processor.readmem(addr) === 0x5f) walls++;
    }
    expect(walls).toBeGreaterThan(40);
    machine.dispose();
  }, 60000);
});
