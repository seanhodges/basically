import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MsxMachine, CPU_HZ } from './msxMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';
import { CURLIN, DIRECT_MODE, HIMEM, TXTTAB } from './workspace';
import { hb10pCharset } from '../../dialects/hb10p/charset';
import { tokenizeProgram } from '../../dialects/hb10p/tokenizer';
import { buildBasFile } from '../../dialects/hb10p/basfile';
import type { MsxModel } from './model';

/**
 * Acceptance tests for the real Sony HB-10P system ROM. The 32K image ships at
 * public/roms/msx/hb10p.rom under the terms in public/roms/ATTRIBUTION.md; the
 * suite skips if it is absent, so a checkout with the ROM removed stays green.
 *
 * This machine costs more per boot than any other here, and not because of the
 * emulation: MSX BASIC's own start-up delay loop is about three seconds of
 * emulated time, so a boot is nearly three hundred frames whatever the host
 * does. So there is one boot, and everything the ROM can answer is asked of
 * that machine in order. Everything that does not need the ROM - the VDP, the
 * bus, the PPI, the PSG and the key matrix - is tested next door for nothing.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/msx/hb10p.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);
const suite = hasRom ? describe : describe.skip;

const HB10P: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

/**
 * Frames a loop of two thousand iterations of an empty FOR takes to finish -
 * about a second and a half of emulated time, measured on this ROM. Long
 * enough that the machine is still running when loadProgram hands back, short
 * enough that waiting for the end is not most of the test.
 */
const PROGRAM_FRAMES = 150;

/** Frames to let a typed command take effect before reading the screen back. */
const COMMAND_FRAMES = 20;

const machine = (): MsxMachine =>
  new MsxMachine({ rom, model: HB10P, charset: hb10pCharset });

const screen = (m: MsxMachine): string =>
  m.readScreenText()?.lines.join('\n') ?? '';

/** Press a key for a few frames and release it, as a user would. */
function tap(m: MsxMachine, token: string): void {
  m.setKey(token, true);
  for (let i = 0; i < 3; i++) m.runFrame();
  m.setKey(token, false);
  for (let i = 0; i < 5; i++) m.runFrame();
}

suite('MsxMachine on the HB-10P system ROM', () => {
  it('boots to MSX BASIC, runs a program, and reads its own workspace back', () => {
    const m = machine();
    const source = [
      '10 FOR I=1 TO 2000',
      '20 NEXT I',
      '30 PRINT "DONE";I',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    m.loadProgram(buildBasFile(bytes));

    // The sign-on, which stays on screen above the program's own output. The
    // free-memory figure is the machine answering how much RAM it has: 28815
    // is the 64KB machine's, and a 16KB one would say 12431.
    const banner = screen(m);
    expect(banner).toContain('MSX BASIC version 1.0');
    expect(banner).toContain('Copyright 1983 by Microsoft');
    expect(banner).toContain('28815 Bytes free');

    // The workspace pointers, each confirmed against the booted ROM rather
    // than against a reference table.
    expect(m.bus.readRamWord(TXTTAB)).toBe(0x8001);
    expect(m.bus.readRamWord(HIMEM)).toBe(0xf380);

    // The program is running: loadProgram types RUN and hands back while the
    // loop is still going round.
    expect(m.isProgramRunning()).toBe(true);
    expect([10, 20]).toContain(m.currentLine());
    expect(m.bus.readRamWord(CURLIN)).not.toBe(DIRECT_MODE);

    let frames = 0;
    while (m.isProgramRunning() && frames < PROGRAM_FRAMES) {
      m.runFrame();
      frames++;
    }
    expect(m.isProgramRunning()).toBe(false);
    expect(m.currentLine()).toBe(null);
    expect(m.bus.readRamWord(CURLIN)).toBe(DIRECT_MODE);
    // The loop variable is one past its limit when NEXT falls through, and MSX
    // BASIC prints a leading space for a positive number.
    expect(screen(m)).toContain('DONE 2001');

    // The picture is live: text mode paints the backdrop everywhere and the
    // characters over it, so a frame with only one colour in it is a frame the
    // renderer never drew.
    const frame = m.frame;
    expect(frame.length).toBe(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    const colours = new Set<string>();
    for (let i = 0; i < frame.length; i += 4) {
      colours.add(`${frame[i]},${frame[i + 1]},${frame[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(1);

    // A debug slice is the same walk as a frame: both advance the BIOS frame
    // counter once, so neither loses or gains the machine's own time.
    const jiffy = (): number => m.bus.readRamWord(0xfc9e);
    const beforeRun = jiffy();
    for (let i = 0; i < 10; i++) m.runFrame();
    const perRun = jiffy() - beforeRun;
    const beforeStep = jiffy();
    for (let i = 0; i < 10; i++) {
      expect(
        m.debugStep({ mode: 'run', breakpoints: new Set(), fromLine: null }),
      ).toEqual({ paused: false, line: null });
    }
    expect(jiffy() - beforeStep).toBe(perRun);
    expect(perRun).toBe(10);

    // A graphics mode holds no characters, so the screen reader says so rather
    // than reporting whatever the name table happens to hold. The space is not
    // optional: MSX BASIC does not crunch, so SCREEN2 without it is a variable
    // name. And the graphics screen is up only for a moment - typed in direct
    // mode, MSX BASIC restores the text screen for its own prompt - so this
    // watches for the mode rather than waiting a fixed number of frames for it.
    for (const ch of 'SCREEN 2') {
      if (ch === ' ') tap(m, 'Space');
      else tap(m, ch >= '0' && ch <= '9' ? `Digit${ch}` : ch);
    }
    m.setKey('Return', true);
    for (let i = 0; i < 3; i++) m.runFrame();
    m.setKey('Return', false);
    let inGraphics: ReturnType<MsxMachine['readScreenText']> | undefined;
    for (let i = 0; i < COMMAND_FRAMES && inGraphics === undefined; i++) {
      m.runFrame();
      if (m.video.mode === 'graphic2') inGraphics = m.readScreenText();
    }
    expect(inGraphics).toBe(null);

    m.dispose();
    expect(m.isProgramRunning()).toBe(null);
  });

  it('runs its frame at the PAL MSX rate and its PSG at that rate too', () => {
    const m = machine();
    // 313 lines of 228 T-states off a 3.579545MHz clock: not 50Hz, and the
    // host paces the run loop on what this says rather than on a round number.
    expect(m.frameHz).toBeCloseTo(50.159, 3);
    expect(m.frameHz).toBe(CPU_HZ / (228 * 313));
    expect(m.audioSampleRate).toBeCloseTo(882 * m.frameHz, 3);
    expect(m.displayWidth).toBe(DISPLAY_WIDTH);
    expect(m.displayHeight).toBe(DISPLAY_HEIGHT);
    const ntsc = new MsxMachine({
      rom,
      model: { ...HB10P, region: 'ntsc' },
      charset: hb10pCharset,
    });
    expect(ntsc.frameHz).toBeCloseTo(59.923, 3);
    m.dispose();
    ntsc.dispose();
  });
});

describe('MsxMachine without a ROM', () => {
  it('constructs and runs frames on a blank image', () => {
    // The bundled image has no redistribution grant and is meant to be
    // removable, so the machine has to come up without one.
    const m = new MsxMachine({
      rom: new Uint8Array(0),
      model: HB10P,
      charset: hb10pCharset,
    });
    expect(() => m.runFrame()).not.toThrow();
    expect(m.isProgramRunning()).toBe(false);
    m.dispose();
  });
});
