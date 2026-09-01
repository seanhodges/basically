// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  Block,
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineFileStore,
  MachineScreenText,
  TapeFile,
} from '../../dialects/types';
import type { MsxModel } from './model';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';

/**
 * An MSX1 computer: the vendored Z80 core over the MSX bus - the primary slot
 * register, the TMS9918A-family VDP, the 8255 PPI and the shared AY-family
 * PSG - configured for one machine by an {@link MsxModel}.
 *
 * Two things separate this bus from the other Z80 machines here. There is no
 * CPU contention to model: MSX1 inserts no wait states, and the timing
 * constraint the hardware imposes (the interval software must leave between
 * VRAM accesses) is the program's problem rather than the bus's. And video
 * memory is a second address space the CPU can only reach through two I/O
 * ports, which is why MSX BASIC has VPOKE and VPEEK at all.
 */
export class MsxMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  constructor(_opts: {
    rom: Uint8Array;
    model: MsxModel;
    files?: MachineFileStore;
  }) {
    throw new Error('msx: machine not implemented');
  }

  /** PAL is 313 lines and NTSC 262, so neither is a round rate. */
  get frameHz(): number {
    throw new Error('msx: machine not implemented');
  }

  reset(): void {
    throw new Error('msx: machine not implemented');
  }

  loadProgram(
    _image: Uint8Array,
    _opts?: {
      blocks?: readonly Block[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array;
    },
  ): void {
    throw new Error('msx: machine not implemented');
  }

  runFrame(): void {
    throw new Error('msx: machine not implemented');
  }

  debugStep(_opts: DebugStepOptions): DebugStepResult {
    throw new Error('msx: machine not implemented');
  }

  currentLine(): number | null {
    throw new Error('msx: machine not implemented');
  }

  isProgramRunning(): boolean | null {
    throw new Error('msx: machine not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('msx: machine not implemented');
  }

  readScreenText(): MachineScreenText | null {
    throw new Error('msx: machine not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('msx: machine not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('msx: machine not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('msx: machine not implemented');
  }

  dispose(): void {
    throw new Error('msx: machine not implemented');
  }
}
