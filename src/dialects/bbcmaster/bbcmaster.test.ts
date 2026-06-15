import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { bbcmaster } from './index';
import { getDialect } from '../registry';
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

/** Run frames (yielding to the microtask queue) until the predicate holds. */
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

describe('BBC Master dialect', () => {
  it('is registered', () => {
    expect(getDialect('bbcmaster')).toBe(bbcmaster);
  });

  it('reuses the BBC BASIC II tokenizer layout and round-trips', () => {
    const result = bbcmaster.tokenize('10 PRINT "HI"\n');
    expect(result.errors).toEqual([]);
    expect(Array.from(result.image.slice(0, 3))).toEqual([0x0d, 0x00, 0x0a]);
    expect(Array.from(result.image.slice(-2))).toEqual([0x0d, 0xff]);
    expect(result.image).toContain(0xf1); // PRINT token
    expect(bbcmaster.detokenize(result.image)).toBe('10 PRINT "HI"\n');
  });

  it('bundled samples lint clean', () => {
    for (const sample of bbcmaster.samples) {
      expect(bbcmaster.lint(sample.text)).toEqual([]);
    }
  });
});

describe('BbcMachine on the Master model', () => {
  it('loads and runs a BASIC program', async () => {
    const machine = new BbcMachine('Master');
    const { programBytes } = bbcmaster.tokenize(
      '10 PRINT "HELLO MASTER"\n20 END\n',
    );
    machine.loadProgram(programBytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO MASTER'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);
});
