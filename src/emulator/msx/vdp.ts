// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MsxModel } from './model';

/**
 * The TMS9918A-family video display processor: 16KB of VRAM in an address
 * space of its own, reached by the CPU only through ports 0x98 (data, with an
 * auto-incrementing address latch) and 0x99 (register write / status read).
 *
 * The separate address space is the fact that shapes everything above it - MSX
 * BASIC's VPOKE and VPEEK exist because a CPU POKE cannot reach the screen.
 */
export class Tms9918 {
  constructor(_model: MsxModel) {
    throw new Error('msx: VDP not implemented');
  }

  /** Port 0x98: read or write VRAM at the latched address, then advance it. */
  readData(): number {
    throw new Error('msx: VDP not implemented');
  }

  writeData(_value: number): void {
    throw new Error('msx: VDP not implemented');
  }

  /** Port 0x99: latch an address, write a register, or read the status byte. */
  readStatus(): number {
    throw new Error('msx: VDP not implemented');
  }

  writeControl(_value: number): void {
    throw new Error('msx: VDP not implemented');
  }
}
