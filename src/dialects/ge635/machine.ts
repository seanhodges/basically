// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineEmulator } from '../types';

/**
 * The GE-635's backend, which is a shim rather than an interpreter of its own:
 * this machine and the GE-235 run one shared Dartmouth interpreter, and what
 * separates them is the profile each supplies - its keyword table, its charset
 * and its limits.
 *
 * Not written yet, and it cannot be until that shared core exists.
 */
export class Ge635InterpreterMachine implements MachineEmulator {
  readonly frameHz = 50;
  readonly displayWidth = 576;
  readonly displayHeight = 384;

  reset(): void {
    throw new Error('ge635: emulator not implemented');
  }

  loadProgram(_image: Uint8Array): void {
    throw new Error('ge635: emulator not implemented');
  }

  runFrame(): void {
    throw new Error('ge635: emulator not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('ge635: emulator not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('ge635: emulator not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('ge635: emulator not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('ge635: emulator not implemented');
  }

  isProgramRunning(): boolean | null {
    throw new Error('ge635: emulator not implemented');
  }

  dispose(): void {
    throw new Error('ge635: emulator not implemented');
  }
}
