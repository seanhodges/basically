import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atom } from './index';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

// The dedicated machine tests live in src/emulator/atom/atomMachine.test.ts;
// this checks the dialect ↔ emulator seam - the image the *dialect* produces
// is what the machine the dialect's createEmulator() hands back actually runs.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

function screenText(machine: AtomMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
}

describe('atom dialect → machine', () => {
  it('runs an image produced by the dialect tokenizer', async () => {
    const result = atom.tokenize('10 PRINT "DIALECT OK"\n20 END\n');
    expect(result.errors).toEqual([]);
    expect(result.image.length).toBe(result.byteSize);

    // Go through the dialect seam (opts are ignored: the jsbeeb adapter manages
    // its own ROMs and memory map). createEmulator's contract is the
    // MachineEmulator interface; here it is the AtomMachine, whose `processor`
    // screenText reads.
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
