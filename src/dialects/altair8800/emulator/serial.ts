// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { SIO_RX_READY, SIO_TX_READY } from '../addresses';
import type { Altair8800Terminal } from './terminal';

/**
 * The MITS 88-2SIO serial board - the Altair's entire I/O surface as far as
 * BASIC is concerned, and the seam that replaces every other machine's video
 * chip and key matrix.
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
 * ACIA's own sense), not active-low as this dialect's plan first assumed.
 * Active-low is the 88-SIO at 0x00/0x01, which is the form the *unpatched*
 * image carries; BASIC rewrites its own driver at cold start from the sense
 * switches it reads at port 0xFF, so the machine must answer that port with
 * `SENSE_SWITCHES_2SIO`. Getting either detail wrong silently produces a
 * machine that boots and then never accepts a keystroke.
 *
 * Two simplifications, both deliberate:
 *
 *  - **The receive register is a queue, not one byte.** Real hardware held a
 *    single character and lost anything typed on top of it. Queueing means a
 *    typed line - or the scripted `RUN` the IDE sends - is delivered character
 *    by character as BASIC asks for it instead of overrunning. Each `IN data`
 *    still takes exactly one byte, so nothing about the driver's view changes.
 *  - **The transmitter is always ready.** There is no 300-baud shift register
 *    here, so TDRE never clears and BASIC never waits to print. Cassette timing
 *    is the 88-ACR's business, and that board is Stage 4's, not this one's.
 */
export class Altair8800Serial {
  private readonly input: number[] = [];

  constructor(private readonly terminal: Altair8800Terminal) {}

  /** Status-port read: the flag bits BASIC polls before reading or writing. */
  readStatus(): number {
    // Only the two bits BASIC's patched driver masks for are modelled; the
    // 6850's modem-control bits (DCD, CTS) are strapped inactive on the board's
    // console port and BASIC never looks at them.
    return (this.input.length > 0 ? SIO_RX_READY : 0) | SIO_TX_READY;
  }

  /** Data-port read: the next queued input byte. */
  readData(): number {
    // Reading the data register clears RDRF on a 6850, which is exactly what
    // taking the byte off the queue does here. An empty register would hold
    // whatever was last latched; 0 is as good a stand-in as any, and BASIC only
    // reads once the status bit says there is something to take.
    return this.input.shift() ?? 0;
  }

  /** Data-port write: one character out to the terminal. */
  writeData(byte: number): void {
    this.terminal.write(byte);
  }

  /**
   * Control-port write. BASIC's driver resets and configures the ACIA (master
   * reset 0x03, then the word-format byte) by writing to the *status* port
   * address. Nothing here is configurable - the console is always 8 bits, no
   * parity, always ready - so the write is accepted and discarded rather than
   * left to fall through the machine's I/O decode as an unknown port.
   */
  writeControl(_byte: number): void {}

  /** Queue a typed character for the machine to read. */
  queueInput(byte: number): void {
    this.input.push(byte & 0xff);
  }

  /** Queue an ASCII string a character at a time (scripted console input). */
  queueText(text: string): void {
    for (let i = 0; i < text.length; i++) this.queueInput(text.charCodeAt(i));
  }

  /** Bytes typed but not yet read by the machine. */
  get pendingInput(): number {
    return this.input.length;
  }

  /** Drop anything typed but not yet consumed (reset, program load). */
  clearInput(): void {
    this.input.length = 0;
  }
}
