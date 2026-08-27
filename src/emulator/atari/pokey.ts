// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The POKEY: the keyboard, the four timers, the noise source and the sound.
 *
 * Everything POKEY does it does with counters. The keyboard is a counter
 * scanning a matrix, which stops on a pressed key and leaves its position in
 * KBCODE; the timers are counters dividing one of three clocks; RANDOM is a
 * 17-bit shift register free-running at the CPU clock. The one thing it does
 * not do here is the serial bus - this machine has no disk drive or cassette
 * fitted, so nothing ever answers, and the OS's SIO finds an empty bus.
 *
 * Sound is synthesized separately, in `./pokeyAudio`, from the registers this
 * chip holds; the split is the one the VIC-20 and C64 machines already use.
 *
 * ### Reading and writing are different chips
 *
 * As on GTIA, an address is one register out and another in: $D20A is STIMER
 * when written and RANDOM when read, $D20E is IRQEN out and IRQST in. The two
 * paths below therefore share nothing.
 */

/** Write-side register offsets. */
const AUDF1 = 0x00;
const AUDCTL = 0x08;
const STIMER = 0x09;
const SKRES = 0x0a;
const SEROUT = 0x0d;
const IRQEN = 0x0e;
const SKCTL = 0x0f;

/** Read-side register offsets. */
const ALLPOT = 0x08;
const KBCODE = 0x09;
const RANDOM = 0x0a;
const IRQST = 0x0e;
const SKSTAT = 0x0f;

/** IRQ sources, as bits of IRQEN and (active low) IRQST. */
const IRQ_TIMER1 = 0x01;
const IRQ_TIMER2 = 0x02;
const IRQ_TIMER4 = 0x04;
const IRQ_SEROC = 0x08;
const IRQ_SEROR = 0x10;
const IRQ_KEY = 0x40;
const IRQ_BREAK = 0x80;

/** SKSTAT bits, all active low. */
const SK_SHIFT = 0x08;
const SK_KEY_DOWN = 0x04;
const SK_OVERRUN = 0x40;
/** What SKSTAT reads with nothing held and no serial activity. */
const SK_IDLE = 0xef;

/** KBCODE's two modifier bits, which sit above the six-bit key position. */
export const KB_SHIFT = 0x40;
export const KB_CTRL = 0x80;

/**
 * The period of the 17-bit polynomial counter behind RANDOM. Its taps are
 * x^17 + x^12 + 1, which {@link Pokey.random} applies as bits 16 and 11.
 */
const POLY17_PERIOD = 0x1ffff;

/**
 * CPU cycles per step of POKEY's two slow clocks. The chip divides the system
 * clock by 28 for the "64 kHz" clock and by 114 - one scanline - for the
 * "15 kHz" one, so neither is quite the round number it is named after.
 */
const DIVIDER_64K = 28;
const DIVIDER_15K = 114;

/**
 * What a timer's period is on the fast clock, over and above the divisor. The
 * counter reloads a cycle later than on the slow clocks, so the chip's own
 * documentation gives the fast-clock period as AUDF + 4 rather than AUDF + 1.
 */
const FAST_CLOCK_BIAS = 4;

/**
 * CPU cycles one byte takes to leave the serial port: ten bit times at the
 * 19200 baud the OS drives the peripheral bus at.
 *
 * The transmitter is modelled and the receiver is not, because that is the
 * machine this dialect emulates - a console with nothing on its serial bus.
 * The OS still sends its boot request, and still has to be told the bytes went
 * out, or SIO waits for a transmission that never completes and the machine
 * never reaches BASIC at all. What it gets back is silence, which is what an
 * empty bus sounds like: SIO times out, retries, gives up, and starts the
 * cartridge.
 */
const SERIAL_BYTE_CYCLES = Math.round((10 * 1_773_447) / 19200);

export class Pokey {
  private readonly audf = new Uint8Array(4);
  private readonly audc = new Uint8Array(4);
  private audctl = 0;
  private irqen = 0;
  private irqst = 0xff;
  private skctl = 0;
  private skstat = SK_IDLE;
  private kbcode = 0;

  /** Cycles the chip has been ticked to, and where the shift register got to. */
  private cycles = 0;
  private polyCycles = 0;
  private poly = 0x1ffff;

  /** Cycles each timer has left to run before it reloads. */
  private readonly timerDue = [0, 0, 0, 0];

  /** Cycles left before the byte in the serial output register has gone. */
  private serialDue = 0;

