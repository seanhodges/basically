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

describe('apple2 cassette seam', () => {
  const audio = apple2.audio!;

  it('decodes the tape audio it builds, straight through the dialect', () => {
    // The registry-driven `cassetteRoundTrip.test.ts` covers this for every
    // registered dialect; this machine is not registered yet, so the same bar
    // is held here until it is.
    const source = '10 A=1\n20 PRINT A\n30 GOTO 10';
    const samples = audio.buildSamples(source, 'TEST', false);
    const decoded = audio.decodeSamples!(samples, audio.sampleRate);
    expect(decoded.source).toBe(source);
    expect(decoded.warnings ?? []).toEqual([]);
    expect(apple2.tokenize(decoded.source).errors).toEqual([]);
  });

  it('tells the user to restate a workspace the tape cannot carry', () => {
    const instructions = audio.loadInstructions as (s: string) => string;
    // `LOAD` puts the program at the top of whatever workspace the machine
    // already has, so a program that moved its own has to say so first.
    expect(instructions('HIMEM:20480\n10 END')).toContain('HIMEM:20480');
    expect(instructions('10 END')).not.toContain('HIMEM');
    expect(instructions('10 END')).toContain('LOAD');
  });
});
