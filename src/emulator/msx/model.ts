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
}
