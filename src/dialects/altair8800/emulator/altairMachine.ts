// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineEmulator, MemoryBlock } from '../../types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './terminal';

/**
 * Cycles of 8080 time per 50Hz frame: 2 MHz / 50. The Altair's 8080A ran at
 * 2 MHz, twice the ZX81's effective rate and a shade over the TRS-80's 1.77 MHz
 * Z80.
 */
export const CYCLES_PER_FRAME = 40_000;

/**
 * The Altair 8800 as a {@link MachineEmulator} (Stage 2): a flat S-100 memory
 * bus and an 88-2SIO serial console, driven by the vendored Z80 core in
 * `src/emulator/z80/` executing Intel 8080 object code.
 *
 * **Why the Z80 core.** The Z80 was designed to be binary-compatible with the
 * 8080, so it executes Altair BASIC's object code directly and this project
 * needs no new CPU core. Two divergences have to be handled in *this adapter* -
 * never by editing the vendored core, which is shared with six shipped
 * machines:
 *
 *  1. **Flags.** The 8080's P flag is always parity; the Z80 reuses that bit as
 *     P/V, which holds *overflow* after arithmetic. 8K BASIC does branch on
 *     parity, so a JP PE/PO after an ADD can take the wrong arm.
 *  2. **DAA after subtraction.** The Z80 consults its N flag; the 8080 has no
 *     N flag and always adjusts as if for addition.
 *
 * Stage 2 must decide whether to correct these in the adapter or accept the
 * divergence, and say which in the plan - "it mostly works" is how subtly wrong
 * arithmetic ships.
 *
 * **The ROM that isn't.** `opts.rom` carries the Altair 8K BASIC image, which
 * this project does not and cannot ship: it is Microsoft copyright with no
 * redistribution grant (their 2025 open-source release was the *6502* BASIC).
 * The user supplies their own at `public/roms/altair8800.rom`. The machine must
 * therefore stay constructible with an empty image and report that state
 * clearly rather than throwing a raw fetch error - see the plan's Stage 3.
 */
export class Altair8800Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  constructor(_opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    throw new Error('altair8800: not implemented');
  }

  reset(): void {
    throw new Error('altair8800: not implemented');
  }

  loadProgram(
    _image: Uint8Array,
    _opts?: { blocks?: readonly MemoryBlock[] },
  ): void {
    throw new Error('altair8800: not implemented');
  }

  runFrame(): void {
    throw new Error('altair8800: not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('altair8800: not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('altair8800: not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('altair8800: not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('altair8800: not implemented');
  }

  setSpeed(_multiplier: number): void {
    throw new Error('altair8800: not implemented');
  }

  dispose(): void {
    throw new Error('altair8800: not implemented');
  }
}
