// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  DISPLAYED_BYTES_PER_LINE,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  HIDDEN_BYTES_PER_LINE,
  PIXELS_PER_BYTE,
  Pmd85Display,
  VIDEO_RAM_BYTES,
  VIDEO_RAM_STRIDE,
} from './display';

const BLANK = new Uint8Array(VIDEO_RAM_BYTES);

/** The RGB triple drawn at (x, y), from the frame buffer. */
function pixel(display: Pmd85Display, x: number, y: number): number[] {
  const p = (y * DISPLAY_WIDTH + x) * 4;
  return [...display.frameBuffer.subarray(p, p + 3)];
}

function lit(display: Pmd85Display, x: number, y: number): boolean {
  return pixel(display, x, y).some((c) => c !== 0);
}

describe('pmd85 display', () => {
  it('is the geometry the video circuit fetches, not the one the stride suggests', () => {
    // 48 displayed bytes of 6 pixels is the whole of the 288-pixel width, and
    // the 16 bytes that make each line up to the 64-byte stride reach no pixel.
    expect(DISPLAYED_BYTES_PER_LINE * PIXELS_PER_BYTE).toBe(DISPLAY_WIDTH);
    expect(DISPLAYED_BYTES_PER_LINE + HIDDEN_BYTES_PER_LINE).toBe(
      VIDEO_RAM_STRIDE,
    );
    expect(VIDEO_RAM_STRIDE * DISPLAY_HEIGHT).toBe(VIDEO_RAM_BYTES);
  });

  it('reads each scanline at a 64-byte stride', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    // One lit pixel on scanline 3, and one on the last scanline.
    video[3 * VIDEO_RAM_STRIDE] = 0x01;
    video[(DISPLAY_HEIGHT - 1) * VIDEO_RAM_STRIDE] = 0x01;
    display.draw(video, true);

    expect(lit(display, 0, 3)).toBe(true);
    expect(lit(display, 0, DISPLAY_HEIGHT - 1)).toBe(true);
    // A 48-byte stride would have put the first of those on scanline 4.
    expect(lit(display, 0, 4)).toBe(false);
    expect(lit(display, 0, 2)).toBe(false);
  });

  it('draws six pixels from a byte, least significant bit at the left', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    video[0] = 0b000101;
    video[1] = 0b111111;
    display.draw(video, true);

    expect([0, 1, 2, 3, 4, 5].map((x) => lit(display, x, 0))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
    // The next byte starts six pixels along, not eight.
    expect(lit(display, 6, 0)).toBe(true);
    expect(lit(display, 11, 0)).toBe(true);
    expect(lit(display, 12, 0)).toBe(false);
  });

  it('ignores the 16 bytes of each line the video circuit never fetches', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    // The Monitor keeps its variables here, so these bytes are routinely
    // non-zero on a running machine and must reach no pixel.
    for (let i = DISPLAYED_BYTES_PER_LINE; i < VIDEO_RAM_STRIDE; i++) {
      video[i] = 0xff;
    }
    display.draw(video, true);

    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      expect(lit(display, x, 0), `x=${x}`).toBe(false);
    }
  });

  it('dims a cell with the reduced-brightness bit set', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    video[0] = 0x01; // full brightness
    video[1] = 0x81; // bit 7: reduced
    display.draw(video, true);

    const full = pixel(display, 0, 0);
    const reduced = pixel(display, 6, 0);
    expect(reduced).not.toEqual(full);
    expect(reduced.every((c, i) => c > 0 && c < full[i]!)).toBe(true);
  });

  it('blanks a blinking cell on the off phase, and nothing else', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    video[0] = 0x41; // bit 6: blink
    video[1] = 0x01;
    display.draw(video, true);
    expect(lit(display, 0, 0)).toBe(true);
    expect(lit(display, 6, 0)).toBe(true);

    display.draw(video, false);
    expect(lit(display, 0, 0)).toBe(false);
    expect(lit(display, 6, 0)).toBe(true);
  });

  it('leaves a clear pixel bit black whatever the attribute says', () => {
    const display = new Pmd85Display();
    const video = new Uint8Array(BLANK);
    video[0] = 0xc0; // both attribute bits, no pixels
    display.draw(video, true);

    for (let x = 0; x < PIXELS_PER_BYTE; x++) {
      expect(lit(display, x, 0)).toBe(false);
    }
  });
});
