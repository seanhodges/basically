// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The serial bus, and the one thing on it: a disk drive with no disk in it.
 *
 * Every peripheral an Atari had hung off one daisy-chained serial port, and the
 * OS talks to all of them the same way. It pulls the COMMAND line low, clocks
 * out five bytes - device, command, two argument bytes and a checksum - lets
 * COMMAND go, and waits for the addressed device to answer. `A` acknowledges
 * the frame; `C` or `E` says whether the work was done; a status or data frame
 * follows, and the OS waits for all of it however the work went.
 *
 * ### Why anything is on the bus at all
 *
 * This machine has no disk drive, and the OS asks for one anyway: the BASIC
 * cartridge's header says a disk may boot ahead of it, so every power-on begins
 * by asking `D1:` for its status. Silence is a legitimate answer and is how a
 * bare machine really behaves - but the OS can only hear silence by timing out,
 * and it asks twenty-eight times before giving up. That is a second and a half
 * of the user's time on the front of every single run.
 *
 * So the bus carries the other configuration a real owner had: a drive switched
 * on with nothing in it, which answers the question rather than leaving it to
 * expire. The OS hears a definite "no disk here" at the first attempt, starts
 * the cartridge, and reaches BASIC in a fifth of the time.
 *
 * ### What is modelled, and what is not
 *
 * One exchange, and no command decoding. A real 810 with its door open
 * completes a status request and fails at the sector read that follows, which
 * is two exchanges to reach the same place; this drive reports the error at the
 * first question. Nothing beyond the boot ever reaches the bus, because without
 * DOS loaded there is no `D:` handler for a program's own file I/O to go
 * through - it fails inside CIO, several layers above here.
 */

/** Bytes in the command frame the OS clocks out: device, command, two args, sum. */
const COMMAND_FRAME_BYTES = 5;

/** The four disk drives' device ids, `D1:` to `D4:`. */
const FIRST_DISK = 0x31;
const LAST_DISK = 0x34;

/** The two bytes a device answers with: the frame arrived, and it went wrong. */
const ACK = 0x41; // 'A'
const ERROR = 0x45; // 'E'

/**
 * The four-byte status frame a drive returns, whatever it thought of the job.
 *
 * Byte 0 is the drive's own view of the command - bit 2 says the operation
 * failed. Byte 1 is the floppy controller's status register, whose top bit is
 * its NOT READY line, which is what having no disk in the drive looks like from
 * outside. Byte 2 is the timeout a format would need, in units of about a
 * sixteenth of a second, and byte 3 is unused.
 */
const STATUS_FRAME = [0x04, 0x80, 0xe0, 0x00] as const;

/**
 * CPU cycles one byte takes on the peripheral bus: ten bit times at the 19200
 * baud the OS drives it at. POKEY's own transmitter is timed off the same
 * figure, because it is the same wire.
 */
export const SIO_BYTE_CYCLES = Math.round((10 * 1_773_447) / 19200);

/** What POKEY hands the bus, and what the bus hands back. */
export interface SerialDevice {
  /** A byte the machine has clocked out of SEROUT onto the bus. */
  send(byte: number): void;
  /** The COMMAND line has been asserted or released. */
  setCommand(asserted: boolean): void;
  /** Advance by `cycles` and return a byte that has now arrived, or null. */
  poll(cycles: number): number | null;
}

/**
 * The checksum every SIO frame carries: a sum of its bytes with the carry added
 * back in, so it stays inside a byte without ever losing what overflowed.
 */
export function sioChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const byte of bytes) {
    sum += byte;
    if (sum > 0xff) sum = (sum & 0xff) + 1;
  }
  return sum;
}

export class AtariSerialBus implements SerialDevice {
  /** The command frame being clocked out, while COMMAND is held low. */
  private frame: number[] = [];
  private commanded = false;
  /** Bytes this device still owes the machine, and when the next is due. */
  private reply: number[] = [];
  private due = 0;

  reset(): void {
    this.frame = [];
    this.commanded = false;
    this.reply = [];
    this.due = 0;
  }

  setCommand(asserted: boolean): void {
    if (asserted === this.commanded) return;
    this.commanded = asserted;
    if (asserted) {
      this.frame = [];
      return;
    }
    // COMMAND released: whatever was clocked out while it was held is the
    // frame. Anything that is not five bytes addressed to a drive was meant for
    // something that is not on this bus - a printer, a modem, the cassette
    // recorder - and nothing answers it.
    const device = this.frame[0];
    const addressed =
      this.frame.length === COMMAND_FRAME_BYTES &&
      device !== undefined &&
      device >= FIRST_DISK &&
      device <= LAST_DISK;
    this.frame = [];
    if (!addressed) return;
    this.reply = [ACK, ERROR, ...STATUS_FRAME, sioChecksum(STATUS_FRAME)];
    this.due = SIO_BYTE_CYCLES;
  }

  send(byte: number): void {
    if (this.commanded) this.frame.push(byte & 0xff);
  }

  poll(cycles: number): number | null {
    if (this.reply.length === 0) return null;
    this.due -= cycles;
    if (this.due > 0) return null;
    this.due = SIO_BYTE_CYCLES;
    return this.reply.shift()!;
  }
}
