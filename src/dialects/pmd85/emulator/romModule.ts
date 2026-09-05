// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The four I/O addresses the ROM Module's MHB8255A answers on.
 *
 * The PMD 85 decodes a port as `1xxx10aa`, so the chip in fact answers on eight
 * addresses; 0xF8-0xFB is the set both ROMs use and the one worth naming.
 */
export const PORT_DATA = 0xf8; // port A, input:  the byte at the current address
export const PORT_ADDRESS_LOW = 0xf9; // port B, output: A0-A7
export const PORT_ADDRESS_HIGH = 0xfa; // port C, output: A8-A14 plus the enable
export const PORT_CONTROL = 0xfb; // the 8255's own mode register

/**
 * The mode word the Monitor writes before every transfer: port A input, ports
 * B and C output, all three in mode 0. Named because it is the one control word
 * this chip is ever given, and because its port A direction is what makes the
 * data port readable at all.
 */
export const CONTROL_WORD = 0x90;

/**
 * Address bit 15 is not an address bit: it is the module's chip select, active
 * low. The Monitor parks 0xFF in the high byte when it has finished reading,
 * which deselects the module rather than pointing at address 0xFF00.
 */
const ENABLE_MASK = 0x80;

/** What port A reads with the module deselected or the address past its end. */
const NOT_DRIVEN = 0xff;

/**
 * The replaceable ROM Module that holds BASIC-G.
 *
 * The module is not in the CPU's address space at all, and this is the single
 * most consequential fact about the machine. It is a cartridge on the back
 * panel wired to an MHB8255A: the CPU puts an address on ports B and C, and the
 * byte at that address appears on port A. The Monitor's TRANSFER routine at
 * 0x8C00 is a fourteen-instruction loop around exactly that, copying a block of
 * the module into RAM; there is no way to execute from the module, and nothing
 * in it is visible to a debugger looking at memory.
 *
 * TRANSFER is also the reason this class keeps the address in two halves rather
 * than as one number. The loop increments the address by reading port B back,
 * adding one and writing it out again, carrying into port C only when it wraps:
 *
 *     IN A,($F9) / INC A / OUT ($F9),A / JP NZ,skip / IN A,($FA) / INC A / OUT ($FA),A
 *
 * Both of those reads are of ports the same control word configured as
 * *outputs*, and they work because an 8255 in mode 0 returns the last value
 * written to an output port. A model that answered an output port with its
 * input source - or with 0xFF - would break the address counter on its first
 * carry, and the interpreter would arrive in RAM with every 256th byte onward
 * taken from the wrong place.
 *
 * `src/emulator/cpc/ppi.ts` is the project's other 8255, wired to entirely
 * different things; the two share no code because they share no behaviour
 * beyond the register file.
 */
export class Pmd85RomModule {
  private addressLow = 0;
  private addressHigh = 0;

  constructor(private readonly contents: Uint8Array) {}

  /** True when a module is actually plugged in - an empty image is no module. */
  get present(): boolean {
    return this.contents.length > 0;
  }

  /** The address ports B and C currently hold, for tests and debugging. */
  get address(): number {
    return ((this.addressHigh & ~ENABLE_MASK & 0xff) << 8) | this.addressLow;
  }

  /** True while port C's top bit holds the module selected. */
  get selected(): boolean {
    return (this.addressHigh & ENABLE_MASK) === 0;
  }

  reset(): void {
    this.addressLow = 0;
    this.addressHigh = 0;
  }

  readPort(port: number): number {
    switch (port & 0x03) {
      case PORT_DATA & 0x03:
        return this.readByte();
      // Ports B and C are outputs, and an 8255 in mode 0 reads an output port
      // back as its latch. TRANSFER's address counter depends on it.
      case PORT_ADDRESS_LOW & 0x03:
        return this.addressLow;
      case PORT_ADDRESS_HIGH & 0x03:
        return this.addressHigh;
      default:
        return NOT_DRIVEN; // the mode register is write-only
    }
  }

  writePort(port: number, value: number): void {
    const v = value & 0xff;
    switch (port & 0x03) {
      case PORT_DATA & 0x03:
        return; // port A is an input; the CPU never drives it
      case PORT_ADDRESS_LOW & 0x03:
        this.addressLow = v;
        return;
      case PORT_ADDRESS_HIGH & 0x03:
        this.addressHigh = v;
        return;
      default:
        this.writeControl(v);
        return;
    }
  }

  /**
   * The 8255 control register, in both of its forms. Bit 7 set is a mode word,
   * which this chip only ever receives as {@link CONTROL_WORD} and which resets
   * the port latches; bit 7 clear is a single-bit set/reset on port C, which
   * would move one address line or the chip select on its own. Neither ROM uses
   * the bit form, but it costs three lines to be a working 8255 rather than a
   * decoder for one instruction sequence.
   */
  private writeControl(value: number): void {
    if (value & 0x80) {
      this.addressLow = 0;
      this.addressHigh = 0;
      return;
    }
    const bit = (value >> 1) & 0x07;
    if (value & 0x01) this.addressHigh |= 1 << bit;
    else this.addressHigh &= ~(1 << bit) & 0xff;
  }

  /**
   * The byte at the selected address, or a floating bus.
   *
   * The out-of-range answer is load bearing exactly once, and by one byte:
   * TRANSFER's loop tests only the high half of its count, so a transfer of
   * 0x23F4 bytes moves 0x23F5 of them and the last read is one past the end of
   * a 9K module. It lands at 0x23F4 in RAM, below where BASIC-G puts a program,
   * and nothing ever reads it.
   */
  private readByte(): number {
    if (!this.selected) return NOT_DRIVEN;
    return this.contents[this.address] ?? NOT_DRIVEN;
  }
}
