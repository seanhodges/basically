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

  // BASIC IV keeps TIME$ as the TIME token (0x91) followed by a literal '$';
  // there is no dedicated token. Pin the byte output so it can't silently
  // regress into something the Master ROM wouldn't LIST back the same way.
  it('emits TIME$ as the TIME token + "$" and LISTs it back', () => {
    const { programBytes, image, errors } =
      bbcmaster.tokenize('10 PRINT TIME$\n');
    expect(errors).toEqual([]);
    const body = Array.from(programBytes);
    // …PRINT(0xF1) TIME(0x91) '$'(0x24)…
    expect(body).toContain(0x91);
    expect(body.indexOf(0x24)).toBe(body.indexOf(0x91) + 1);
    expect(bbcmaster.detokenize(image)).toBe('10 PRINT TIME$\n');
  });

  it('accepts TIME$= assignment (statement form) as BASIC IV', () => {
    const { image, errors } = bbcmaster.tokenize('10 TIME$="12:00:00"\n');
    expect(errors).toEqual([]);
    // TIME in statement position is 0xD1 (token + 0x40), then '$'.
    expect(Array.from(image)).toContain(0xd1);
    expect(bbcmaster.detokenize(image)).toBe('10 TIME$="12:00:00"\n');
  });

  it('tokenizes and detokenizes the BASIC IV EDIT keyword (0xCE)', () => {
    const { programBytes, image, errors } = bbcmaster.tokenize('10 EDIT 20\n');
    expect(errors).toEqual([]);
    expect(Array.from(programBytes)).toContain(0xce);
    expect(bbcmaster.detokenize(image)).toBe('10 EDIT 20\n');
  });

  it('accepts EXT#chan= as a statement (BASIC IV file-extent assignment)', () => {
    expect(bbcmaster.lint('10 EXT#1=1024\n')).toEqual([]);
  });
});

describe('BBC Micro (BASIC II) does not have the BASIC IV extras', () => {
  it('does not tokenize EDIT as a keyword and lints EXT# as a statement', async () => {
    const { bbcmicro } = await import('../bbcmicro/index');
    // EDIT is an ordinary (unassigned) name in BASIC II, so it lints.
    expect(bbcmicro.lint('10 EDIT 20\n').length).toBeGreaterThan(0);
    expect(bbcmicro.tokenize('10 EDIT 20\n').programBytes).not.toContain(0xce);
    expect(bbcmicro.lint('10 EXT#1=1024\n').length).toBeGreaterThan(0);
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