  /** The key held at the emulated keyboard, or -1 for none. */
  private heldKey = -1;
  private heldShift = false;
  private heldBreak = false;
  /** The code last delivered, so a held key raises one interrupt, not fifty. */
  private deliveredKey = -1;

  constructor(
    /** Pulse the CPU's IRQ line. Level-sensitive, so it is re-asserted. */
    private readonly setIrq: (asserted: boolean) => void,
  ) {}

  reset(): void {
    this.audf.fill(0);
    this.audc.fill(0);
    this.audctl = 0;
    this.irqen = 0;
    this.irqst = 0xff;
    this.skctl = 0;
    this.skstat = SK_IDLE;
    this.kbcode = 0;
    this.cycles = 0;
    this.polyCycles = 0;
    this.poly = 0x1ffff;
    this.timerDue.fill(0);
    this.serialDue = 0;
    this.heldKey = -1;
    this.heldShift = false;
    this.heldBreak = false;
    this.deliveredKey = -1;
    this.setIrq(false);
  }

  /** A register, for the audio renderer's side-effect-free read. */
  audioRegister(reg: number): number {
    if (reg === AUDCTL) return this.audctl;
    return reg & 1 ? this.audc[reg >> 1]! : this.audf[reg >> 1]!;
  }

  read(reg: number): number {
    switch (reg) {
      case KBCODE:
        return this.kbcode;
      case RANDOM:
        return this.random();
      case IRQST:
        return this.irqst;
      case SKSTAT:
        return this.skstat;
      case ALLPOT:
        // No paddles are plugged in, so every pot line stays high.
        return 0xff;
      default:
        // The eight pot registers read as an unturned paddle at centre-scale;
        // everything else on this side of the chip is the serial port.
        return reg < ALLPOT ? 0xe4 : 0xff;
    }
  }

  write(reg: number, value: number): void {
    const byte = value & 0xff;
    if (reg < AUDCTL) {
      if (reg & 1) this.audc[reg >> 1] = byte;
      else this.audf[reg >> 1] = byte;
      return;
    }
    switch (reg) {
      case AUDCTL:
        this.audctl = byte;
        return;
      case STIMER:
        // Any write reloads all four counters from their AUDF registers.
        for (let t = 0; t < 4; t++) this.timerDue[t] = this.timerPeriod(t);
        return;
      case SKRES:
        this.skstat |= SK_OVERRUN;
        return;
      case SEROUT:
        // The byte is now in the shift register, so neither "ready for the
        // next one" nor "all of it has gone" is true again until it is out.
        this.serialDue = SERIAL_BYTE_CYCLES;
        this.irqst |= IRQ_SEROR | IRQ_SEROC;
        this.updateIrq();
        return;
      case IRQEN:
        this.irqen = byte;
        // Clearing an enable bit also clears its pending interrupt: IRQST's
        // bits are held low by the enable, and go back high the moment it does.
        this.irqst |= ~byte & 0xff;
        this.updateIrq();
        return;
      case SKCTL:
        this.skctl = byte;
        return;
      default:
        return;
    }
  }

  /**
   * The 17-bit polynomial counter, advanced to now.
   *
   * The chip clocks it every system cycle, which is far too often to step one
   * at a time, so it is caught up on demand instead - the value a program reads
   * is the same either way. Holding SKCTL's two low bits at zero keeps the
   * counters in reset, which is how the OS stops the chip while it reprograms
   * it, and RANDOM then reads as all ones.
   */
  private random(): number {
    if ((this.skctl & 0x03) === 0) return 0xff;
    let steps = (this.cycles - this.polyCycles) % POLY17_PERIOD;
    this.polyCycles = this.cycles;
    let poly = this.poly;
    while (steps-- > 0) {
      const feedback = ((poly >> 16) ^ (poly >> 11)) & 1;
      poly = ((poly << 1) | feedback) & POLY17_PERIOD;
    }
    this.poly = poly;
    return (poly >> 9) & 0xff;
  }

  /** How many CPU cycles timer `t` runs for between reloads. */
  private timerPeriod(t: number): number {
    const divisor = this.audctl & 0x01 ? DIVIDER_15K : DIVIDER_64K;
    // AUDCTL bits 6 and 5 put channels 1 and 3 on the system clock instead.
    const fast =
      (t === 0 && this.audctl & 0x40) || (t === 2 && this.audctl & 0x20);
    if (fast) return this.audf[t]! + FAST_CLOCK_BIAS;
    // Bits 4 and 3 join 1 into 2 and 3 into 4 as sixteen-bit counters, so the
    // low half never reloads on its own.
    if (t === 1 && this.audctl & 0x10) {
      return ((this.audf[1]! << 8) | this.audf[0]!) * divisor + divisor;
    }
    if (t === 3 && this.audctl & 0x08) {
      return ((this.audf[3]! << 8) | this.audf[2]!) * divisor + divisor;
    }
    return (this.audf[t]! + 1) * divisor;
  }

