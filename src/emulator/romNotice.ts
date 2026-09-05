// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a machine draws when it has been handed no ROM image.
 *
 * An absent image is a designed state rather than a failure: the images with no
 * redistribution grant are meant to be removable
 * (`public/roms/ATTRIBUTION.md`), so every machine that takes its ROM through
 * the seam constructs on an empty one and says on its own screen that it has
 * nothing to run. Silence is the failure mode this replaces - a blank screen
 * and a machine that never boots look exactly like a machine that is broken.
 *
 * Drawn in the host's own font rather than the machine's, because the character
 * generator is in the ROM that is missing: there is no other way to spell
 * anything. The Altair, the Apples and the PMD 85 reached the same conclusion
 * before this helper existed and keep their own bespoke wording, which says more
 * about their particular firmware than a shared message could; this is for every
 * machine whose story is simply "the image is not here".
 *
 * Not the app's first line of defence. A bundled image that fails to load keeps
 * the machine out of the picker entirely, with an offer to supply one, and the
 * headless runner reports a missing ROM as a condition of the run. This is what
 * the machine itself can say when it is started anyway.
 */

/** Left and top inset, in canvas pixels. */
const INSET = 8;

/**
 * Font size, chosen so a full line of the notice fits the machine's own display.
 *
 * These displays run from 256 pixels across (the Sinclairs) to over 700 (the
 * CPCs), and one fixed size is either unreadable on the first or absurd on the
 * last. A monospace glyph advances about 0.6em, so a line of {@link LINE_CHARS}
 * fits a display of `width` at `width / (LINE_CHARS * 0.6)` - clamped, because
 * a wide display does not want a headline and a narrow one still has to be
 * legible.
 */
const LINE_CHARS = 46;

/** The longest a notice line may be before it runs off a narrow display. */
export const NOTICE_LINE_CHARS = LINE_CHARS;

function fontPx(width: number): number {
  return Math.max(7, Math.min(15, Math.floor(width / (LINE_CHARS * 0.6))));
}

/**
 * The lines a machine shows when the image it was handed is empty.
 *
 * `what` names what is missing in the machine's own terms - "the 8K ROM", "the
 * firmware and BASIC ROM pair" - and `romPath` is where to put it. Kept to
 * {@link NOTICE_LINE_CHARS} a line so nothing is drawn off the edge of the
 * narrowest display here; `romNotice.test.ts` holds every caller to that.
 *
 * The path carries its own folder now that every machine's image sits in one
 * (`public/roms/zxspectrum128/zxspectrum128.rom`), which is long enough that
 * "<path> is missing." no longer fits a 256-pixel display on one line - so it
 * takes a second line when it has to, rather than being drawn off the edge.
 */
export function noRomNotice(what: string, romPath: string): string[] {
  const missing = `${romPath} is missing.`;
  return [
    'NO ROM IMAGE.',
    '',
    `This build has no ${what} to run:`,
    ...(missing.length <= LINE_CHARS ? [missing] : [romPath, 'is missing.']),
    'Restore it, or install your own image from',
    'Settings.',
  ];
}

/**
 * Paint `lines` over the whole display.
 *
 * Takes the context and the display size rather than reaching for a machine's
 * own renderer, so one implementation serves every machine here whatever its
 * geometry and palette. White on black: a machine with no firmware has no
 * palette of its own to be faithful to.
 */
export function drawRomNotice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: readonly string[],
): void {
  const size = fontPx(width);
  const lineHeight = Math.round(size * 1.5);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `${size}px monospace`;
  lines.forEach((line, i) => {
    ctx.fillText(line, INSET, INSET + i * lineHeight);
  });
}
