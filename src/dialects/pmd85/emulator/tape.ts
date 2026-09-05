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
 *
 * **The two directions meet at the file store.** Given one, the deck cuts each
 * completed file out of what was recorded, keeps it, and puts it on the tape it
 * is playing - which is what lets a program `DSAVE` an array and `DLOAD` it
 * back inside the same run. Without a store the deck records and plays as it
 * always did and keeps nothing.
 */

import type { MachineFileStore } from '../../types';
import { tapeSlots } from '../audio/cassetteEncoder';
import {
  HEADER_BLOCK_BYTES,
  parseTapeImage,
  storedFileName,
  type Pmd85TapeFile,
} from '../tape';
import { CPU_HZ } from './clock';

/** CPU cycles per half-bit slot: 2.048 MHz over 2400 slots a second. */
export const CYCLES_PER_SLOT = CPU_HZ / 2400;

/** Silence between the end of the tape and its start coming round again, in ms. */
const LOOP_GAP_MS = 1500;

/** Offset of the body length field within a header block; it holds length - 1. */
const HEADER_LENGTH_FIELD = 52;

export class Pmd85TapeDeck {
  private slots = new Int8Array(0);
  private startCycle = 0;
  private written: number[] = [];
  /** What is on the tape now, so a file the program just saved can be added. */
  private playing: Pmd85TapeFile[] = [];
  /** Bytes recorded since the last complete file was cut out of the stream. */
  private pending: number[] = [];

  /**
   * @param store where a completed `SAVE`/`DSAVE` is kept, and where the tape
   *   is refilled from, or undefined when the IDE handed this machine none.
   */
  constructor(private readonly store?: MachineFileStore) {}

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
    this.playing = [...files];
    this.reel(cycle);
  }

  /** Re-encode {@link playing} and start it turning again from its leader. */
  private reel(cycle: number): void {
    this.slots = tapeSlots(this.playing, { gapMs: LOOP_GAP_MS });
    this.startCycle = cycle;
  }

  /** Take the tape out, and throw away anything recorded onto it. */
  eject(): void {
    this.slots = new Int8Array(0);
    this.startCycle = 0;
    this.written = [];
    this.playing = [];
    this.pending = [];
  }

  /** Every file the store already holds, as tape files this deck can play. */
  filesFromStore(): Pmd85TapeFile[] {
    if (!this.store) return [];
    return this.store
      .list()
      .flatMap((entry) => {
        const bytes = this.store!.load(entry.name);
        return bytes ? parseTapeImage(bytes).files : [];
      })
      .filter((file) => file !== undefined);
  }

  /**
   * One byte handed to the USART's transmitter, i.e. written to tape.
   *
   * A byte at a time is all the hardware offers - the 8251 has no notion of a
   * file - so the end of a `SAVE` has to be recognised in the stream itself.
   * The header block says how long its body is, which makes a complete file
   * exactly measurable, and the moment one is: it goes to the store, and onto
   * the tape, so a program that saves data and then loads it back finds it
   * without a human to rewind anything.
   */
  record(byte: number, cycle: number): void {
    this.written.push(byte & 0xff);
    if (!this.store) return;
    this.pending.push(byte & 0xff);
    const complete = this.cutCompleteFile();
    if (!complete) return;
    for (const file of parseTapeImage(complete).files) {
      this.store.save(storedFileName(file.header), complete, { kind: 'data' });
      this.playing.push(file);
    }
    this.reel(cycle);
  }

  /**
   * The bytes of one whole file if {@link pending} now holds one, removing them
   * from the buffer; otherwise null.
   *
   * A file is a 63-byte header block and then the body: the length field holds
   * one less than the body, and one checksum byte follows it. Anything that is
   * not a header block where a header block should be is a recording this deck
   * cannot cut up - a `SAVE` interrupted, or bytes some other code emitted - so
   * the buffer is abandoned rather than left to swallow every later save.
   */
  private cutCompleteFile(): Uint8Array | null {
    if (this.pending.length < HEADER_BLOCK_BYTES) return null;
    const lo = this.pending[HEADER_LENGTH_FIELD]!;
    const hi = this.pending[HEADER_LENGTH_FIELD + 1]!;
    const total = HEADER_BLOCK_BYTES + (lo | (hi << 8)) + 2;
    if (this.pending.length < total) return null;
    const bytes = Uint8Array.from(this.pending.slice(0, total));
    this.pending = this.pending.slice(total);
    return parseTapeImage(bytes).files.length === 1 ? bytes : null;
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
