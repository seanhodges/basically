import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atom } from './index';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

// The dedicated machine tests live in src/emulator/atom/atomMachine.test.ts;
// this checks the Stage 1 ↔ Stage 3 seam — the image the *dialect* produces is
// what the machine the dialect's createEmulator() hands back actually runs.
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

    // Go through the dialect seam wired up in Stage 3 (opts are ignored: the
    // jsbeeb adapter manages its own ROMs and memory map). createEmulator's
    // contract is the MachineEmulator interface; we know it is the AtomMachine,
    // whose `processor` screenText reads.
    const machine = atom.createEmulator({
      rom: new Uint8Array(0),
      ramKb: 32,
    }) as AtomMachine;
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
