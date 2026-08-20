// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The cassette input, as this machine actually reads it.
 *
 * There is no receiver in the 8251 to speak of. The tape interface board on a
 * PMD 85-2 clocks the USART's transmitter from the 8253 but leaves its receive
 * clock unconnected, and wires the tape's read amplifier to the chip's **DSR**
 * pin instead - a modem status input the CPU sees as bit 7 of the status
 * register. So `LOAD` is a software receiver: the Monitor polls that one bit,
 * times the transitions itself, and reconstructs the bits. That is why this
 * deck offers a *level at a moment in time* rather than a stream of bytes -
 * the level is the whole interface.
 *
 * The tape it plays is built by the same code that writes the `.wav` export
 * (`../audio/cassetteEncoder.ts`), so a program that loads here would load off
 * the exported recording, and one that does not, would not.
 *
 * **The tape loops.** A program that reaches its `LOAD` a few seconds after the
 * machine started would otherwise find the tape already run past its end, and
 * there is no user here to rewind it.
 *
 * Writing is the easy direction and is modelled as far as the recorder is: the
 * transmitter *is* clocked, so `SAVE` hands the USART one byte at a time and
 * the blocks it wrote come back from {@link recorded}.
 */

import { tapeSlots } from '../audio/cassetteEncoder';
import type { Pmd85TapeFile } from '../tape';
import { CPU_HZ } from './clock';

/** CPU cycles per half-bit slot: 2.048 MHz over 2400 slots a second. */
export const CYCLES_PER_SLOT = CPU_HZ / 2400;

/** Silence between the end of the tape and its start coming round again, in ms. */
const LOOP_GAP_MS = 1500;

export class Pmd85TapeDeck {
  private slots = new Int8Array(0);
  private startCycle = 0;
  private written: number[] = [];

  /** True while there is a tape to read. */
  get loaded(): boolean {
    return this.slots.length > 0;
  }

  /**
   * Put files on the tape and start it running at `cycle`.
   *
   * The leaders are the ones a real recorder carries, because the Monitor's
   * receiver needs the carrier to lock onto before the first byte arrives.
   */
  play(files: readonly Pmd85TapeFile[], cycle: number): void {
    this.slots = tapeSlots(files, { gapMs: LOOP_GAP_MS });
    this.startCycle = cycle;
  }

  /** Take the tape out, and throw away anything recorded onto it. */
  eject(): void {
    this.slots = new Int8Array(0);
    this.startCycle = 0;
    this.written = [];
  }

  /** One byte handed to the USART's transmitter, i.e. written to tape. */
  record(byte: number): void {
    this.written.push(byte & 0xff);
  }

  /**
   * Everything written to tape since the machine was reset: the header block
   * and body block of each `SAVE`, back to back and with no framing between
   * them, which is exactly a `.pmd` image.
   */
  get recorded(): Uint8Array {
    return new Uint8Array(this.written);
  }

  /**
   * The level on the tape input at `cycle`: what the DSR bit reads.
   *
   * False with no tape, and through the silence of a gap - the same thing the
   * status register said before this machine had a deck at all.
   */
  level(cycle: number): boolean {
    if (this.slots.length === 0) return false;
    const elapsed = Math.max(0, cycle - this.startCycle);
    const slot = Math.floor(elapsed / CYCLES_PER_SLOT) % this.slots.length;
    return this.slots[slot]! > 0;
  }
}
