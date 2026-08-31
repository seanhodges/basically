// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Apple2Machine } from './apple2Machine';
import { RESET_TOKEN } from './keyboard';
import {
  LORES_PALETTE,
  CELL_WIDTH,
  LORES_BLOCK_HEIGHT,
  hiresLineAddress,
  textRowAddress,
} from './display';
import { CYCLES_PER_FIELD, FIELD_HZ } from './timing';
import { apple2 } from '../../dialects/apple2';
import { integerBasicSupport } from '../../dialects/apple2/machineSupport';
import {
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  DISPLAY_WIDTH,
  FIRMWARE_BYTES,
  HIMEM,
  HIRES_PAGE1,
  LOMEM,
  PP,
  PV,
  TEXT_PAGE1,
} from '../../dialects/apple2/addresses';

/**
 * The firmware ships, so these read it rather than skipping when it is absent.
 * Everything below is the machine's own answer to a question asked at its
 * keyboard or read back out of its RAM, not an expectation about the adapter.
 */
const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple2.rom')),
);

/** Tokens for the characters these tests type at the virtual keyboard. */
const TOKENS: Record<string, string> = {
  ' ': 'Space',
  '\r': 'Enter',
  ':': 'Colon',
  '-': 'Minus',
  ',': 'Comma',
};
/** Characters that need SHIFT, and the key that carries them. */
const SHIFTED: Record<string, string> = { '"': 'Digit2', '=': 'Minus' };

function machine(rom: Uint8Array = ROM): Apple2Machine {
  return new Apple2Machine({ rom, basic: integerBasicSupport });
}

