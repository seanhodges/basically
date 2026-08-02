// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair 8800's fixed addresses and I/O ports, declared once for the whole
 * dialect (Stage 1 of `docs/contributing/dialect-plans/altair8800.md`).
 *
 * Nothing here is filled in yet, and deliberately so: every value below has to
 * be read off a primary source - the MITS *Altair BASIC Reference Manual*, the
 * 88-2SIO board manual, or a disassembly of the 8K image - and cited where it
 * is declared. A plausible-looking guess in this file would propagate silently
 * into the memory map, the linter and the emulator, so the scaffold throws
 * instead of offering one.
 *
 * Note the machine's unusual shape: Altair BASIC is **not** a ROM. The base
 * Altair had no firmware at all, and BASIC was loaded into RAM from paper tape
 * or cassette, running from 0x0000 upwards. So `basicBase` below is where the
 * interpreter image is *copied to*, not a mapped ROM region.
 */
export interface Altair8800Addresses {
  /** Where the BASIC interpreter image is loaded in RAM (paper-tape origin). */
  basicBase: number;
  /** First byte of the tokenized BASIC program text, above the interpreter. */
  programBase: number;
  /** Top of installed RAM for the modelled machine configuration. */
  ramTop: number;
  /** 88-2SIO status port: TX-buffer-empty / RX-data-ready flags. */
  sioStatusPort: number;
  /** 88-2SIO data port: character in / character out. */
  sioDataPort: number;
}

/**
 * The machine's addresses. Throws until Stage 1 derives and cites each value.
 */
export function altair8800Addresses(): Altair8800Addresses {
  throw new Error('altair8800: not implemented');
}
