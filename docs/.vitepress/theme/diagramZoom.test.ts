// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  LEGIBLE_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  clampPan,
  clampScale,
  distance,
  fitScale,
  initialView,
  midpoint,
  openScale,
  panBounds,
  zoomAbout,
} from './diagramZoom';

/** A phone-sized viewer surface, and the two diagram shapes that stress it. */
const PHONE = { width: 390, height: 700 };
const DESKTOP = { width: 1200, height: 800 };
/** The widest flowchart on the architecture page, at mermaid's own scale. */
const WIDE = { width: 2400, height: 300 };
/** A diagram that already fits anywhere. */
const SMALL = { width: 300, height: 200 };

describe('clampScale', () => {
  it('holds the scale inside the viewer’s range', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('fitScale', () => {
  it('fits the constraining axis', () => {
    // Width is the binding constraint here: 390/2400 is far under 700/300.
    expect(fitScale(WIDE, PHONE)).toBeCloseTo(390 / 2400);
    // A tall diagram in a wide viewport is bound by height instead.
    expect(fitScale({ width: 100, height: 1600 }, DESKTOP)).toBeCloseTo(
      800 / 1600,
    );
  });

  it('leaves room for padding on both sides', () => {
    expect(
      fitScale({ width: 100, height: 100 }, { width: 140, height: 500 }, 20),
    ).toBeCloseTo(1);
  });

  it('reports a scale above 1 when the content has room to spare', () => {
    expect(fitScale(SMALL, DESKTOP)).toBeGreaterThan(1);
  });

  it('does not divide by a zero-sized diagram', () => {
    expect(fitScale({ width: 0, height: 0 }, PHONE)).toBe(1);
  });
});

describe('openScale', () => {
  it('keeps a diagram too wide to fit legible rather than fitting it', () => {
    // The whole point of the viewer: fitting this to a phone would be 0.16,
    // which is the illegible inline rendering the reader just tapped to escape.
    expect(fitScale(WIDE, PHONE)).toBeLessThan(LEGIBLE_SCALE);
    expect(openScale(WIDE, PHONE)).toBe(LEGIBLE_SCALE);
  });

  it('opens a diagram that fits at its own size, not stretched to fill', () => {
    expect(openScale(SMALL, DESKTOP)).toBe(1);
  });

  it('uses the fit when it is between legible and natural size', () => {
    // 1000 wide in a 900 viewport: overflows, but only to 0.9 - still worth
    // reading, so the whole diagram is shown rather than cropped to legibility.
    const scale = openScale(
      { width: 1000, height: 400 },
      { width: 900, height: 900 },
    );
    expect(scale).toBeCloseTo(0.9);
  });
});

describe('panBounds', () => {
  it('locks content smaller than the viewport to the centre', () => {
    const { min, max } = panBounds(200, 500);
    expect(min).toBe(150);
    expect(max).toBe(150);
  });

  it('lets larger content travel exactly its overhang', () => {
    expect(panBounds(1200, 500)).toEqual({ min: -700, max: 0 });
  });
});

describe('clampPan', () => {
  it('cannot drag a diagram off the surface', () => {
    const dragged = { scale: 1, x: 5000, y: -5000 };
    const held = clampPan(dragged, WIDE, PHONE);
    // Left edge cannot come in past the viewport's left edge…
    expect(held.x).toBe(0);
    // …and the short axis stays centred rather than sliding away.
    expect(held.y).toBe((PHONE.height - WIDE.height) / 2);
  });

  it('leaves a legal offset untouched', () => {
    const view = { scale: 1, x: -500, y: 200 };
    expect(clampPan(view, WIDE, PHONE).x).toBe(-500);
  });
});

describe('zoomAbout', () => {
  it('holds the focal point still', () => {
    const focal = { x: 300, y: 200 };
    const before = { scale: 1, x: -100, y: -50 };
    const after = zoomAbout(before, 2, focal);
    // The content coordinate under the focal point is unchanged by the zoom.
    const contentBefore = (focal.x - before.x) / before.scale;
    const contentAfter = (focal.x - after.x) / after.scale;
    expect(contentAfter).toBeCloseTo(contentBefore);
    expect(after.scale).toBe(2);
  });

  it('stops dead at the limit instead of drifting', () => {
    const at = { scale: MAX_SCALE, x: -10, y: -10 };
    expect(zoomAbout(at, 4, { x: 100, y: 100 })).toEqual(at);
  });
});

describe('initialView', () => {
  it('opens a wide diagram legible, flush to its leading edge', () => {
    const view = initialView(WIDE, PHONE);
    expect(view.scale).toBe(LEGIBLE_SCALE);
    // Wider than the surface at that scale, so it starts at the left rather
    // than centred on a part of the diagram nobody has read yet.
    expect(view.x).toBe(0);
  });

  it('centres a diagram that fits', () => {
    const view = initialView(SMALL, DESKTOP);
    expect(view.x).toBeCloseTo((DESKTOP.width - SMALL.width) / 2);
    expect(view.y).toBeCloseTo((DESKTOP.height - SMALL.height) / 2);
  });
});

describe('pinch geometry', () => {
  it('measures the span and centre of two fingers', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 30, y: 40 };
    expect(distance(a, b)).toBe(50);
    expect(midpoint(a, b)).toEqual({ x: 15, y: 20 });
  });
});
