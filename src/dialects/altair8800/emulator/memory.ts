// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair's memory (Stage 2) - notable mainly for how little there is to it.
 *
 * The machine is a bare S-100 backplane: flat RAM from 0x0000 up to whatever
 * boards are fitted, no memory-mapped video, no I/O page, no banking. That
 * makes this the simplest bus in the project - almost all of the machine's
 * behaviour lives in `serial.ts` instead.
 *
 * The one structural surprise is that **there is no ROM**. The base Altair
 * shipped with no firmware at all: you either toggled a bootstrap in on the
 * front-panel switches or, more usually, loaded BASIC itself from paper tape,
 * where it sat in RAM from 0x0000 upwards. So `loadInterpreter` *copies* the
 * 8K BASIC image into RAM rather than mapping it read-only, and a POKE into
 * that region really does corrupt the interpreter, exactly as it did in 1975.
 */
export class Altair8800Memory {
  /** 64K flat address space; only the fitted portion is backed by real boards. */
  readonly bytes = new Uint8Array(0x10000);

  /** Copy the Altair BASIC image into RAM at its load origin. */
  loadInterpreter(_image: Uint8Array): void {
    throw new Error('altair8800: not implemented');
  }

  read(_address: number): number {
    throw new Error('altair8800: not implemented');
  }

  write(_address: number, _value: number): void {
    throw new Error('altair8800: not implemented');
  }
}
