// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineEmulator, MemoryBlock, TapeFile } from '../../types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';

/** The MHB8080A's clock: an 18.432 MHz crystal divided by nine. */
export const CPU_HZ = 18_432_000 / 9;

/** Cycles of 8080 time per displayed frame. */
export const CYCLES_PER_FRAME = CPU_HZ / 50;

/**
 * The PMD 85-2 as a {@link MachineEmulator}: an 8080 bus driven by the vendored
 * Z80 core in `src/emulator/z80/`, which executes 8080 object code directly.
 *
 * Two 8080/Z80 flag divergences have to be corrected in the adapter layer - the
 * P flag, which the 8080 always fills with parity where the Z80 fills it with
 * signed overflow, and DAA, which the 8080 always applies as if for an addition
 * because it has no N flag. Both are already solved in the Altair's adapter, and
 * this is the project's second 8080, so they belong in a module the two share
 * rather than copied. The vendored core itself is never edited: six shipped
 * machines depend on it.
 */
export class Pmd85Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  /**
   * `monitor` is the 4K Monitor ROM and `romModule` the BASIC-G module; they
   * arrive concatenated in the dialect's single ROM image and are split apart
   * before construction, the way the 128K Spectrum carries its two halves.
   */
  constructor(_opts: { monitor: Uint8Array; romModule: Uint8Array }) {}

  reset(): void {
    throw new Error('pmd85: not implemented');
  }

  loadProgram(
    _image: Uint8Array,
    _opts?: {
      blocks?: readonly MemoryBlock[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array;
    },
  ): void {
    throw new Error('pmd85: not implemented');
  }

  runFrame(): void {
    throw new Error('pmd85: not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('pmd85: not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('pmd85: not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('pmd85: not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('pmd85: not implemented');
  }

  isProgramRunning(): boolean | null {
    throw new Error('pmd85: not implemented');
  }

  dispose(): void {
    throw new Error('pmd85: not implemented');
  }
}
