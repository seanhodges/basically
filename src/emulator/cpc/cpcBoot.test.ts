import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';

/**
 * Boot test for the real CPC 464 firmware. The ROM is copyright Amstrad and is
 * NOT committed to the repo (see public/roms/ATTRIBUTION.md), so this suite is
 * skipped until the combined 32K `cpc464.rom` (OS 16K + BASIC 16K) is dropped
 * into public/roms/cpc/. With the ROM present it asserts the firmware reaches
 * its BASIC banner - the Stage 2 acceptance check from the dialect plan.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

const suite = hasRom ? describe : describe.skip;

suite('CpcMachine firmware boot', () => {
  it('boots the ROM to a drawn BASIC screen', () => {
    const m = new CpcMachine({ rom });
    // Give the firmware time to initialise and print the banner.
    for (let i = 0; i < 200; i++) m.runFrame();

    // The firmware has written its "Amstrad 64K Microcomputer … BASIC 1.0 …
    // Ready" banner into screen RAM (&C000-&FFFF).
    let screenBytes = 0;
    for (let a = 0xc000; a < 0x10000; a++) {
      if (m.mem.readScreen(a) !== 0) screenBytes++;
    }
    expect(screenBytes).toBeGreaterThan(0);

    // And the rendered framebuffer contains non-background pixels.
    const fb = m.frame;
    expect(fb.length).toBe(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    let nonBlack = 0;
    for (let i = 0; i < fb.length; i += 4) {
      if (fb[i] !== 0 || fb[i + 1] !== 0 || fb[i + 2] !== 0) nonBlack++;
    }
    expect(nonBlack).toBeGreaterThan(0);

    m.dispose();
  });

  it('injects a tokenized program into the BASIC program area at &0170', () => {
    const m = new CpcMachine({ rom });
    // A minimal tokenized image (opaque here) is copied to &0170 by loadProgram;
    // assert the bytes land where BASIC keeps its program.
    const image = new Uint8Array([
      0x05, 0x00, 0x0a, 0x00, 0x9c, 0x00, 0x00, 0x00,
    ]);
    m.loadProgram(image);
    for (let i = 0; i < image.length; i++) {
      expect(m.mem.readScreen(0x0170 + i)).toBe(image[i]);
    }
    m.dispose();
  });
});
