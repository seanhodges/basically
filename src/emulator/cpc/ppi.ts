/**
 * The 8255 PPI as the CPC wires it (cpctech "8255cpc"). It sits between the CPU
 * and three subsystems:
 *
 *   Port A (&F4xx)  the AY-3-8912 data bus (bidirectional)
 *   Port B (&F5xx)  inputs: CRTC VSYNC, the 50/60Hz link, the manufacturer id,
 *                   the printer/expansion lines and the cassette read bit
 *   Port C (&F6xx)  outputs: keyboard line select (bits 0-3), cassette motor
 *                   (bit 4) and write (bit 5), and the AY control lines
 *                   BC1 (bit 6) / BDIR (bit 7)
 *
 * The keyboard is physically read *through* the AY: the firmware selects a
 * matrix line on Port C, points the AY at its I/O port A (register 14), and
 * reads it back on Port A. The PPI drives the AY through the {@link PpiHost}
 * seam so this module stays free of chip specifics.
 */

/** The two AY control lines, decoded from Port C bits 7 (BDIR) and 6 (BC1). */
export const enum AyFunction {
  Inactive = 0, // BDIR=0 BC1=0
  Read = 1, //     BDIR=0 BC1=1
  Write = 2, //    BDIR=1 BC1=0
  Select = 3, //   BDIR=1 BC1=1
}

/** Manufacturer id read on Port B bits 1-3; 7 = Amstrad. */
const MANUFACTURER_AMSTRAD = 7;

/** Everything the PPI drives or samples that lives outside it. */
export interface PpiHost {
  /** Latch the AY register number (Port A holds it) for the next access. */
  aySelectRegister(reg: number): void;
  /** Write the AY's selected register with the Port A value. */
  ayWrite(value: number): void;
  /**
   * Read the AY's selected register onto Port A. `keyboardLine` is Port C's low
   * nibble; the host returns the live keyboard matrix line when the AY points at
   * its I/O port (register 14), otherwise the stored register value.
   */
  ayPortRead(keyboardLine: number): number;
  /** True while the CRTC is asserting VSYNC (Port B bit 0). */
  vsyncActive(): boolean;
  /** Cassette read data bit (Port B bit 7); 0 with no tape running. */
  tapeInput(): number;
}

export class Ppi {
  private portA = 0;
  private portC = 0;
  /** Port A direction: true = input (reading the AY), false = output. */
  private portAInput = false;

  constructor(private readonly host: PpiHost) {}

  reset(): void {
    this.portA = 0;
    this.portC = 0;
    // The 8255 powers up with all ports as inputs.
    this.portAInput = true;
  }

  /** The keyboard line currently selected on Port C (low nibble). */
  get keyboardLine(): number {
    return this.portC & 0x0f;
  }

  /** Cassette motor on/off (Port C bit 4) - sampled by the tape layer. */
  get tapeMotorOn(): boolean {
    return (this.portC & 0x10) !== 0;
  }

  /** A CPU write to one of the four PPI registers (`reg` = A/B/C/control 0-3). */
  write(reg: number, value: number): void {
    const v = value & 0xff;
    switch (reg & 0x03) {
      case 0: // Port A: data to the AY (acted on when Port C sets the function)
        this.portA = v;
        break;
      case 1: // Port B is input-only; a write just lands in the (unread) latch
        break;
      case 2: // Port C: keyboard line + cassette + AY control
        this.portC = v;
        this.applyAyFunction();
        break;
      case 3: // control word
        this.writeControl(v);
        break;
    }
  }

  /** A CPU read from one of the four PPI registers. */
  read(reg: number): number {
    switch (reg & 0x03) {
      case 0: // Port A - the AY data bus when configured as input
        return this.portAInput
          ? this.host.ayPortRead(this.keyboardLine)
          : this.portA;
      case 1:
        return this.readPortB();
      case 2:
        return this.portC;
      default:
        return 0xff; // control register is write-only
    }
  }

  /** Compose the Port B input byte from the machine's live signals. */
  private readPortB(): number {
    let b = 0;
    if (this.host.vsyncActive()) b |= 0x01;
    b |= (MANUFACTURER_AMSTRAD & 0x07) << 1; // bits 1-3
    b |= 0x10; // bit 4: 50Hz (PAL)
    b |= 0x20; // bit 5: /EXP high (nothing on the expansion port)
    // bit 6 printer: 0 = ready. bit 7 cassette read:
    if (this.host.tapeInput()) b |= 0x80;
    return b;
  }

  /** Act on the AY control lines currently on Port C, using the Port A latch. */
  private applyAyFunction(): void {
    const fn = (this.portC >> 6) & 0x03;
    switch (fn) {
      case AyFunction.Select:
        this.host.aySelectRegister(this.portA);
        break;
      case AyFunction.Write:
        this.host.ayWrite(this.portA);
        break;
      case AyFunction.Read:
        // Latch the AY/keyboard value onto Port A for the CPU's Port A read.
        this.portA = this.host.ayPortRead(this.keyboardLine);
        break;
      case AyFunction.Inactive:
        break;
    }
  }

  /**
   * The 8255 control register. Bit 7 set = mode-definition (we read only the
   * Port A direction, bit 4); bit 7 clear = bit set/reset on Port C, which the
   * firmware uses to pulse the cassette motor and toggle the AY control lines
   * one bit at a time.
   */
  private writeControl(v: number): void {
    if (v & 0x80) {
      this.portAInput = (v & 0x10) !== 0; // bit 4: 1 = Port A input
    } else {
      const bit = (v >> 1) & 0x07;
      if (v & 0x01) this.portC |= 1 << bit;
      else this.portC &= ~(1 << bit) & 0xff;
      this.applyAyFunction(); // a toggled BC1/BDIR bit can drive the AY
    }
  }
}
