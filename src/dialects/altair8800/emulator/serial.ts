// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The MITS 88-2SIO serial board (Stage 2) - the Altair's entire I/O surface as
 * far as BASIC is concerned, and the seam that replaces every other machine's
 * video chip and key matrix.
 *
 * 8K BASIC talks to the console through exactly two ports: a status port it
 * polls, and a data port it reads characters from and writes characters to.
 * Everything the user sees goes through `OUT data`, and everything they type
 * arrives via `IN data` once the status port says a character is waiting. That
 * makes this module the whole of the machine's personality:
 *
 *   IN  status -> "is there a key waiting? is the transmitter free?"
 *   IN  data   -> next byte from the keyboard queue
 *   OUT data   -> one byte to {@link Altair8800Terminal}
 *
 * The port numbers and the polarity of the status bits are settled and cited in
 * `addresses.ts`, read off the 8K BASIC image in Stage 1: status 0x10, data
 * 0x11, and the flags are **active high** (bit 0 RDRF, bit 1 TDRE - the 6850
 * ACIA's own sense), not active-low as this plan first assumed. Active-low is
 * the 88-SIO at 0x00/0x01, which is the form the *unpatched* image carries;
 * BASIC rewrites its own driver at cold start from the sense switches it reads
 * at port 0xFF, so the machine must answer that port with
 * `SENSE_SWITCHES_2SIO`. Getting either detail wrong silently produces a
 * machine that boots and then never accepts a keystroke.
 */
export class Altair8800Serial {
  /** Status-port read: the flag bits BASIC polls before reading or writing. */
  readStatus(): number {
    throw new Error('altair8800: not implemented');
  }

  /** Data-port read: the next queued input byte. */
  readData(): number {
    throw new Error('altair8800: not implemented');
  }

  /** Data-port write: one character out to the terminal. */
  writeData(_byte: number): void {
    throw new Error('altair8800: not implemented');
  }

  /** Queue a typed character for the machine to read. */
  queueInput(_byte: number): void {
    throw new Error('altair8800: not implemented');
  }
}
