/**
 * AY-3-8912 PSG register file.
 *
 * The chip exposes 16 registers (three square-wave tone channels + noise +
 * envelope + mixer + two I/O ports). On the 128K they are reached through two
 * ports: the register number is latched by an OUT to 0xFFFD, then the selected
 * register is written via 0xBFFD (and read back via 0xFFFD). BASIC's PLAY and
 * the 128 BEEP drive it.
 *
 * Stage 2 needs only the register file so the I/O writes are absorbed and PLAY
 * runs without faulting; actual sound *output* is Stage 5 and requires a new
 * audio-out seam on MachineEmulator (the contract has none today — neither the
 * 48K beeper nor the AY is audible). See docs/dialect-plans/zxspectrum128.md.
 */

/**
 * Write masks per register (some are narrower than 8 bits): tone fine = 8 bits,
 * tone coarse (1/3/5) = 4 bits, noise (6) = 5 bits, mixer (7) = 8 bits, volume
 * (8/9/10) = 5 bits, envelope period (11/12) = 8 bits, envelope shape (13) =
 * 4 bits, I/O ports (14/15) = 8 bits.
 */
const REG_MASKS = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff, 0x1f, 0x1f, 0x1f, 0xff, 0xff,
  0x0f, 0xff, 0xff,
];

export class Ay38912 {
  private readonly regs = new Uint8Array(16);
  private selected = 0;

  /** OUT to 0xFFFD: latch the register number to read or write next (0-15). */
  selectRegister(reg: number): void {
    this.selected = reg & 0x0f;
  }

  /** OUT to 0xBFFD: write the latched register. */
  writeData(value: number): void {
    this.writeRegister(this.selected, value);
  }

  /** IN from 0xFFFD: read the latched register. */
  readData(): number {
    return this.readRegister(this.selected);
  }

  writeRegister(reg: number, value: number): void {
    const r = reg & 0x0f;
    this.regs[r] = value & REG_MASKS[r]!;
  }

  readRegister(reg: number): number {
    return this.regs[reg & 0x0f]!;
  }

  reset(): void {
    this.regs.fill(0);
    this.selected = 0;
  }
}
