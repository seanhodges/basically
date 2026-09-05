// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { drawRomNotice, noRomNotice, NOTICE_LINE_CHARS } from './romNotice';
import { HeadlessCanvas } from '../dialects/headless/headlessCanvas';

/**
 * The shared no-firmware notice.
 *
 * Two things can go wrong silently here and both look like a working notice
 * from the code: a line drawn off the edge of a narrow display, and a font
 * scaled to something unreadable. Neither is visible to a reader of the
 * source, so both are measured.
 */

/** The narrowest and widest displays a registered machine has. */
const NARROW = { width: 256, height: 192 };
const WIDE = { width: 768, height: 272 };

describe('what the notice says', () => {
  it('fits the narrowest display without running off the edge', () => {
    for (const line of noRomNotice(
      "ZX81's 8K ROM",
      'public/roms/zx81/zx81.rom',
    )) {
      expect(line.length, line).toBeLessThanOrEqual(NOTICE_LINE_CHARS);
    }
  });

  it('names what is missing and where to put it', () => {
    const lines = noRomNotice('Atari OS image', 'public/roms/atari.rom').join(
      '\n',
    );
    expect(lines).toContain('NO ROM IMAGE.');
    expect(lines).toContain('Atari OS image');
    expect(lines).toContain('public/roms/atari.rom');
    // The way out, not just the diagnosis: a caller with no redistributable
    // image can supply their own.
    expect(lines).toContain('Settings');
  });
});

describe('drawing it', () => {
  const notice = noRomNotice('the 8K ROM', 'public/roms/zx81/zx81.rom');

  it('paints text on both the narrowest and the widest display here', () => {
    for (const { width, height } of [NARROW, WIDE]) {
      const canvas = new HeadlessCanvas(width, height);
      drawRomNotice(canvas.renderContext, width, height, notice);
      expect(
        canvas.hostFontGlyphs,
        `${width}x${height} drew no text`,
      ).toBeGreaterThan(0);
      // Text on a ground, rather than a frame of one flat colour - which is
      // what a machine with nothing to run would otherwise show.
      expect(canvas.distinctColours(), `${width}x${height}`).toBeGreaterThan(1);
    }
  });

  it('keeps every line inside the display it is drawn on', () => {
    // A line drawn past the right edge is clipped away in silence, so the
    // painted pixels are measured rather than the geometry re-derived: the
    // rightmost lit column has to fall short of the edge on both displays.
    for (const { width, height } of [NARROW, WIDE]) {
      const canvas = new HeadlessCanvas(width, height);
      drawRomNotice(canvas.renderContext, width, height, notice);

      let rightmost = -1;
      let lowest = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // The ground is black and the text white, so any lit pixel is text.
          if (canvas.rgba[(y * width + x) * 4] === 0) continue;
          if (x > rightmost) rightmost = x;
          if (y > lowest) lowest = y;
        }
      }

      expect(rightmost, `${width}x${height} drew nothing`).toBeGreaterThan(0);
      // Short of the last column, not merely inside it: the canvas clips, so a
      // line that overran would still light pixels right up to the edge and
      // "inside the display" would be true of a notice half of which is gone.
      expect(rightmost, `${width}x${height} ran off the right`).toBeLessThan(
        width - 1,
      );
      expect(lowest, `${width}x${height} ran off the bottom`).toBeLessThan(
        height - 1,
      );
    }
  });
});
