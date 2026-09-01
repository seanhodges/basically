// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MsxModel } from './model';

/**
 * The MSX primary slot select register, written through the PPI's port A at
 * 0xA8: two bits per 16KB page choosing which of four primary slots answers
 * there. Slot 0 holds the BIOS at 0x0000 and MSX BASIC at 0x4000; RAM answers
 * in whichever slot the machine fits it in.
 *
 * Secondary slots (selected through 0xFFFF inside an expanded primary) are not
 * modelled - no machine here is expanded.
 */
export class MsxSlots {
  constructor(_rom: Uint8Array, _model: MsxModel) {
    throw new Error('msx: slots not implemented');
  }

  read(_addr: number): number {
    throw new Error('msx: slots not implemented');
  }

  write(_addr: number, _value: number): void {
    throw new Error('msx: slots not implemented');
  }

  /** The value written to PPI port A, one 2-bit slot number per page. */
  selectSlots(_value: number): void {
    throw new Error('msx: slots not implemented');
  }
}
