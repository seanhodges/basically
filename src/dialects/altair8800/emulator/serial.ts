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
 * The port numbers and the polarity of the status bits must be read off the
 * 88-2SIO manual and cited in `addresses.ts` - the 2SIO's ready flags are
 * active-low, which is exactly the kind of detail that silently produces a
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
