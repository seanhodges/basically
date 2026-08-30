// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { Apple2SoftSwitches } from './softSwitches';

describe('Apple2SoftSwitches', () => {
  it('comes up in text, page 1, full screen', () => {
    expect(new Apple2SoftSwitches().mode).toEqual({
      graphics: false,
      mixed: false,
      page2: false,
      hires: false,
    });
  });

  it('throws each flip-flop from its own pair of addresses', () => {
    const s = new Apple2SoftSwitches();
    s.access(0xc050);
    expect(s.graphics).toBe(true);
    s.access(0xc051);
    expect(s.graphics).toBe(false);

    s.access(0xc053);
    expect(s.mixed).toBe(true);
    s.access(0xc052);
    expect(s.mixed).toBe(false);

    s.access(0xc055);
    expect(s.page2).toBe(true);
    s.access(0xc054);
    expect(s.page2).toBe(false);

    s.access(0xc057);
    expect(s.hires).toBe(true);
    s.access(0xc056);
    expect(s.hires).toBe(false);
  });

  it('leaves the annunciators to themselves', () => {
    // $C058-$C05F share the decode block but drive the game connector, so a
    // program pulsing an annunciator must not change what is on screen.
    for (let a = 0xc058; a <= 0xc05f; a++) {
      expect(Apple2SoftSwitches.owns(a)).toBe(false);
    }
    for (let a = 0xc050; a <= 0xc057; a++) {
      expect(Apple2SoftSwitches.owns(a)).toBe(true);
    }
  });
});
