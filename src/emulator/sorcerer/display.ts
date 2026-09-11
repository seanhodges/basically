// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  CHARGEN_ROM_BASE,
  CHAR_CELL_HEIGHT,
  CHAR_CELL_WIDTH,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from '../../dialects/sorcerer/addresses';

/** Displayed pixels across, and scanlines down. */
export const DISPLAY_WIDTH = SCREEN_COLUMNS * CHAR_CELL_WIDTH;
export const DISPLAY_HEIGHT = SCREEN_ROWS * CHAR_CELL_HEIGHT;

/** The first character code whose bitmap lives in generator RAM. */
export const FIRST_RAM_CODE = 0x80;

/**
 * White, because the Sorcerer's video output is a plain monochrome composite
 * signal and the monitor Exidy sold with it was a white-phosphor one. Nothing
 * on the machine can put a second colour on the screen.
 */
const FOREGROUND: readonly [number, number, number] = [0xe8, 0xe8, 0xe8];
const BACKGROUND: readonly [number, number, number] = [0, 0, 0];

/**
 * The Sorcerer screen: 64x30 characters of 8x8 dots, and no video chip at all.
 *
 * The video circuit walks screen RAM in reading order and, for each byte, reads
 * eight consecutive bytes of the character generator at `0xF800 + code * 8`.
 * That address arithmetic is the whole display: codes 0-127 land in the
 * generator ROM and codes 128-255 in the generator RAM above it, which is why a
 * program that pokes generator RAM changes what is already on the screen.
 *
 * Rendered from RAM on demand rather than accumulated during the frame. Nothing
 * here can change the picture part-way down it: the CPU and the video circuit
 * share the RAM without contention and there is no raster interrupt to
 * synchronise to, so a whole-frame snapshot loses nothing.
 */
export class SorcererDisplay {
  private imageData: ImageData | null = null;
  private readonly pixels = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );

  /** Draw the current contents of screen RAM through the character generator. */
  renderTo(
    ctx: CanvasRenderingContext2D,
    screenRam: Uint8Array,
    charGenRom: Uint8Array,
    charGenRam: Uint8Array,
  ): void {
    this.draw(screenRam, charGenRom, charGenRam);
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    this.imageData.data.set(this.pixels);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** The RGBA frame buffer the last {@link draw} produced, for tests. */
  get frameBuffer(): Uint8ClampedArray {
    return this.pixels;
  }

  /**
   * Screen RAM to RGBA. Split out from {@link renderTo} so a test can read the
   * pixels back without a canvas - the split generator, and the most
   * significant bit being the leftmost dot, are the parts of this machine
   * easiest to get plausibly wrong.
   */
  draw(
    screenRam: Uint8Array,
    charGenRom: Uint8Array,
    charGenRam: Uint8Array,
  ): void {
    const pixels = this.pixels;
    for (let row = 0; row < SCREEN_ROWS; row++) {
      for (let col = 0; col < SCREEN_COLUMNS; col++) {
        const code = screenRam[row * SCREEN_COLUMNS + col] ?? 0;
        const generator = code < FIRST_RAM_CODE ? charGenRom : charGenRam;
        const base = (code % FIRST_RAM_CODE) * CHAR_CELL_HEIGHT;
        for (let line = 0; line < CHAR_CELL_HEIGHT; line++) {
          const bits = generator[base + line] ?? 0;
          let p =
            ((row * CHAR_CELL_HEIGHT + line) * DISPLAY_WIDTH +
              col * CHAR_CELL_WIDTH) *
            4;
          // Bit 7 is the leftmost dot: the shift register clocks the byte out
          // most significant bit first.
          for (let bit = CHAR_CELL_WIDTH - 1; bit >= 0; bit--) {
            const rgb = (bits & (1 << bit)) !== 0 ? FOREGROUND : BACKGROUND;
            pixels[p] = rgb[0];
            pixels[p + 1] = rgb[1];
            pixels[p + 2] = rgb[2];
            pixels[p + 3] = 0xff;
            p += 4;
          }
        }
      }
    }
  }
}

/**
 * Where a character code's bitmap is, as a CPU address.
 *
 * Exported because the address is a fact about the machine rather than about
 * the renderer: it is what a program POKEs to redefine a graphics character,
 * and what the Monitor writes when it copies the standard graphics set into
 * generator RAM at boot.
 */
export function generatorAddress(code: number): number {
  return CHARGEN_ROM_BASE + (code & 0xff) * CHAR_CELL_HEIGHT;
}
