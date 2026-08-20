// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from '../romImage';
import { tokenizeProgram } from '../tokenizer';
import {
  BASIC_BASE,
  BASIC_BODY_BYTES,
  IMAGE_BODY_OFFSET,
  PROGRAM_BASE,
  TXTTAB,
  VARTAB,
} from '../addresses';
import { Pmd85Machine } from './pmd85Machine';
import { DISPLAYED_BYTES_PER_LINE, VIDEO_RAM_STRIDE } from './display';
import { CPU_HZ } from './clock';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/pmd85.rom')),
);
const { monitor, romModule } = splitRomImage(rom);

function machine(): Pmd85Machine {
  return new Pmd85Machine(splitRomImage(rom));
}

/**
 * The screen as text, decoded through the Monitor's own character generator.
 *
 * Read back rather than assumed, so this exercises the geometry the machine is
 * easiest to get plausibly wrong at: a scanline is one 64-byte stride from the
 * next, and a character is one *byte* column wide because a byte is six pixels.
 * The text grid itself is the Monitor's choice, not the video circuit's - it
 * puts 28 rows of 48 characters on the 256 scanlines, each glyph seven pixel
 * rows tall on a nine-scanline pitch starting at scanline 1.
 */
const TEXT_COLS = DISPLAYED_BYTES_PER_LINE;
const TEXT_ROW_PITCH = 9;
const TEXT_TOP = 1;
const GLYPH_ROWS = 8;
const PIXEL_BITS = 0x3f;

const font = new Map<string, string>();
for (let code = 0x20; code <= 0x7f; code++) {
  // 0x20-0x5F at 0x8600 and 0x60-0x7F at 0x88C0, with Monitor code between.
  const base = (code < 0x60 ? 0x0600 - 0x20 * 8 : 0x08c0 - 0x60 * 8) + code * 8;
  font.set(
    glyphKey(Array.from({ length: GLYPH_ROWS }, (_, i) => monitor[base + i]!)),
    String.fromCharCode(code),
  );
}

function glyphKey(rows: readonly number[]): string {
  return rows.map((row) => row & PIXEL_BITS).join(',');
}

