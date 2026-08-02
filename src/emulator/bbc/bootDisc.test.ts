// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BbcMachine, configureNodeRomPath } from './bbcMachine';
import { buildBbcDisc, composeDiscFiles } from './bbcDisc';
import { tokenizeProgram } from '../../dialects/bbcmicro/tokenizer';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Mode-7 screen RAM (0x7C00-0x7FFF) as printable characters. */
function screenText(machine: BbcMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
}

async function runFrames(machine: BbcMachine, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    machine.runFrame();
    if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

/**
 * A self-contained auto-booting `.ssd`: one BASIC program plus a generated
 * `!BOOT` that `CHAIN`s it, boot option 3 (`*OPT 4,3` = exec `!BOOT`) - exactly
 * the shape {@link composeDiscFiles} writes, so SHIFT+BREAK runs the program.
 */
function bootableDisc(source: string): Uint8Array {
  const { bytes } = tokenizeProgram(source);
  const { files, bootOption } = composeDiscFiles(bytes, [], 'PROG', true);
  return buildBbcDisc(files, { title: 'PROG', bootOption });
}

describe('BbcMachine mount-and-boot of a preserved disc', () => {
  it('SHIFT+BREAK boots the disc so its own program runs', async () => {
    const disc = bootableDisc('10 PRINT "BOOTOK"\n20 GOTO 20\n');
    const machine = new BbcMachine();
    await machine.whenReady();
    machine.loadProgram(new Uint8Array(0), { bootDisc: disc });
    // loadProgram queues async work behind whenReady; give it frames to boot.
    const ok = await (async () => {
      for (let i = 0; i < 400; i++) {
        machine.runFrame();
        if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
        if (screenText(machine).includes('BOOTOK')) return true;
      }
      return screenText(machine).includes('BOOTOK');
    })();
    expect(ok).toBe(true);
    machine.dispose();
  }, 30000);

  it('ignores the passed image when a boot disc is given', async () => {
    // The image argument is a different program; the disc must win.
    const disc = bootableDisc('10 PRINT "FROMDISC"\n20 GOTO 20\n');
    const { bytes: otherImage } = tokenizeProgram('10 PRINT "FROMIMAGE"\n');
    const machine = new BbcMachine();
    await machine.whenReady();
    machine.loadProgram(otherImage, { bootDisc: disc });
    await runFrames(machine, 400);
    const text = screenText(machine);
    expect(text).toContain('FROMDISC');
    expect(text).not.toContain('FROMIMAGE');
    machine.dispose();
  }, 30000);
});