  /**
   * Advance the timers by a scanline's worth of cycles.
   *
   * A scanline rather than a cycle: the fastest interrupt a program can ask for
   * is still slower than a line, and running four counters on the CPU's own hot
   * path would cost every machine cycle something for a feature almost nothing
   * uses. What it buys is that a timer interrupt lands within a scanline of
   * where the chip would have raised it.
   */
  tick(cycles: number): void {
    this.cycles += cycles;
    if (this.serialDue > 0) this.serialDue -= cycles;
    // Both serial output interrupts are levels rather than edges: the shift
    // register being empty is a state, and it holds IRQST low for as long as
    // the OS has the interrupt enabled. Modelling them as edges would lose the
    // one raised between the OS writing the last byte and enabling the
    // interrupt it means to wait on.
    if (this.serialDue <= 0) {
      const idle = this.irqen & (IRQ_SEROR | IRQ_SEROC);
      if (idle !== 0) {
        this.irqst &= ~idle;
        this.updateIrq();
      }
    }
    const joined1 = (this.audctl & 0x10) !== 0;
    const joined3 = (this.audctl & 0x08) !== 0;
    for (let t = 0; t < 4; t++) {
      // The low half of a joined pair has no interrupt of its own.
      if ((t === 0 && joined1) || (t === 2 && joined3)) continue;
      const bit =
        t === 0 ? IRQ_TIMER1 : t === 1 ? IRQ_TIMER2 : t === 3 ? IRQ_TIMER4 : 0;
      if (bit === 0) continue;
      const period = this.timerPeriod(t);
      if (period <= 0) continue;
      this.timerDue[t] = this.timerDue[t]! - cycles;
      if (this.timerDue[t]! > 0) continue;
      // Catch up rather than firing once per scanline however far behind.
      do this.timerDue[t] = this.timerDue[t]! + period;
      while (this.timerDue[t]! <= 0);
      if (this.irqen & bit) {
        this.irqst &= ~bit;
        this.updateIrq();
      }
    }
  }

  /**
   * Hand the chip the key the user is holding, once a frame.
   *
   * `code` is a KBCODE value - a six-bit key position with {@link KB_SHIFT} and
   * {@link KB_CTRL} above it - or -1 for none. An interrupt is raised only when
   * the code changes, because the chip's own debounce delivers one press per
   * key and it is the OS that repeats a held one; re-raising every frame would
   * turn one keypress into fifty.
   */
  setKeyState(code: number, shift: boolean, breakKey: boolean): void {
    if (breakKey && !this.heldBreak && this.irqen & IRQ_BREAK) {
      this.irqst &= ~IRQ_BREAK;
      this.updateIrq();
    }
    this.heldBreak = breakKey;
    this.heldShift = shift;

    this.skstat |= SK_SHIFT | SK_KEY_DOWN;
    if (shift) this.skstat &= ~SK_SHIFT;

    this.heldKey = code;
    if (code < 0) {
      this.deliveredKey = -1;
      return;
    }
    this.skstat &= ~SK_KEY_DOWN;
    // A change of shift or control alone is not a new key.
    if (((code ^ this.deliveredKey) & ~(KB_SHIFT | KB_CTRL)) === 0) return;
    this.deliveredKey = code;
    this.kbcode = code;
    if ((this.irqen & IRQ_KEY) === 0) return;
    if (this.irqst & IRQ_KEY) {
      this.irqst &= ~IRQ_KEY;
      this.updateIrq();
    } else {
      // The last keypress has not been read yet: the chip reports an overrun
      // rather than losing count of how many interrupts it owes.
      this.skstat &= ~SK_OVERRUN;
    }
  }

  /** Whether any key is being held, for the machine's own debounce. */
  keyHeld(): boolean {
    return this.heldKey >= 0 || this.heldShift || this.heldBreak;
  }

  private updateIrq(): void {
    this.setIrq((this.irqst & 0xff) !== 0xff);
  }
}

export { AUDF1 as POKEY_AUDF1, IRQEN as POKEY_IRQEN };
