// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The PMD 85 key matrix, scanned through the motherboard 8255 - which also
 * carries the speaker and the front-panel LEDs, so the three share a chip.
 *
 * The PMD 85-1 evaluates an alphanumeric key at the moment it is *released*;
 * the -2 this dialect targets has autorepeat instead.
 */
export class Pmd85Keyboard {
  setKey(_token: string, _down: boolean): void {
    throw new Error('pmd85: not implemented');
  }

  releaseAll(): void {
    throw new Error('pmd85: not implemented');
  }

  /** Matrix row read back by the 8255 scan. */
  readRow(_row: number): number {
    throw new Error('pmd85: not implemented');
  }
}
