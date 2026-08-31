// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import {
  SCREENSHOT_TARGET_WIDTH,
  screenshotFileName,
  screenshotScale,
} from './screenshot';

/**
 * The whole per-machine screenshot matrix lives here rather than in a browser:
 * the only thing a screenshot does per machine is pick an enlargement from the
 * machine's own display width, and that is arithmetic. The browser proof in
 * `e2e/program-execution/emulator-boot.spec.ts` boots one machine and checks a
 * real download, which is the part no unit test can reach.
 *
 * Same shape as `e2e/paletteMachines.ts` + `src/dialects/graphicsPalette.test.ts`:
 * the matrix is pinned against the registry, so a machine that lands with an
 * awkward display size fails here rather than saving a thumbnail for a user.
 */

/** Machines default to the pane's own 256x192 when they declare no size. */
const DEFAULT_WIDTH = 256;

/** Saved image width, in pixels, for every registered machine. */
const EXPECTED_WIDTHS: Record<string, number> = {
  zx81: 1024, // 256 x4
  zx80: 1024, // 256 x4
  zxspectrum: 1024, // 256 x4
  zxspectrum128: 1024, // 256 x4
  bbcmicro: 896, // 896 x1 - already at the target width
  bbcmaster: 896, // 896 x1
  commodore64: 1206, // 402 x3
  pet: 1080, // 360 x3
  vic20: 928, // 232 x4
  atom: 1024, // 256 (default) x4
  trs80: 1024, // 512 x2
  cpc464: 1280, // 640 x2
  cpc664: 1280, // 640 x2
  cpc6128: 1280, // 640 x2
  altair8800: 1280, // 640 x2
  pmd85: 1152, // 288 x4
  apple1: 1120, // 280 x4
  apple2: 1120, // 280 x4
  apple2plus: 1120, // 280 x4
  atari800: 1152, // 384 x3
  atari400: 1152, // 384 x3
};

describe('screenshotScale', () => {
  it('enlarges every registered machine to a legible whole-number size', () => {
    const widths: Record<string, number> = {};
    for (const dialect of dialects) {
      const width = dialect.displaySize?.width ?? DEFAULT_WIDTH;
      const scale = screenshotScale(width);
      expect(Number.isInteger(scale), dialect.id).toBe(true);
      expect(scale, dialect.id).toBeGreaterThanOrEqual(1);
      widths[dialect.id] = width * scale;
    }
    expect(
      widths,
      'a machine was added or its display size changed - check the saved screenshot is still a sensible size',
    ).toEqual(EXPECTED_WIDTHS);
  });

  it('never shrinks a machine already wider than the target', () => {
    expect(screenshotScale(SCREENSHOT_TARGET_WIDTH * 3)).toBe(1);
  });

  it('falls back to the default width for a nonsensical one', () => {
    // Guards against a NaN or zero canvas width producing an Infinity scale and
    // a canvas allocation the browser refuses.
    expect(screenshotScale(0)).toBe(screenshotScale(DEFAULT_WIDTH));
    expect(screenshotScale(Number.NaN)).toBe(screenshotScale(DEFAULT_WIDTH));
  });
});

describe('screenshotFileName', () => {
  const when = new Date(2026, 7, 13, 9, 4, 5);

  it('names an untitled document after PROGRAM, as the exports do', () => {
    expect(screenshotFileName('untitled.txt', when)).toBe(
      'program-20260813-090405.png',
    );
  });

  it('names a saved document after the program', () => {
    expect(screenshotFileName('Breakout.txt', when)).toBe(
      'breakout-20260813-090405.png',
    );
  });

  it('truncates a long name the same way the tape header does', () => {
    expect(screenshotFileName('superlongname.txt', when)).toBe(
      'superlongn-20260813-090405.png',
    );
  });

  it('zero-pads every timestamp field', () => {
    expect(screenshotFileName('game.txt', new Date(2026, 0, 2, 3, 4, 5))).toBe(
      'game-20260102-030405.png',
    );
  });

  it('distinguishes two screenshots of the same program', () => {
    const first = screenshotFileName(
      'game.txt',
      new Date(2026, 7, 13, 9, 4, 5),
    );
    const second = screenshotFileName(
      'game.txt',
      new Date(2026, 7, 13, 9, 4, 6),
    );
    expect(first).not.toBe(second);
  });
});
