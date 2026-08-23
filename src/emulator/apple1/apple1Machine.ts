// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  MachineEmulator,
  MachineScreenText,
  MemoryBlock,
} from '../../dialects/types';

/**
 * The Apple I as a {@link MachineEmulator}: the vendored 6502 core in
 * `src/emulator/6502/` on a hand-written bus, alongside the PET's and the
 * VIC-20's.
 *
 * Two parts of the real machine are modelled as logic rather than as images.
 * The terminal section - a shift-register display, its sequencing logic and the
 * Signetics 2513 character generator - is none of it CPU-addressable, so
 * `terminal.ts` models the 40x24 grid, its hardware scroll and the DSP busy bit
 * directly. The Apple Cassette Interface's PROM is replaced by a host-side codec
 * of the same FSK encoding. What is left is the two pieces of 6502 object code
 * that cannot be anything but themselves - WozMon and Integer BASIC - and those
 * the user supplies as one concatenated image.
 *
 * The machine therefore stays constructible with an empty or monitor-only image
 * and says so on its own terminal rather than throwing, the way the Altair does.
 */
export class Apple1Machine implements MachineEmulator {
  readonly frameHz = 60;
  readonly displayWidth = 280;
  readonly displayHeight = 192;

  constructor(_opts: { rom: Uint8Array }) {
    throw new Error('apple1: not implemented');
  }

  reset(): void {
    throw new Error('apple1: not implemented');
  }

  loadProgram(
    _image: Uint8Array,
    _opts?: { blocks?: readonly MemoryBlock[]; autoStart?: number | null },
  ): void {
    throw new Error('apple1: not implemented');
  }

  runFrame(): void {
    throw new Error('apple1: not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('apple1: not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('apple1: not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('apple1: not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('apple1: not implemented');
  }

  isProgramRunning(): boolean | null {
    throw new Error('apple1: not implemented');
  }

  readScreenText(): MachineScreenText | null {
    throw new Error('apple1: not implemented');
  }

  dispose(): void {
    throw new Error('apple1: not implemented');
  }
}
