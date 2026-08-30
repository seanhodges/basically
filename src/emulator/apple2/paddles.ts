// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The game connector: three buttons the CPU can read directly, and four
 * potentiometers it can only *time*.
 *
 * The buttons are the easy half - `$C061`-`$C063` return bit 7 set while the
 * button is down, and nothing else - so a fire button is one `BIT`.
 *
 * The paddles are the machine's most Woz-like economy. There is no
 * analogue-to-digital converter: each pot sits in the timing network of one
 * section of a 558 quad timer, and `$C070` fires all four one-shots at once.
 * `$C064`-`$C067` then return bit 7 set for as long as that pot's one-shot is
 * still timing out, so the *position* of a paddle is a *duration*, and reading
 * it means counting. The monitor's `PREAD` at `$FB1E` is that counter: it
 * triggers, then loops on `LDA $C064,X / BPL done / INY / BNE loop` until the
 * bit falls, and hands back the iteration count 0-255. Integer BASIC's `PDL(n)`
 * is a call to it.
 *
 * So a paddle's value is modelled here as the duration `PREAD` would measure.
 * The loop is eleven cycles, and ten more pass between the trigger and its
 * first read, which makes the one-shot for value `v` exactly
 * `11 x v + 10` cycles long: read at cycle 10 it is already low for `v = 0`,
 * and it survives exactly 255 more iterations for `v = 255`. Calibrating
 * against the routine that does the reading, rather than against the 0.022uF
 * and 150k the timing network actually used, is what makes `PDL(0)` in BASIC
 * answer with the number the host set.
 *
 * `$C060` is not a paddle. It is the cassette input, shared with a fourth
 * switch input; with no tape running it reads low.
 */

/** Cycles of one-shot per unit of paddle value: `PREAD`'s loop. */
export const PADDLE_CYCLES_PER_UNIT = 11;

/** Cycles between `$C070` and `PREAD`'s first read of the timer. */
export const PADDLE_TRIGGER_LEAD = 10;

/** Paddles wired to the connector, and buttons alongside them. */
export const PADDLE_COUNT = 4;
export const BUTTON_COUNT = 3;

/** Where each group of inputs is read. */
const CASSETTE_IN = 0xc060;
const BUTTON_BASE = 0xc061;
const PADDLE_BASE = 0xc064;

/** The bit every one of these inputs reports itself in. */
const SET = 0x80;

export class Apple2Paddles {
  /** Where each pot is set, in the 0-255 `PREAD` answers with. */
  private readonly values = new Uint8Array(PADDLE_COUNT);
  private readonly buttons = [false, false, false];
  /**
   * Free-running cycle count at the last `$C070`, or null before the first
   * trigger - in which case every one-shot has long since timed out.
   */
  private triggeredAt: number | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    // Mid-travel, which is where a self-centring stick sits and what an
    // untouched paddle input reads as.
    this.values.fill(0x80);
    this.buttons.fill(false);
    this.triggeredAt = null;
  }

  /** Set one pot's position, 0-255. */
  setPaddle(index: number, value: number): void {
    if (index < 0 || index >= PADDLE_COUNT) return;
    this.values[index] = Math.max(0, Math.min(255, Math.round(value)));
  }

  /** Press or release one of the three buttons. */
  setButton(index: number, down: boolean): void {
    if (index < 0 || index >= BUTTON_COUNT) return;
    this.buttons[index] = down;
  }

  /** `$C070`: fire all four one-shots from `now`. */
  trigger(now: number): void {
    this.triggeredAt = now;
  }

  /**
   * A read anywhere in `$C060`-`$C06F`, with the free-running cycle count the
   * read happens at. The group repeats every eight addresses, which is the
   * whole of the decode.
   */
  read(address: number, now: number): number {
    const a = 0xc060 | (address & 0x07);
    if (a === CASSETTE_IN) return 0; // no tape deck on the other end yet
    if (a < PADDLE_BASE) return this.buttons[a - BUTTON_BASE] ? SET : 0;
    return this.timerHigh(a - PADDLE_BASE, now) ? SET : 0;
  }

  /** Whether pot `index`'s one-shot is still timing out at cycle `now`. */
  timerHigh(index: number, now: number): boolean {
    if (this.triggeredAt === null) return false;
    const elapsed = now - this.triggeredAt;
    const period =
      PADDLE_CYCLES_PER_UNIT * this.values[index]! + PADDLE_TRIGGER_LEAD;
    return elapsed >= 0 && elapsed < period;
  }
}