function screenText(video: Uint8Array): string[] {
  const lines: string[] = [];
  for (
    let row = 0;
    row * TEXT_ROW_PITCH + TEXT_TOP + GLYPH_ROWS <= 256;
    row++
  ) {
    let line = '';
    for (let col = 0; col < TEXT_COLS; col++) {
      const top = row * TEXT_ROW_PITCH + TEXT_TOP;
      const rows = Array.from(
        { length: GLYPH_ROWS },
        (_, i) => video[(top + i) * VIDEO_RAM_STRIDE + col]!,
      );
      line += font.get(glyphKey(rows)) ?? '?';
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

describe('Pmd85Machine', () => {
  it('boots the Monitor through the startup memory configuration', () => {
    const pmd = machine();
    // Out of reset the CPU fetches from 0x0000, where the decoder mirrors the
    // Monitor; the Monitor's own third instruction is the OUT that drops it.
    expect(pmd.mem.inStartupMap).toBe(true);
    expect(pmd.mem.read(0x0000)).toBe(monitor[0]);

    pmd.runFrame();
    expect(pmd.mem.inStartupMap).toBe(false);
  });

  it('auto-launches BASIC-G by copying the module out through its 8255', () => {
    const pmd = machine();
    pmd.bootToReady();

    // The interpreter is not in the address space until the Monitor's TRANSFER
    // routine has read all 9K of it a byte at a time through ports 0xF8-0xFB.
    const body = romModule.subarray(
      IMAGE_BODY_OFFSET,
      IMAGE_BODY_OFFSET + BASIC_BODY_BYTES,
    );
    const copied = Uint8Array.from({ length: BASIC_BODY_BYTES }, (_, i) =>
      pmd.mem.read(BASIC_BASE + i),
    );
    expect(copied).toEqual(body);
    // And the transfer parked the module: port C's top bit is the chip select.
    expect(pmd.module.selected).toBe(false);

    // Its cold start ran: TXTTAB points at the program area and VARTAB at the
    // end of an empty program, two bytes above it.
    expect(pmd.mem.readWord(TXTTAB)).toBe(PROGRAM_BASE);
    expect(pmd.mem.readWord(VARTAB)).toBe(PROGRAM_BASE + 2);
  });

  it('reaches the BASIC-G sign-on, which the 8080 flag fixes are what allow', () => {
    // The interpreter's arithmetic is Microsoft floating point, which uses the
    // 8080's parity flag where the Z80 leaves signed overflow. Without the
    // correction in src/emulator/i8080 the sign-on never appears.
    const pmd = machine();
    pmd.bootToReady();
    expect(screenText(pmd.mem.videoRam)).toContain('BASIC-G /V2.0');
  });

  it('injects a program, runs it, and shows its output', () => {
    const pmd = machine();
    const { program, errors } = tokenizeProgram(
      '10 PRINT "HELLO PMD"\n20 END\n',
    );
    expect(errors).toEqual([]);

    pmd.loadProgram(program);
    expect(pmd.isProgramRunning()).toBe(true);
    for (let frame = 0; frame < 120 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }

    expect(pmd.isProgramRunning()).toBe(false);
    const lines = screenText(pmd.mem.videoRam);
    expect(lines).toContain('RUN');
    expect(lines).toContain('HELLO PMD');
    // The program itself is where the pointers say it is.
    expect(pmd.mem.readWord(VARTAB)).toBe(PROGRAM_BASE + program.length);
  });

  it('reports a program that does not stop as still running', () => {
    const pmd = machine();
    pmd.loadProgram(tokenizeProgram('100 GOTO 100\n').program);
    for (let frame = 0; frame < 60; frame++) pmd.runFrame();
    expect(pmd.isProgramRunning()).toBe(true);

    // The STOP key is one of the routes back to the prompt the run latch reads.
    pmd.setKey('Stop', true);
    for (let frame = 0; frame < 20; frame++) pmd.runFrame();
    pmd.setKey('Stop', false);
    expect(pmd.isProgramRunning()).toBe(false);
  });

  it('writes the program to the screen where the video circuit will fetch it', () => {
    // The frame buffer's geometry, asserted against a running machine rather
    // than a synthetic buffer: text lands in the low 48 bytes of a 64-byte
    // stride, and the 16 bytes above it hold the Monitor's variables rather
    // than pixels. A renderer that assumed eight pixels to a byte, or a
    // 48-byte stride, would produce a plausible-looking but wrong screen and
    // nothing else here would notice.
    const pmd = machine();
    pmd.loadProgram(tokenizeProgram('10 PRINT "XXXXXXXX"\n20 END\n').program);
    for (let frame = 0; frame < 120 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }
    const video = pmd.mem.videoRam;

    const row = screenText(video).findIndex((line) => line === 'XXXXXXXX');
    expect(row).toBeGreaterThan(0);
    const top = row * TEXT_ROW_PITCH + TEXT_TOP;
    // Eight characters of six pixels: bytes 0-7 of the line, nothing past them.
    expect(video[top * VIDEO_RAM_STRIDE + 7]! & PIXEL_BITS).not.toBe(0);
    expect(video[top * VIDEO_RAM_STRIDE + 8]! & PIXEL_BITS).toBe(0);
    // The Monitor's variable block lives in the hidden tail of the top lines.
    const hidden = video.subarray(DISPLAYED_BYTES_PER_LINE, VIDEO_RAM_STRIDE);
    expect(hidden.some((byte) => byte !== 0)).toBe(true);
  });

  it('starts at the line autoStart names', () => {
    const pmd = machine();
    pmd.loadProgram(
      tokenizeProgram('10 PRINT "FIRST"\n20 PRINT "SECOND"\n30 END\n').program,
      { autoStart: 20 },
    );
    for (let frame = 0; frame < 120 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }
    const lines = screenText(pmd.mem.videoRam);
    expect(lines).toContain('SECOND');
    expect(lines).not.toContain('FIRST');
  });

  it('puts a memory block in place before the program starts', () => {
    // 0x4000 is above anything a one-line program reaches and below the stack
    // BASIC-G sets for itself; which addresses a block may safely claim is a
    // question for `memoryBlocks.ts` rather than for the machine.
    const pmd = machine();
    pmd.loadProgram(tokenizeProgram('10 END\n').program, {
      blocks: [{ address: 0x4000, bytes: Uint8Array.of(0xc9, 0x12, 0x34) }],
    });
    expect(pmd.mem.read(0x4000)).toBe(0xc9);
    expect(pmd.mem.read(0x4002)).toBe(0x34);
  });

  it('stays constructible, and quiet, with no firmware', () => {
    const pmd = new Pmd85Machine({
      monitor: new Uint8Array(0),
      romModule: new Uint8Array(0),
    });
    expect(pmd.hasFirmware).toBe(false);
    expect(() => {
      pmd.runFrame();
      pmd.loadProgram(Uint8Array.of(0, 0));
      pmd.bootToReady();
    }).not.toThrow();
    expect(pmd.isProgramRunning()).toBe(null);

    // It says so on screen rather than presenting a black rectangle: with no
    // ROM there is no character generator, so the notice goes through the
    // canvas's own font.
    const drawn: string[] = [];
    pmd.renderTo({
      fillRect: () => {},
      fillText: (text: string) => drawn.push(text),
    } as unknown as CanvasRenderingContext2D);
    expect(drawn.join(' ')).toContain('NO ROM IMAGE.');
  });

  it('gives PAUSE about a tenth of a second per unit', () => {
    // The interpreter's delay loop counts 3400h times per unit, which is ~0.1s
    // at 2.048MHz and not the millisecond its own source comment claims. The
    // difference is a factor of a hundred, so it decides whether a PAUSE in a
    // sample or an assistant's program is a beat or most of a minute - and the
    // machine is the only place it can be measured.
    const pmd = machine();
    const { program, errors } = tokenizeProgram(
      '10 OUT 134,4\n20 PAUSE 10\n30 OUT 134,0\n40 END\n',
    );
    expect(errors).toEqual([]);

    // Bracketed by writes to the speaker port, which is the cheapest marker
    // this machine offers that a BASIC line can set at a known moment.
    const marks: number[] = [];
    const machineAny = pmd as unknown as {
      writePort(port: number, value: number): void;
      cycles: number;
    };
    const write = machineAny.writePort.bind(machineAny);
    machineAny.writePort = (port: number, value: number) => {
      if (port === 0x86) marks.push(machineAny.cycles);
      write(port, value);
    };
    pmd.loadProgram(program);
    for (let f = 0; f < 300 && pmd.isProgramRunning(); f++) pmd.runFrame();

    expect(marks).toHaveLength(2);
    const seconds = (marks[1]! - marks[0]!) / CPU_HZ;
    expect(seconds).toBeGreaterThan(0.8);
    expect(seconds).toBeLessThan(1.1);
  });

  it('starts over on reset', () => {
    const pmd = machine();
    pmd.bootToReady();
    expect(pmd.mem.readWord(VARTAB)).not.toBe(0);

    pmd.reset();
    expect(pmd.mem.inStartupMap).toBe(true);
    expect(pmd.mem.readWord(VARTAB)).toBe(0);
    expect(pmd.isProgramRunning()).toBe(null);
  });
});
