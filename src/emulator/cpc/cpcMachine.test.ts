import { describe, expect, it } from 'vitest';
import { CpcMachine } from './cpcMachine';
import { CPC_ROM_SIZE } from './memory';

/** Build a 32K ROM whose lower half begins with `code`; the rest is zero. */
function romWith(code: number[]): Uint8Array {
  const rom = new Uint8Array(CPC_ROM_SIZE);
  rom.set(code, 0);
  return rom;
}

describe('CpcMachine construction', () => {
  it('constructs, resets and disposes cleanly with a blank ROM', () => {
    const m = new CpcMachine({ rom: new Uint8Array(CPC_ROM_SIZE) });
    expect(m.displayWidth).toBe(640);
    expect(m.displayHeight).toBe(400);
    expect(m.audioSampleRate).toBe(44100);
    expect(() => {
      m.runFrame();
      m.reset();
      m.dispose();
    }).not.toThrow();
  });
});

describe('CpcMachine CPU → memory → display pipeline', () => {
  it('runs ROM code that writes the screen and renders it', () => {
    // LD A,0xFF ; LD (0xC000),A ; HALT
    const m = new CpcMachine({
      rom: romWith([0x3e, 0xff, 0x32, 0x00, 0xc0, 0x76]),
    });
    m.runFrame();
    // The write reached screen RAM (write-through under the BASIC ROM overlay).
    expect(m.mem.readScreen(0xc000)).toBe(0xff);
    // Mode 1, byte 0xFF → four pen-3 pixels; pen 3 boots to Bright Red.
    const fb = m.frame;
    expect([fb[0], fb[1], fb[2], fb[3]]).toEqual([255, 0, 0, 255]);
  });
});

describe('CpcMachine raster interrupt delivery', () => {
  it('fires ~6 IM1 interrupts per frame into a ROM handler', () => {
    // Main: LD SP,0xB000 ; IM1 ; EI ; JR $ (spin with interrupts on).
    const main = [0x31, 0x00, 0xb0, 0xed, 0x56, 0xfb, 0x18, 0xfe];
    const rom = romWith(main);
    // RST &38 handler: bump a counter at &4000, then EI + RETI.
    rom.set(
      [0xf5, 0x3a, 0x00, 0x40, 0x3c, 0x32, 0x00, 0x40, 0xf1, 0xfb, 0xed, 0x4d],
      0x38,
    );
    const m = new CpcMachine({ rom });
    m.runFrame();
    const count = m.mem.readScreen(0x4000);
    // The Gate Array raises six interrupts across a 312-line frame; allow slack
    // for the VSYNC resync landing on a frame boundary.
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(7);
  });
});

describe('CpcMachine memory-activity overlay', () => {
  it('drains touched addresses only while recording is enabled', () => {
    const m = new CpcMachine({
      rom: romWith([0x3e, 0xff, 0x32, 0x00, 0xc0, 0x76]),
    });
    expect(m.drainMemoryActivity()).toBeNull(); // off by default
    m.setMemoryActivityRecording(true);
    m.runFrame();
    const hits = m.drainMemoryActivity();
    expect(hits).not.toBeNull();
    expect(hits!.length).toBe(0x10000);
    expect(hits![0xc000]! & 2).toBe(2); // the screen write was recorded
  });
});
