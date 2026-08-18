// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The replaceable ROM Module that holds BASIC-G.
 *
 * The module is not in the CPU address space at all. It is read a byte at a
 * time through an MHB8255A PPI at ports 0xF8-0xFB (PA/PB/PC/control), gated by
 * port C bit 7 held low, and the Monitor's TRANSFER routine at 0x8C00 copies it
 * down into RAM before anything runs. On the PMD 85-2 the Monitor launches the
 * module automatically after reset when its first byte is 0xCD.
 *
 * `src/emulator/cpc/ppi.ts` is the project's exemplar for an 8255 and for the
 * standard a chip module's comments are held to; read it before filling this in.
 */
export class Pmd85RomModule {
  constructor(_contents: Uint8Array) {}

  readPort(_port: number): number {
    throw new Error('pmd85: not implemented');
  }

  writePort(_port: number, _value: number): void {
    throw new Error('pmd85: not implemented');
  }
}
