/**
 * A reusable MOS 6522 VIA (Versatile Interface Adapter): two 8-bit ports, two
 * 16-bit timers, an interrupt flag/enable pair and a shift register (stubbed
 * here). The PET has one at $E840 (used for the CB2 sound line and IEEE-488
 * handshaking) and the VIC-20 has two; this class is deliberately minimal but
 * correct for the parts a BASIC machine actually exercises — the timers, the
 * IFR/IER interrupt logic and the parallel ports. Cassette/shift-register/CA2
 * handshake fine detail is left out (see the VIC-20 Stage 2 plan for the jiffy
 * timer completion).
 *
 * Register and interrupt-bit layout follow the standard 6522 datasheet; the
 * enable-mask "set if bit 7, else clear" convention mirrors the CIA's in the
 * vendored viciious `target/cias.js` (public domain).
 */

// Register offsets (address bits 3..0).
const ORB = 0x0;
const ORA = 0x1;
const DDRB = 0x2;
const DDRA = 0x3;
const T1CL = 0x4;
const T1CH = 0x5;
const T1LL = 0x6;
const T1LH = 0x7;
const T2CL = 0x8;
const T2CH = 0x9;
const SR = 0xa;
const ACR = 0xb;
const PCR = 0xc;
const IFR = 0xd;
const IER = 0xe;
const ORA_NH = 0xf; // port A, no handshake

// IFR / IER bit masks.
const IRQ_T1 = 0x40;
const IRQ_T2 = 0x20;
const IRQ_ANY = 0x80;

/** ACR bit 6: Timer 1 free-run (continuous) mode when set, one-shot when clear. */
const ACR_T1_FREERUN = 0x40;

export interface ViaPort {
  read(): number;
  write?(value: number): void;
}

const FLOATING_HIGH: ViaPort = { read: () => 0xff };

export class Via6522 {
  private readonly portA: ViaPort;
  private readonly portB: ViaPort;

  private ora = 0;
  private orb = 0;
  private ddra = 0;
  private ddrb = 0;
  private t1c = 0xffff; // Timer 1 counter
  private t1l = 0xffff; // Timer 1 latch
  private t2c = 0xffff; // Timer 2 counter
  private t2ll = 0; // Timer 2 low latch
  private sr = 0;
  private acr = 0;
  private pcr = 0;
  private ifr = 0;
  private ier = 0;
  private t1Running = false;
  private t2Running = false;

  constructor(opts: { portA?: ViaPort; portB?: ViaPort } = {}) {
    this.portA = opts.portA ?? FLOATING_HIGH;
    this.portB = opts.portB ?? FLOATING_HIGH;
  }

  reset(): void {
    this.ora = this.orb = this.ddra = this.ddrb = 0;
    this.t1c = this.t1l = this.t2c = 0xffff;
    this.t2ll = 0;
    this.sr = this.acr = this.pcr = this.ifr = this.ier = 0;
    this.t1Running = this.t2Running = false;
  }

  /** True while any enabled interrupt flag is set (active-low IRQ line). */
  irqAsserted(): boolean {
    return (this.ifr & this.ier & 0x7f) !== 0;
  }

  /**
   * The CA2 output level. The PCR's CA2 control is bits 3..1: `111` = manual
   * output high, `110` = manual output low (the other codes are handshake
   * modes). On the PET this line selects the character ROM half (POKE 59468,14 /
   * ,12) — high = lower/text set, low = upper/graphics set.
   */
  ca2Out(): boolean {
    return (this.pcr & 0x0e) === 0x0e;
  }

  /** Advance both timers by one clock cycle, latching timer interrupts. */
  tick(): void {
    if (this.t1Running) {
      this.t1c = (this.t1c - 1) & 0xffff;
      if (this.t1c === 0xffff) {
        // Underflowed past zero.
        this.ifr |= IRQ_T1;
        if (this.acr & ACR_T1_FREERUN) this.t1c = this.t1l;
        else this.t1Running = false;
      }
    }
    if (this.t2Running) {
      this.t2c = (this.t2c - 1) & 0xffff;
      if (this.t2c === 0xffff) {
        this.ifr |= IRQ_T2;
        this.t2Running = false; // T2 is one-shot
      }
    }
    this.refreshIrqBit();
  }

  private refreshIrqBit(): void {
    if (this.ifr & this.ier & 0x7f) this.ifr |= IRQ_ANY;
    else this.ifr &= ~IRQ_ANY;
  }

  read(reg: number): number {
    switch (reg & 0x0f) {
      case ORB:
        return (this.orb & this.ddrb) | (this.portB.read() & ~this.ddrb & 0xff);
      case ORA:
      case ORA_NH:
        return (this.ora & this.ddra) | (this.portA.read() & ~this.ddra & 0xff);
      case DDRB:
        return this.ddrb;
      case DDRA:
        return this.ddra;
      case T1CL:
        this.ifr &= ~IRQ_T1; // reading T1 counter low clears the T1 flag
        this.refreshIrqBit();
        return this.t1c & 0xff;
      case T1CH:
        return (this.t1c >> 8) & 0xff;
      case T1LL:
        return this.t1l & 0xff;
      case T1LH:
        return (this.t1l >> 8) & 0xff;
      case T2CL:
        this.ifr &= ~IRQ_T2; // reading T2 counter low clears the T2 flag
        this.refreshIrqBit();
        return this.t2c & 0xff;
      case T2CH:
        return (this.t2c >> 8) & 0xff;
      case SR:
        return this.sr;
      case ACR:
        return this.acr;
      case PCR:
        return this.pcr;
      case IFR:
        return this.ifr;
      case IER:
        return this.ier | 0x80; // bit 7 always reads high
      default:
        return 0;
    }
  }

  write(reg: number, value: number): void {
    const v = value & 0xff;
    switch (reg & 0x0f) {
      case ORB:
        this.orb = v;
        this.portB.write?.(this.orb & this.ddrb);
        break;
      case ORA:
      case ORA_NH:
        this.ora = v;
        this.portA.write?.(this.ora & this.ddra);
        break;
      case DDRB:
        this.ddrb = v;
        break;
      case DDRA:
        this.ddra = v;
        break;
      case T1CL:
      case T1LL:
        this.t1l = (this.t1l & 0xff00) | v;
        break;
      case T1CH:
        this.t1l = (this.t1l & 0x00ff) | (v << 8);
        this.t1c = this.t1l; // load counter from latch and start
        this.ifr &= ~IRQ_T1;
        this.t1Running = true;
        this.refreshIrqBit();
        break;
      case T1LH:
        this.t1l = (this.t1l & 0x00ff) | (v << 8);
        this.ifr &= ~IRQ_T1;
        this.refreshIrqBit();
        break;
      case T2CL:
        this.t2ll = v;
        break;
      case T2CH:
        this.t2c = (v << 8) | this.t2ll; // load counter and start
        this.ifr &= ~IRQ_T2;
        this.t2Running = true;
        this.refreshIrqBit();
        break;
      case SR:
        this.sr = v;
        break;
      case ACR:
        this.acr = v;
        break;
      case PCR:
        this.pcr = v;
        break;
      case IFR:
        // Writing 1s clears the corresponding flags.
        this.ifr &= ~(v & 0x7f);
        this.refreshIrqBit();
        break;
      case IER:
        if (v & 0x80) this.ier |= v & 0x7f;
        else this.ier &= ~(v & 0x7f);
        this.refreshIrqBit();
        break;
      default:
        break;
    }
  }
}
