// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The GTIA's 256 colours, generated from the composite signal the chip emits
 * rather than transcribed from a table.
 *
 * A GTIA colour byte is a hue in its top nibble and a luminance in its bottom
 * one. The chip has no palette: it emits a luminance voltage and, for hues
 * 1-15, a chrominance subcarrier delayed by a fixed step per hue. Everything a
 * colour looks like therefore falls out of three measured facts:
 *
 *  - the sixteen luminance voltages, from the CGIA design notes;
 *  - the NTSC colourburst sitting at 303 degrees in YIQ - the burst is at 180
 *    degrees in YUV, and YIQ is YUV rotated 33 degrees;
 *  - the 26.8-degree delay between consecutive hues, the figure that makes the
 *    chip's hues come out with the names the GTIA data sheet gives them.
 *
 * From there it is the ordinary NTSC decode: YIQ to gamma-corrected RGB, then
 * out of the CRT's 2.35 gamma into linear light and back into sRGB, which is
 * what the browser will display. Y is scaled into the 16-235 studio range
 * rather than 0-255, so black is the black a TV showed rather than the darkest
 * value a canvas can hold.
 *
 * The model is the one the atari800 emulator's colour generator uses, and the
 * constants below are its published figures. Hue 0 has no chroma at all and so
 * comes out as the sixteen greys.
 */

/**
 * The sixteen luminance levels, as fractions of the white level, measured off
 * the chip. Not evenly spaced - the ladder in it is a resistor network, so the
 * steps widen towards white - and sixteen distinct levels rather than the eight
 * the register's documented three luminance bits would give, which is why they
 * are taken from the measurements rather than computed.
 */
const LUMINANCE = [
  0.6941, 0.7091, 0.7241, 0.7401, 0.756, 0.7741, 0.7931, 0.8121, 0.826, 0.847,
  0.87, 0.893, 0.916, 0.942, 0.969, 1.0,
] as const;

/** Where hue 1 sits in YIQ: the colourburst, 180 degrees in YUV plus YIQ's 33. */
const BURST_ANGLE = (303 * Math.PI) / 180;

/** How far each hue is delayed past the one before it. */
const HUE_STEP = (26.8 * Math.PI) / 180;

/** Chroma amplitude at the chip's nominal saturation. */
const SATURATION = 0.175;

/** The gamma a CRT of the period displayed the signal through. */
const CRT_GAMMA = 2.35;

/** Y is scaled into the studio range BT.601 recommends, not the full 0-255. */
const BLACK_LEVEL = 16 / 255;
const WHITE_LEVEL = 235 / 255;

/** One colour as the renderers want it. */
export type Rgb = readonly [number, number, number];

/** Linear light to sRGB, the transfer function a browser canvas expects. */
function toSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** A gamma-corrected component back to linear light. */
function toLinear(c: number): number {
  // A negative component is out of gamut rather than dark, and `pow` cannot
  // take it; dividing by the sRGB curve's linear segment leaves it unchanged
  // through the round trip instead of clamping it to black.
  return c >= 0 ? Math.pow(c, CRT_GAMMA) : c / 12.92;
}

function build(): Rgb[] {
  const colours: Rgb[] = [];
  for (let hue = 0; hue < 16; hue++) {
    const angle = BURST_ANGLE + (hue - 1) * HUE_STEP;
    const saturation = hue === 0 ? 0 : SATURATION;
    const i = Math.cos(angle) * saturation;
    const q = Math.sin(angle) * saturation;
    for (let luma = 0; luma < 16; luma++) {
      const level =
        (LUMINANCE[luma]! - LUMINANCE[0]!) / (LUMINANCE[15]! - LUMINANCE[0]!);
      const y = level * (WHITE_LEVEL - BLACK_LEVEL) + BLACK_LEVEL;
      const rgb = [
        y + 0.9563 * i + 0.621 * q,
        y - 0.2721 * i - 0.6474 * q,
        y - 1.107 * i + 1.7046 * q,
      ].map((c) => {
        const v = Math.trunc(toSrgb(toLinear(c)) * 255);
        return v < 0 ? 0 : v > 255 ? 255 : v;
      });
      colours.push([rgb[0]!, rgb[1]!, rgb[2]!]);
    }
  }
  return colours;
}

/** The 256 GTIA colours, indexed by the byte a colour register holds. */
export const ATARI_PALETTE: readonly Rgb[] = build();

/**
 * The palette flattened to RGB triples, for the renderer's inner loop: three
 * array reads instead of a tuple lookup per pixel.
 */
export const ATARI_PALETTE_RGB: Uint8Array = (() => {
  const flat = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = ATARI_PALETTE[i]!;
    flat[i * 3] = r;
    flat[i * 3 + 1] = g;
    flat[i * 3 + 2] = b;
  }
  return flat;
})();
