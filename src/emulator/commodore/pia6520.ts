/**
 * A reusable MOS 6520 / 6521 PIA (Peripheral Interface Adapter).
 *
 * The 6520 is two independent 8-bit ports (A and B), each with a data-direction
 * register and a control register, plus two interrupt/handshake control lines
 * per port (CA1/CA2, CB1/CB2). It is the simplest of the Commodore-lineage
 * peripheral chips — the CIA 6526 in the C64 is a much later, timer-heavy
 * relative — so the interrupt-flag / port-latch structure here is a direct but
 * stripped-down parallel of the vendored viciious `target/cias.js` (public
 * domain; see src/emulator/c64/viciious/LICENSE-VICIIOUS.md).
 *
 * The PET drives its keyboard and its 50/60 Hz screen-retrace interrupt through
 * two of these; the VIC-20 reuses the same class. Input pins are supplied by a
 * host-provided {@link PiaPort} so the machine decides what floats on each line
 * (keyboard columns, cassette sense, diagnostic jumper…). The chip has no
 * opinion about the memory map: the machine decodes the four register addresses
 * and forwards {@link Pia6520.read} / {@link Pia6520.write}.
 */

/** Control-register bit masks (identical layout for CRA and CRB). */
const C1_ENABLE = 0x01; // bit 0: CA1/CB1 interrupt enable
// bit 1 (active edge, 0 = high→low, 1 = low→high) is programmable but not
// modelled: the retrace pulse below latches the flag on whichever edge is set.
const DDR_ACCESS = 0x04; // bit 2: 0 → register selects DDR, 1 → peripheral port
const C2_ENABLE = 0x08; // bit 3: CA2/CB2 interrupt enable (input mode)
const C2_DIRECTION = 0x20; // bit 5: 0 = CA2/CB2 input, 1 = output
const C2_FLAG = 0x40; // bit 6: IRQ(A/B)2 flag
const C1_FLAG = 0x80; // bit 7: IRQ(A/B)1 flag
/** The two flag bits are hardware-set and cleared only by a peripheral read. */
const FLAG_BITS = C1_FLAG | C2_FLAG;

/**
 * The external side of one PIA port — the pins as the rest of the machine sees
 * them. {@link read} returns the byte the machine drives onto the pins (only
 * the bits configured as inputs by the DDR are used); {@link write} is invoked
 * whenever the CPU updates the output register, so a machine can react to an
 * output change (e.g. a keyboard row select) immediately.
 */
export interface PiaPort {
  read(): number;
  write?(value: number): void;
}

const FLOATING_HIGH: PiaPort = { read: () => 0xff };

/** One port's live register set. */
interface PortState {
  or: number; // output register (peripheral)
  ddr: number; // data-direction register (1 = output)
  cr: number; // control register (see the C1_*/C2_* masks)
}

function makePort(): PortState {
  return { or: 0, ddr: 0, cr: 0 };
}

export class Pia6520 {
  private a = makePort();
  private b = makePort();
  private readonly portA: PiaPort;
  private readonly portB: PiaPort;

  constructor(opts: { portA?: PiaPort; portB?: PiaPort } = {}) {
    this.portA = opts.portA ?? FLOATING_HIGH;
    this.portB = opts.portB ?? FLOATING_HIGH;
  }

  reset(): void {
    this.a = makePort();
    this.b = makePort();
  }

  /** The output register of port A (masked to its output pins) — the value the
   *  machine reads to learn e.g. which keyboard row the CPU selected. */
  portAOut(): number {
    return this.a.or & this.a.ddr;
  }

  /** The output register of port B (masked to its output pins). */
  portBOut(): number {
    return this.b.or & this.b.ddr;
  }

  /**
   * True while the chip is pulling the (wire-OR'd, active-low) IRQ line: any
   * enabled interrupt flag on either port. The machine ORs this with its other
   * interrupt sources and drives the CPU's level-sensitive IRQ input.
   */
  irqAsserted(): boolean {
    return this.sideIrq(this.a) || this.sideIrq(this.b);
  }

  private sideIrq(p: PortState): boolean {
    if (p.cr & C1_FLAG && p.cr & C1_ENABLE) return true;
    // CA2/CB2 raise an interrupt only when configured as an input.
    if (p.cr & C2_FLAG && p.cr & C2_ENABLE && !(p.cr & C2_DIRECTION)) {
      return true;
    }
    return false;
  }

  /** Pulse the CA1 input, latching IRQA1 (respecting the programmed edge). */
  pulseCa1(): void {
    this.a.cr |= C1_FLAG;
  }

  /** Pulse the CB1 input, latching IRQB1 (respecting the programmed edge). */
  pulseCb1(): void {
    this.b.cr |= C1_FLAG;
  }

  /**
   * Read one of the four registers (address bits 1..0). Reading a peripheral
   * port (when its control register selects the port, not the DDR) clears that
   * port's interrupt flags, exactly as the hardware does — this is how the PET
   * KERNAL's IRQ handler acknowledges the retrace interrupt while scanning the
   * keyboard.
   */
  read(reg: number): number {
    switch (reg & 0x03) {
      case 0:
        return this.readPort(this.a, this.portA);
      case 1:
        return this.a.cr;
      case 2:
        return this.readPort(this.b, this.portB);
      default:
        return this.b.cr;
    }
  }

  private readPort(p: PortState, pins: PiaPort): number {
    if (!(p.cr & DDR_ACCESS)) return p.ddr;
    p.cr &= ~FLAG_BITS; // reading the port clears IRQ flags
    const input = pins.read() & 0xff;
    // Output pins read back the output register; input pins read the wired byte.
    return (p.or & p.ddr) | (input & ~p.ddr & 0xff);
  }

  write(reg: number, value: number): void {
    const v = value & 0xff;
    switch (reg & 0x03) {
      case 0:
        this.writePort(this.a, this.portA, v);
        break;
      case 1:
        // The two flag bits are read-only; the CPU cannot set or clear them.
        this.a.cr = (this.a.cr & FLAG_BITS) | (v & ~FLAG_BITS);
        break;
      case 2:
        this.writePort(this.b, this.portB, v);
        break;
      default:
        this.b.cr = (this.b.cr & FLAG_BITS) | (v & ~FLAG_BITS);
        break;
    }
  }

  private writePort(p: PortState, pins: PiaPort, v: number): void {
    if (!(p.cr & DDR_ACCESS)) {
      p.ddr = v;
      return;
    }
    p.or = v;
    pins.write?.(p.or & p.ddr);
  }
}
