// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineScreenText } from '../../dialects/types';

/**
 * The characters on screen, read straight out of the VDP's name table.
 *
 * SCREEN 0 and SCREEN 1 store real character codes, so this machine needs no
 * font matching to recover its text - the graphics modes do, and report spaces
 * instead.
 */
export function readScreenText(
  _vram: Uint8Array,
  _registers: Uint8Array,
): MachineScreenText | null {
  throw new Error('msx: screen text not implemented');
}
