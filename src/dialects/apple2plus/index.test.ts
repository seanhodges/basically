// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { apple2Charset } from '../apple2/charset';
import { apple2KeyboardLayout } from '../apple2/keyboardLayout';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { COLD_START_BYTES_FREE, FIRMWARE_BYTES } from './addresses';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from '../apple2/addresses';
import { romFor } from '../bootHarness';

describe('apple2plus dialect', () => {
  it('shares the sibling’s charset rather than copying it', () => {
    // The 2513 font and the normal/flash/inverse encoding belong to the board,
    // not to the BASIC in its sockets. Identity rather than equality: a copy
    // could drift, and there is no second mapping here to test.
    expect(apple2plus.charset).toBe(apple2Charset);
  });

  it('tokenizes and lists a program back through the seam', () => {
    const source = '10 HGR : HCOLOR= 3\n20 HPLOT 0,0 TO 279,159\n';
    const { image, errors, byteSize } = apple2plus.tokenize(source);
    expect(errors).toEqual([]);
    expect(byteSize).toBe(image.length);
    expect(apple2plus.detokenize(image)).toBe(source);
  });

  it('lints the name the parser will break', () => {
    // LATCH stores as L, the AT token and CH. The tokenizer reproduces that;
    // this is where the reader is told.
    const errors = apple2plus.lint('10 LATCH=1\n');
    expect(errors.some((e) => /LATCH/.test(e.message))).toBe(true);
  });

  it('shares the sibling’s keyboard under its own identity', () => {
    // Same keys, same encoder: what is this dialect's is the id and the theme.
    expect(apple2plus.keyboardLayout!.rows).toBe(apple2KeyboardLayout.rows);
    expect(apple2plus.keyboardLayout!.id).toBe('apple2plus');
  });

  it('builds the shared Apple II machine on its own ROM', () => {
    // The board is the sibling's; the interpreter in its sockets is not, and
    // that is the whole of the difference between the two `createEmulator`s.
    const machine = apple2plus.createEmulator({
      rom: romFor(apple2plus.romUrl),
      ramKb: 16,
    });
    try {
      expect(machine).toBeInstanceOf(Apple2Machine);
      expect(machine.displayWidth).toBe(DISPLAY_WIDTH);
      expect(machine.displayHeight).toBe(DISPLAY_HEIGHT);
      // The whole $D000-$FFFF window, Applesoft and the Autostart Monitor.
      expect(apple2plus.romBytes).toBe(FIRMWARE_BYTES);
      expect(apple2plus.debuggable).toBe(true);
    } finally {
      machine.dispose?.();
    }
  });

  it('declares the workspace the machine reports', () => {
    // $C000 - $0801. `PRINT FRE(0)` answers two less, having already spent the
    // empty program's zero link.
    expect(COLD_START_BYTES_FREE).toBe(47103);
    expect(apple2plus.programRamBytes).toBe(COLD_START_BYTES_FREE);
  });
});
