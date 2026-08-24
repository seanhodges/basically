// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { Apple1Pia, CRA, CRB, ORA, ORB } from './pia';

/** The value the monitor writes into both control registers at `$FF09`. */
const MONITOR_CONTROL = 0xa7;

function harness() {
  const written: number[] = [];
  let keyLatch = 0x80;
  let busy = false;
  const pia = new Apple1Pia({
    readPortA: () => keyLatch,
    readPortB: () => (busy ? 0x80 : 0x00),
    writePortB: (v) => written.push(v),
  });
  return {
    pia,
    written,
    setKey: (code: number) => {
      keyLatch = code | 0x80;
      pia.strobeKey();
    },
    setBusy: (b: boolean) => {
      busy = b;
    },
    /** The four writes the monitor makes before it prints anything. */
    bootMonitor: () => {
      pia.write(ORB, 0x7f); // DDRB: PB0-PB6 out, PB7 in
      pia.write(CRA, MONITOR_CONTROL);
      pia.write(CRB, MONITOR_CONTROL);
    },
  };
}

describe('apple1 pia', () => {
  it('reads the data direction register until control bit 2 is set', () => {
    const { pia, written } = harness();
    // The monitor's `STY DSP` at $FF04 lands here, with both control registers
    // still zeroed from reset: it is a DDR write, not a character.
    pia.write(ORB, 0x7f);
    expect(written).toEqual([]);
    expect(pia.read(ORB)).toBe(0x7f);

    pia.write(CRB, MONITOR_CONTROL);
    expect(pia.read(CRB) & 0x3f).toBe(MONITOR_CONTROL & 0x3f);
    pia.write(ORB, 0xc1);
    expect(written).toEqual([0x41]); // PB7 is an input, so seven bits go out
  });

  it('raises the keyboard flag on the strobe and clears it on the read', () => {
    const h = harness();
    h.bootMonitor();
    expect(h.pia.read(CRA) & 0x80).toBe(0);

    h.setKey(0x41);
    expect(h.pia.read(CRA) & 0x80).toBe(0x80);
    expect(h.pia.keyWaiting).toBe(true);
    expect(h.pia.read(ORA)).toBe(0xc1); // PA7 strapped high on the board
    expect(h.pia.read(CRA) & 0x80).toBe(0);
    // The latch keeps the character; only the flag says it was new.
    expect(h.pia.read(ORA)).toBe(0xc1);
  });

  it('reports the display busy line on PB7', () => {
    const h = harness();
    h.bootMonitor();
    expect(h.pia.read(ORB) & 0x80).toBe(0);
    h.setBusy(true);
    expect(h.pia.read(ORB) & 0x80).toBe(0x80);
  });

  it('peeks without taking the key out of the latch', () => {
    const h = harness();
    h.bootMonitor();
    h.setKey(0x42);
    expect(h.pia.peek(CRA) & 0x80).toBe(0x80);
    expect(h.pia.peek(ORA)).toBe(0xc2);
    expect(h.pia.keyWaiting).toBe(true);
  });

  it('comes back to all-inputs on reset', () => {
    const h = harness();
    h.bootMonitor();
    h.setKey(0x41);
    h.pia.reset();
    expect(h.pia.keyWaiting).toBe(false);
    expect(h.pia.read(ORA)).toBe(0); // DDRA again, and it reads back zero
    expect(h.pia.read(ORB)).toBe(0);
  });
});
