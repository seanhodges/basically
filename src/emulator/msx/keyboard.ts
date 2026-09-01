// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The MSX key matrix: eleven rows of eight columns on an international
 * machine. The PPI selects a row on port C's low nibble and reads it back on
 * port B, active low - so the keyboard is the PPI's own business here, unlike
 * the Amstrad, where the same 8255 reads the matrix through the sound chip.
 */
export class MsxKeyboard {
  /** Press or release an opaque key token from the virtual keyboard. */
  setKey(_token: string, _down: boolean): void {
    throw new Error('msx: keyboard not implemented');
  }

  releaseAll(): void {
    throw new Error('msx: keyboard not implemented');
  }

  /** The selected matrix row as the PPI's port B reads it. */
  readRow(_row: number): number {
    throw new Error('msx: keyboard not implemented');
  }
}
