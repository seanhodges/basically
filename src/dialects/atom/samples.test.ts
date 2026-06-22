import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atomSamples } from './samples';
import { atom } from './index';
import { tokenizeProgram } from './tokenizer';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** The Atom's MC6847 screen RAM (0x8000–0x83FF) as printable text. */
function screenText(machine: AtomMachine): string {
  let text = '';
  for (let addr = 0x8000; addr < 0x8400; addr++) {
    const code = machine.processor.readmem(addr) & 0x7f;
    const ascii = code < 0x20 ? code | 0x40 : code;
    text += ascii >= 0x20 && ascii < 0x7f ? String.fromCharCode(ascii) : ' ';
  }
  return text;
}

async function runUntil(
  machine: AtomMachine,
  predicate: () => boolean,
  maxFrames = 600,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('atom sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of atomSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('matches the canonical sample set shared with the other dialects', () => {
    expect(atomSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
  });

  it('hello is the starter offered for a fresh document', () => {
    expect(atom.samples[0]!.name).toBe('hello.bas');
  });

  it('hello runs on the real Atom and prints its banner', async () => {
    const hello = atomSamples.find((s) => s.name === 'hello.bas')!;
    const { bytes } = tokenizeProgram(hello.text);
    const machine = new AtomMachine();
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO FROM THE ATOM'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);
});
