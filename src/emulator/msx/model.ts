// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What distinguishes one MSX from another.
 *
 * MSX is a published standard rather than a machine, so the bus, the VDP, the
 * PPI and the PSG are shared and each computer is a set of parameters over
 * them. The support object keeps every machine's own knowledge in its own
 * dialect folder: branch on a model name inside the machine instead and the
 * whole family's quirks collect in one file.
 */
export interface MsxModel {
  /** RAM fitted, in KB, and the primary slot it answers in. */
  ramKb: number;
  ramSlot: number;
  /** Decides the VDP's line count, and with it the frame rate. */
  region: 'pal' | 'ntsc';
  /**
   * Which TMS9918A-family part is fitted. The Toshiba T6950 clone omits the
   * undocumented mixed screen modes the original supports.
   */
  vdp: 'tms9918a' | 't6950';
  /** Which international key matrix the BIOS scans. */
  keyboardId: string;
  /**
   * What answers in page 3 (0xC000-0xFFFF) of slot 0, above the 32KB of ROM
   * the standard puts in pages 0 and 1.
   *
   * `'empty'` is the ordinary MSX, where nothing is fitted there and the bus
   * floats high. `'ram-mirror'` is a Sony decoding shortcut - the HB-10P and
   * early HB-20P answer that page with the main RAM's own page 3 whichever
   * slot is selected - and it is load-bearing rather than cosmetic: the BIOS
   * finds RAM in slot 0 during its slot search and the machine then runs with
   * page 3 pointing at a slot that on any other MSX holds nothing.
   */
  slot0Page3: 'empty' | 'ram-mirror';
}
