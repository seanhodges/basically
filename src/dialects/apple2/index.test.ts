// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apple2 } from './index';
import { FIRMWARE_BYTES } from './addresses';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple2.rom')),
);

describe('apple2 dialect', () => {
  it('builds a machine that boots the ROM and runs a program', () => {
    // The seam the app actually uses: everything below goes through `Dialect`,
    // never through the machine class, so a dialect wired to the wrong
    // interpreter support would fail here rather than in the emulator's tests.
    expect(apple2.romBytes).toBe(FIRMWARE_BYTES);
    expect(ROM).toHaveLength(FIRMWARE_BYTES);
    const machine = apple2.createEmulator({ rom: ROM, ramKb: 64 });
    try {
      machine.loadProgram(apple2.tokenize('10 PRINT "HI"\n20 END').image);
      let ended = false;
      for (let field = 0; field < 200 && !ended; field++) {
        machine.runFrame();
        ended = machine.isProgramRunning() === false;
      }
      expect(ended).toBe(true);
      expect(machine.readScreenText?.()?.lines.join('\n')).toContain('HI');
    } finally {
      machine.dispose();
    }
  });

  it('advertises the hi-res raster as its display size', () => {
    expect(apple2.displaySize).toEqual({ width: 280, height: 192 });
    expect(apple2.debuggable).toBe(true);
  });
});