/** Type at the virtual keyboard, then give the machine time to answer. */
function type(m: Apple2Machine, text: string, fields: number): void {
  for (const ch of text) {
    const shifted = SHIFTED[ch];
    const token =
      shifted ?? TOKENS[ch] ?? (/[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch}`);
    if (shifted) m.setKey('Shift', true);
    m.setKey(token, true);
    m.setKey(token, false);
    if (shifted) m.setKey('Shift', false);
  }
  for (let field = 0; field < fields; field++) m.runFrame();
}

/** Run a source through the dialect and hand the machine the image. */
function load(m: Apple2Machine, source: string): void {
  const { image, errors } = apple2.tokenize(source);
  expect(errors).toEqual([]);
  m.loadProgram(image);
}

/** Run until `done`, returning the fields it took, or -1 if it never did. */
function runUntil(m: Apple2Machine, done: () => boolean, cap: number): number {
  for (let field = 0; field < cap; field++) {
    m.runFrame();
    if (done()) return field + 1;
  }
  return -1;
}

/** The visible text as one string, whatever mode the machine is in. */
function screen(m: Apple2Machine): string {
  return (m.readScreenText()?.lines ?? []).join('\n');
}

/** One pixel of the graphics raster, as an RGB triple. */
function pixel(m: Apple2Machine, x: number, y: number): number[] {
  const raster = m.video.renderRaster(m.mem.mem, m.displayMode.mode);
  const i = (y * DISPLAY_WIDTH + x) * 4;
  return [raster[i]!, raster[i + 1]!, raster[i + 2]!];
}

describe('Apple2Machine', () => {
  it('runs at the field rate the video counters imply, not at 60Hz', () => {
    // 65 cycles a line, 262 lines, and one cycle a line stretched by two master
    // clocks: 14318180 / (912 x 262).
    expect(CYCLES_PER_FIELD).toBe(65 * 262);
    expect(FIELD_HZ).toBeCloseTo(59.9227, 3);
    const m = machine();
    expect(m.frameHz).toBe(FIELD_HZ);
    expect(m.displayWidth).toBe(280);
    expect(m.displayHeight).toBe(192);
    // Samples per field times the field rate, which is what the host consumes
    // at - not the 44100 the synthesis was designed around.
    expect(m.audioSampleRate).toBeCloseTo(44103, 0);
  });

  it('resets into the monitor and starts BASIC when it is asked to', () => {
    const m = machine();
    // The original monitor is fitted, so RESET lands at `*` rather than
    // restarting anything - which is the machine this dialect is.
    expect(runUntil(m, () => screen(m).includes('*'), 30)).toBeGreaterThan(0);
    expect(screen(m)).not.toContain('>');

    m.bootToBasic();
    expect(screen(m)).toContain('>');
    expect(m.mem.peekWord(LOMEM)).toBe(DEFAULT_LOMEM);
    expect(m.mem.peekWord(HIMEM)).toBe(DEFAULT_HIMEM);
    // Nothing stored yet: the program area is empty, so it starts at the top.
    expect(m.mem.peekWord(PP)).toBe(DEFAULT_HIMEM);
    expect(m.mem.peekWord(PV)).toBe(DEFAULT_LOMEM);
  });

  it('stores a typed line exactly as the dialect tokenizes it', () => {
    const m = machine();
    m.bootToBasic();
    type(m, '10 PRINT "HI"\r', 60);
    expect(screen(m)).toContain('10 PRINT "HI"');

    const pp = m.mem.peekWord(PP);
    const stored = m.mem.mem.subarray(pp, m.mem.peekWord(HIMEM));
    expect([...stored]).toEqual([
      ...apple2.tokenize('10 PRINT "HI"').programBytes,
    ]);
    // The program grows down from HIMEM, so storing a line moves PP.
    expect(pp).toBeLessThan(DEFAULT_HIMEM);
  });

  it('injects a program, runs it, and says when the run is over', () => {
    const m = machine();
    load(m, '10 PRINT "HELLO"\n20 END');
    // Not answerable between the hand-over and BASIC reading the injected RUN.
    expect(m.isProgramRunning()).toBeNull();
    expect(
      runUntil(m, () => m.isProgramRunning() === false, 200),
    ).toBeGreaterThan(0);
    expect(screen(m)).toContain('HELLO');
    // ...and on the text page itself, at the interleaved address of its row.
    const row = screen(m)
      .split('\n')
      .findIndex((line) => line.startsWith('HELLO'));
    expect(m.mem.peek(textRowAddress(TEXT_PAGE1, row))).toBe(
      'H'.charCodeAt(0) | 0x80,
    );

    const stats = m.readMemoryStats();
    expect(stats?.used).toBeGreaterThan(0);
    expect((stats?.used ?? 0) + (stats?.free ?? 0)).toBe(
      DEFAULT_HIMEM - DEFAULT_LOMEM,
    );
  });

  it('names the line it is executing, and pauses on a breakpoint', () => {
    const m = machine();
    load(m, '10 FOR I=1 TO 200\n20 X=I\n30 NEXT I\n40 END');
    const seen = new Set<number>();
    for (let field = 0; field < 200; field++) {
      m.runFrame();
      const line = m.currentLine();
      if (line !== null) seen.add(line);
    }
    expect(seen).toContain(20);

    const paused = machine();
    load(paused, '10 FOR I=1 TO 200\n20 X=I\n30 NEXT I\n40 END');
    let stop: number | null = null;
    for (let field = 0; field < 200 && stop === null; field++) {
      const result = paused.debugStep({
        mode: 'run',
        breakpoints: new Set([30]),
        fromLine: null,
      });
      if (result.paused) stop = result.line;
    }
    expect(stop).toBe(30);
  });

  it('throws the display switches from BASIC and draws the lo-res page', () => {
    const m = machine();
    load(m, '10 GR\n20 COLOR=13\n30 PLOT 5,6\n40 END');
    expect(
      runUntil(m, () => m.isProgramRunning() === false, 300),
    ).toBeGreaterThan(0);
    // `GR` is lo-res, page 1, with the four text lines left at the foot.
    expect(m.displayMode.mode).toEqual({
      graphics: true,
      mixed: true,
      page2: false,
      hires: false,
    });
    // Lo-res row 6 is the low nibble of text row 3.
    expect(m.mem.peek(textRowAddress(TEXT_PAGE1, 3) + 5) & 0x0f).toBe(13);
    expect(pixel(m, 5 * CELL_WIDTH, 6 * LORES_BLOCK_HEIGHT)).toEqual([
      ...LORES_PALETTE[13]!,
    ]);
  });

  it('puts a hi-res poke where the interleave formula says it goes', () => {
    const m = machine();
    // The only proof the hi-res formula is right: the address is computed here
    // and poked by the ROM, so the two have to agree about which line it is.
    const address = hiresLineAddress(HIRES_PAGE1, 83);
    load(
      m,
      `10 POKE -16304,0: POKE -16302,0: POKE -16297,0\n20 POKE ${address},65\n30 END`,
    );
    expect(
      runUntil(m, () => m.isProgramRunning() === false, 300),
    ).toBeGreaterThan(0);
    expect(m.displayMode.mode.hires).toBe(true);
    expect(m.readScreenText()).toBeNull();
    // $41 is bits 0 and 6; bit 7 is the colour-pair select and draws nothing.
    expect(pixel(m, 0, 83)).toEqual([255, 255, 255]);
    expect(pixel(m, 6, 83)).toEqual([255, 255, 255]);
    expect(pixel(m, 1, 83)).toEqual([0, 0, 0]);
    expect(pixel(m, 0, 82)).toEqual([0, 0, 0]);
  });

  it('reads the game controller back through PDL', () => {
    const m = machine();
    load(m, '10 PRINT PDL(0)\n20 PRINT PDL(1)\n30 END');
    m.setJoystick('native', {
      up: false,
      down: true,
      left: true,
      right: false,
      fire1: false,
      fire2: false,
    });
    expect(
      runUntil(m, () => m.isProgramRunning() === false, 300),
    ).toBeGreaterThan(0);
    // The monitor's own PREAD counted the one-shots, so these are the numbers
    // the paddle timings are calibrated to produce.
    const lines = screen(m).split('\n');
    expect(lines.some((line) => line.startsWith('0'))).toBe(true);
    expect(lines.some((line) => line.startsWith('255'))).toBe(true);
  });

  it('makes a tone out of nothing but touches of $C030', () => {
    const m = machine();
    load(m, '10 FOR I=1 TO 400\n20 X=PEEK(-16336)\n30 NEXT I\n40 END');
    let peak = 0;
    for (let field = 0; field < 200; field++) {
      m.runFrame();
      for (const sample of m.readAudio())
        peak = Math.max(peak, Math.abs(sample));
    }
    expect(peak).toBeGreaterThan(0.1);

    const quiet = machine();
    load(quiet, '10 FOR I=1 TO 400\n20 X=I\n30 NEXT I\n40 END');
    let quietPeak = 0;
    for (let field = 0; field < 200; field++) {
      quiet.runFrame();
      for (const sample of quiet.readAudio()) {
        quietPeak = Math.max(quietPeak, Math.abs(sample));
      }
    }
    expect(quietPeak).toBe(0);
  });

  it('keeps the program across a press of RESET', () => {
    const m = machine();
    load(m, '10 PRINT "HI"\n20 END');
    expect(
      runUntil(m, () => m.isProgramRunning() === false, 200),
    ).toBeGreaterThan(0);
    const stored = [...m.mem.mem.subarray(m.mem.peekWord(PP), DEFAULT_HIMEM)];

    m.setKey(RESET_TOKEN, true);
    m.setKey(RESET_TOKEN, false);
    expect(runUntil(m, () => screen(m).includes('*'), 30)).toBeGreaterThan(0);
    // RESET pulses the CPU's reset line and nothing else, so the listing an
    // owner had typed survives it - which is why `E2B3G` was worth typing.
    expect([...m.mem.mem.subarray(m.mem.peekWord(PP), DEFAULT_HIMEM)]).toEqual(
      stored,
    );
  });

  it('records the program bus accesses and none of the IDE polling', () => {
    const m = machine();
    load(m, '10 X=PEEK(768)\n20 END');
    m.setMemoryActivityRecording(true);
    m.runFrame();
    const touched = m.drainMemoryActivity();
    expect(touched?.some((bit) => bit !== 0)).toBe(true);

    // Host introspection reads through `peek`, so asking questions between
    // frames must leave the overlay with nothing to report.
    for (let ask = 0; ask < 50; ask++) {
      m.readMemoryStats();
      m.readScreenText();
      m.readVariables();
      m.readReport();
      m.currentLine();
    }
    expect(m.drainMemoryActivity()?.every((bit) => bit === 0)).toBe(true);
    m.setMemoryActivityRecording(false);
    expect(m.drainMemoryActivity()).toBeNull();
  });

  it('says so on its own screen when the image carries no firmware', () => {
    const m = machine(new Uint8Array(FIRMWARE_BYTES));
    expect(m.hasFirmware).toBe(false);
    m.runFrame();
    expect(screen(m)).toContain('NO FIRMWARE');
    // Nothing runs, and nothing throws: the machine is still constructible.
    expect(m.isProgramRunning()).toBeNull();
    expect(m.currentLine()).toBeNull();
    m.loadProgram(apple2.tokenize('10 END').image);
    expect(screen(m)).toContain('NO FIRMWARE');
  });

  it('answers nothing once disposed', () => {
    const m = machine();
    m.dispose();
    expect(m.readScreenText()).toBeNull();
    expect(m.currentLine()).toBeNull();
    expect(m.isProgramRunning()).toBeNull();
    expect(m.readMemoryStats()).toBeNull();
    // Disposing twice is a no-op, not a second tear-down.
    m.dispose();
  });
});
