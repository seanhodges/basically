// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** Displayed pixels across, and scanlines down. */
export const DISPLAY_WIDTH = 288;
export const DISPLAY_HEIGHT = 256;

/** Base of video RAM, and the stride between one scanline and the next. */
export const VIDEO_RAM_BASE = 0xc000;
export const VIDEO_RAM_STRIDE = 0x40;

/** The whole 16K frame buffer: one stride per scanline, and no more. */
export const VIDEO_RAM_BYTES = VIDEO_RAM_STRIDE * DISPLAY_HEIGHT;

/**
 * Bytes of each scanline that reach the screen, and pixels packed into each.
 *
 * The stride is 64 bytes but only 48 are displayed, and only the low six bits
 * of each byte are pixels: 48 x 6 = 288. The top two bits are that six-pixel
 * cell's attribute, below. Assuming eight pixels to the byte, or a 48-byte
 * stride, yields a screen that looks plausible and is wrong.
 */
export const DISPLAYED_BYTES_PER_LINE = 48;
export const PIXELS_PER_BYTE = 6;

/**
 * The 16 bytes of each scanline the video circuit never fetches, which the
 * firmware uses as ordinary RAM: the Monitor copies its whole variable block
 * into the tails of the first eight scanlines at boot, so a program that reads
 * 0xC030 is reading a Monitor variable and not a pixel. Recorded here because
 * it is the reason the stride and the displayed width differ, and the reason
 * nothing may assume video RAM is only pixels.
 */
export const HIDDEN_BYTES_PER_LINE =
  VIDEO_RAM_STRIDE - DISPLAYED_BYTES_PER_LINE;

/** How many frames each half of the blink attribute's cycle lasts. */
export const BLINK_FRAMES = 16;

/**
 * The two attribute bits, which are two independent flags rather than a level.
 *
 * BASIC-G writes the pair as a small number - `PRINT INK(n)` puts `n` straight
 * into bits 6-7, and `PEN n` does the same for drawing - so the four are
 * naturally read as 0-3. What each does is not a scale, though:
 *
 *   bit 6  blink: the cell alternates between its colour and black
 *   bit 7  reduced brightness
 *
 * so INK 0 is plain text (which is what the Monitor and BASIC-G write), 1 plain
 * text blinking, 2 dim, 3 dim and blinking. Nothing here is black on its own: a
 * pixel bit that is clear is background whatever the attribute says.
 *
 * The PMD 85-3 reuses the same two bits as a colour select through an RGB
 * encoder and loses the blink; a machine for it would replace this table and
 * nothing else.
 */
const BLINK = 0x40;
const REDUCED_BRIGHTNESS = 0x80;

/**
 * Green, because that is the only colour these machines could produce: the TV
 * modulator carries the green component of the video signal and nothing else,
 * so a PMD 85 on a colour TV is green and on a monochrome one is grey. Reduced
 * brightness is three quarters of full.
 */
const FULL: readonly [number, number, number] = [0x4c, 0xff, 0x4c];
const REDUCED: readonly [number, number, number] = [0x39, 0xbf, 0x39];
const BACKGROUND: readonly [number, number, number] = [0, 0, 0];

/** Where {@link Pmd85Display.drawNotice} puts its text, in canvas pixels. */
const NOTICE_LEFT = 8;
const NOTICE_TOP = 16;
const NOTICE_LINE_HEIGHT = 14;

/**
 * The PMD 85 screen: a 288x256 monochrome bitmap with a four-level attribute
 * per six-pixel cell.
 *
 * Rendered from video RAM on demand rather than accumulated during the frame.
 * Nothing on this machine can change the picture part-way down it the way a
 * Spectrum program rewrites attribute RAM mid-frame: the video circuit and the
 * CPU share the RAM without contention, there is no raster interrupt to
 * synchronise to, and the attribute is in the same byte as the pixels it
 * applies to, so a whole-frame snapshot loses nothing.
 */
export class Pmd85Display {
  private imageData: ImageData | null = null;
  private readonly pixels = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );

  /**
   * Draw the current contents of video RAM. `blinkOn` is the phase of the
   * blink attribute, which the machine advances once per frame; cells at any
   * other attribute ignore it.
   */
  renderTo(
    ctx: CanvasRenderingContext2D,
    videoRam: Uint8Array,
    blinkOn: boolean,
  ): void {
    this.draw(videoRam, blinkOn);
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    this.imageData.data.set(this.pixels);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** The RGBA frame buffer the last {@link renderTo} produced, for tests. */
  get frameBuffer(): Uint8ClampedArray {
    return this.pixels;
  }

  /**
   * Put a message on the screen when the machine has no firmware to draw one
   * with, using the host's own font rather than the machine's.
   *
   * The character generator is in the ROM that is missing, so there is no other
   * way to spell anything - the Altair, whose BASIC image can never ship, draws
   * its own missing-image notice the same way. The message is not the app's
   * first line of defence: a bundled image that fails to load keeps the machine
   * out of the picker entirely, with an offer to supply one.
   */
  drawNotice(ctx: CanvasRenderingContext2D, lines: readonly string[]): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.fillStyle = `rgb(${FULL[0]},${FULL[1]},${FULL[2]})`;
    ctx.textBaseline = 'top';
    ctx.font = `${NOTICE_LINE_HEIGHT - 3}px monospace`;
    lines.forEach((line, i) => {
      ctx.fillText(line, NOTICE_LEFT, NOTICE_TOP + i * NOTICE_LINE_HEIGHT);
    });
  }

  /**
   * Video RAM to RGBA. Split out from {@link renderTo} so a test can read the
   * pixels back without a canvas - the geometry here (the 64-byte stride, the
   * six pixels per byte, the least significant bit at the left) is the part of
   * this machine easiest to get plausibly wrong.
   */
  draw(videoRam: Uint8Array, blinkOn: boolean): void {
    const pixels = this.pixels;
    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
      const line = y * VIDEO_RAM_STRIDE;
      let p = y * DISPLAY_WIDTH * 4;
      for (let cell = 0; cell < DISPLAYED_BYTES_PER_LINE; cell++) {
        const byte = videoRam[line + cell] ?? 0;
        const blanked = (byte & BLINK) !== 0 && !blinkOn;
        const ink = blanked
          ? BACKGROUND
          : byte & REDUCED_BRIGHTNESS
            ? REDUCED
            : FULL;
        // Bit 0 is the leftmost pixel of the cell: the shift register clocks
        // the byte out least significant bit first.
        for (let bit = 0; bit < PIXELS_PER_BYTE; bit++) {
          const rgb = (byte & (1 << bit)) !== 0 ? ink : BACKGROUND;
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
