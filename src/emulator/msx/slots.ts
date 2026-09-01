// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MsxModel } from './model';

/** Every MSX address space is four 16KB pages, one slot number each. */
export const PAGE_SIZE = 0x4000;
export const PAGE_COUNT = 4;
/** The BIOS and MSX BASIC together, in pages 0 and 1 of slot 0. */
export const SYSTEM_ROM_BYTES = 2 * PAGE_SIZE;
/** An unfitted slot floats the data bus high. */
const OPEN_BUS = 0xff;

/**
 * The MSX primary slot select register, written through the PPI's port A at
 * 0xA8: two bits per 16KB page choosing which of four primary slots answers
 * there. Slot 0 holds the BIOS at 0x0000 and MSX BASIC at 0x4000; RAM answers
 * in whichever slot the machine fits it in.
 *
 * The slot number is per *page*, not per access, so the same address reads
 * different silicon depending on a register the interpreter rewrites
 * constantly - MSX BASIC lives in slot 0 and its variables in slot 3, and the
 * BIOS switches between them for every inter-slot call. Anything reading memory
 * from outside the CPU (the debugger, a program injection) therefore has to say
 * which view it wants; {@link readRam} is the RAM one and is what those callers
 * take, because a program and its variables are always in RAM.
 *
 * Secondary slots (selected through 0xFFFF inside an expanded primary) are not
 * modelled - no machine here is expanded. The register is still decoded per
 * page rather than flattened, so a cartridge slot has somewhere to arrive.
 */
export class MsxSlots {
  /** The machine's contiguous RAM, addressed exactly as the CPU sees it. */
  readonly ram: Uint8Array;
  private readonly rom: Uint8Array;
  private readonly ramSlot: number;
  private readonly ramBase: number;
  private readonly slot0Page3: MsxModel['slot0Page3'];
  /** One slot number per page, as the last write to port A set them. */
  private readonly pageSlot = new Uint8Array(PAGE_COUNT);
  private register = 0;

  constructor(rom: Uint8Array, model: MsxModel) {
    this.rom = rom;
    this.ramSlot = model.ramSlot;
    this.slot0Page3 = model.slot0Page3;
    // RAM is fitted at the *top* of the address space: a 64KB machine fills it,
    // a 16KB one answers only in page 3. That is the MSX standard's own rule,
    // and it is why the size of the RAM decides how much of the address space
    // has anything in it at all.
    this.ram = new Uint8Array(model.ramKb * 1024);
    this.ramBase = 0x10000 - this.ram.length;
  }

  reset(): void {
    this.ram.fill(0);
    // Power-on leaves the register at zero, so every page reads slot 0 until
    // the BIOS has searched the slots and written its own configuration.
    this.selectSlots(0);
  }

  /** The value written to PPI port A, one 2-bit slot number per page. */
  selectSlots(value: number): void {
    this.register = value & 0xff;
    for (let page = 0; page < PAGE_COUNT; page++) {
      this.pageSlot[page] = (this.register >> (2 * page)) & 0x03;
    }
  }

  /** Port A reads back the configuration last written to it. */
  slotRegister(): number {
    return this.register;
  }

  read(addr: number): number {
    const a = addr & 0xffff;
    const slot = this.pageSlot[a >> 14]!;
    if (slot === this.ramSlot) return this.readRam(a);
    if (slot === 0) {
      if (a < SYSTEM_ROM_BYTES) return this.rom[a] ?? OPEN_BUS;
      if (a >= 0xc000 && this.slot0Page3 === 'ram-mirror')
        return this.readRam(a);
    }
    return OPEN_BUS; // an empty cartridge slot, or slot 0's unfitted page 2
  }

  write(addr: number, value: number): void {
    const a = addr & 0xffff;
    const slot = this.pageSlot[a >> 14]!;
    const toRam =
      slot === this.ramSlot ||
      (slot === 0 && a >= 0xc000 && this.slot0Page3 === 'ram-mirror');
    if (toRam) this.writeRam(a, value);
    // A write to ROM or to an empty slot is simply dropped, as on the hardware.
  }

  /**
   * Read RAM by CPU address whatever the slot register says, for a caller that
   * is not the CPU. Off the fitted RAM (a 16KB machine's pages 0-2) it reads as
   * open bus rather than wrapping, so a caller cannot mistake an unfitted page
   * for memory.
   */
  readRam = (addr: number): number => {
    const i = (addr & 0xffff) - this.ramBase;
    return i >= 0 ? this.ram[i]! : OPEN_BUS;
  };

  /** The little-endian word at `addr` in RAM, for the workspace pointers. */
  readRamWord = (addr: number): number =>
    this.readRam(addr) | (this.readRam(addr + 1) << 8);

  writeRam(addr: number, value: number): void {
    const i = (addr & 0xffff) - this.ramBase;
    if (i >= 0) this.ram[i] = value & 0xff;
  }

  writeRamWord(addr: number, value: number): void {
    this.writeRam(addr, value & 0xff);
    this.writeRam(addr + 1, (value >> 8) & 0xff);
  }
}
