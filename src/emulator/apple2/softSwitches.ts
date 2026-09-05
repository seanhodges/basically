// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple II's display soft switches: four flip-flops at `$C050`-`$C057`.
 *
 * They are switches rather than a register. Each pair of addresses is one
 * flip-flop, the even address clearing it and the odd one setting it, and
 * *touching* the address is what throws it - a read does it as surely as a
 * write, which is why `GR` in Integer BASIC is a `PEEK` in assembly and why a
 * program written in BASIC reaches them at all. Nothing here is readable: the
 * CPU cannot ask which mode the display is in on this machine, so the state
 * lives here and only the renderer consults it.
 *
 * `$C058`-`$C05F` share the same decode block but are not display at all - they
 * are the four annunciator outputs on the game connector, wired to nothing this
 * machine models - so the switch group deliberately stops at `$C057`.
 */

/** The address block the four flip-flops decode from. */
export const DISPLAY_SWITCH_BASE = 0xc050;
export const DISPLAY_SWITCH_TOP = 0xc057;

/** What the renderer needs to know to draw a frame. */
export interface DisplayMode {
  /** `$C050` set graphics, `$C051` back to text. */
  graphics: boolean;
  /** `$C053` keeps four text lines at the foot of a graphics screen. */
  mixed: boolean;
  /** `$C055` shows the second of each mode's two pages. */
  page2: boolean;
  /** `$C057` swaps lo-res blocks for the hi-res raster. */
  hires: boolean;
}

export class Apple2SoftSwitches implements DisplayMode {
  graphics = false;
  mixed = false;
  page2 = false;
  hires = false;

  /**
   * Power-on. The flip-flops themselves come up in no defined state on the
   * hardware, so this is the state the monitor's own reset leaves behind - text,
   * page 1, full screen - rather than a reading of the silicon.
   */
  reset(): void {
    this.graphics = false;
    this.mixed = false;
    this.page2 = false;
    this.hires = false;
  }

  /** Whether this address is one of the four flip-flops. */
  static owns(address: number): boolean {
    return address >= DISPLAY_SWITCH_BASE && address <= DISPLAY_SWITCH_TOP;
  }

  /**
   * Throw the flip-flop this address selects. Bits 2-1 pick which of the four
   * and bit 0 picks clear or set, which is the whole of the decode.
   */
  access(address: number): void {
    const on = (address & 1) === 1;
    switch ((address >> 1) & 3) {
      case 0:
        // The odd address is TXTSET, so the sense is inverted against the
        // others: $C050 turns graphics *on*.
        this.graphics = !on;
        return;
      case 1:
        this.mixed = on;
        return;
      case 2:
        this.page2 = on;
        return;
      default:
        this.hires = on;
    }
  }

  /** A plain snapshot, for the renderer and for tests. */
  get mode(): DisplayMode {
    const { graphics, mixed, page2, hires } = this;
    return { graphics, mixed, page2, hires };
  }
}
