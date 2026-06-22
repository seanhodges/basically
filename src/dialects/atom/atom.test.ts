import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atom } from './index';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

// The dedicated machine tests live in src/emulator/atom/atomMachine.test.ts;
// this checks the Stage 1 ↔ Stage 2 seam — the image the *dialect* produces is
// what the AtomMachine actually runs. (createEmulator itself is wired in
// Stage 3, so the machine is constructed directly here.)
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

function screenText(machine: AtomMachine): string {
  let text = '';
  for (let addr = 0x8000; addr < 0x8400; addr++) {
    const code = machine.processor.readmem(addr) & 0x7f;
    const ascii = code < 0x20 ? code | 0x40 : code;
    text += ascii >= 0x20 && ascii < 0x7f ? String.fromCharCode(ascii) : ' ';
  }
  return text;
}

describe('atom dialect → machine', () => {
  it('runs an image produced by the dialect tokenizer', async () => {
    const result = atom.tokenize('10 PRINT "DIALECT OK"\n20 END\n');
    expect(result.errors).toEqual([]);
    expect(result.image.length).toBe(result.byteSize);

    const machine = new AtomMachine();
    machine.loadProgram(result.image);
    let ran = false;
    for (let i = 0; i < 600 && !ran; i++) {
      machine.runFrame();
      if (screenText(machine).includes('DIALECT OK')) ran = true;
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);
});
