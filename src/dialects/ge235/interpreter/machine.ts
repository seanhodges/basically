// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineEmulator, MachineScreenText } from '../../types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './terminal';

/**
 * The GE-235 backend is a clean-room interpreter, not a CPU emulation: no core
 * for this machine exists to vendor, and the surviving 1965 compiler is a
 * memory image of unstated licence. The TRS-80's interpreter is the pattern.
 *
 * `frameHz` is a CPU-time budget per frame rather than a video rate - the
 * machine had no video - which is how the Altair derives its own.
 */
export class Ge235InterpreterMachine implements MachineEmulator {
  readonly frameHz = 50;
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  reset(): void {
    throw new Error('ge235: not implemented');
  }

  loadProgram(_image: Uint8Array): void {
    throw new Error('ge235: not implemented');
  }

  runFrame(): void {
    throw new Error('ge235: not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('ge235: not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('ge235: not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('ge235: not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('ge235: not implemented');
  }

  /**
   * Required to answer, not merely to exist: a program that terminates must
   * report `true` and then `false` within a bounded number of frames.
   */
  isProgramRunning(): boolean | null {
    throw new Error('ge235: not implemented');
  }

  /** Not optional for a registered machine - see `screenReadable.test.ts`. */
  readScreenText(): MachineScreenText | null {
    throw new Error('ge235: not implemented');
  }

  dispose(): void {
    throw new Error('ge235: not implemented');
  }
}
