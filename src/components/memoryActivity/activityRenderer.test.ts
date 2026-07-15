import { describe, expect, it } from 'vitest';
import type { Band } from '../memoryBands';
import { bandLayout } from './bandLayout';
import {
  ActivityRenderer,
  READ_COLOR,
  WRITE_COLOR,
  type RendererDims,
} from './activityRenderer';
import { READ_BIT, WRITE_BIT } from '../../emulator/memoryActivityBuffer';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  fillStyle: string;
}

/** A minimal 2D-context stub that records the fillRects a draw pass emits. */
function stubCtx() {
  const rects: Rect[] = [];
  let clears = 0;
  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000',
    clearRect() {
      clears++;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({
        x,
        y,
        w,
        h,
        alpha: (ctx as { globalAlpha: number }).globalAlpha,
        fillStyle: (ctx as { fillStyle: string }).fillStyle,
      });
    },
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    rects,
    clearCount: () => clears,
    reset: () => {
      rects.length = 0;
    },
  };
}

const band = (start: number, end: number): Band => ({
  key: `${start}`,
  label: `${start}`,
  kind: 'program',
  start,
  end,
  leaves: [],
});

const GEO = bandLayout([band(0, 0xffff)], () => 100, 0);
const DIMS: RendererDims = { width: 40, height: 100, dpr: 1 };

const hits = (map: Record<number, number>) => {
  const a = new Uint8Array(0x10000);
  for (const [addr, bits] of Object.entries(map)) a[Number(addr)] = bits;
  return a;
};

describe('ActivityRenderer', () => {
  it('draws a read hit as a teal line at the address row', () => {
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, GEO, DIMS);
    r.ingest(hits({ 0: READ_BIT })); // address 0 -> row 0
    r.step();

    const teal = s.rects.filter((x) => x.fillStyle === READ_COLOR);
    expect(teal).toHaveLength(1);
    expect(teal[0]!.y).toBe(0);
    expect(teal[0]!.w).toBe(40); // full CSS width at dpr 1
    // Decays once before the first draw (~0.9).
    expect(teal[0]!.alpha).toBeCloseTo(0.9, 5);
  });

  it('draws a write hit as a coral line', () => {
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, GEO, DIMS);
    // 0x4020's 10-address group sits squarely within row 25 (64K over 100px).
    r.ingest(hits({ 0x4020: WRITE_BIT }));
    r.step();

    const coral = s.rects.filter((x) => x.fillStyle === WRITE_COLOR);
    expect(coral).toHaveLength(1);
    expect(coral[0]!.y).toBe(25);
  });

  it('lights the whole 10-address group as one thick line', () => {
    // 100 addresses over 100px = 1px per address, so a 10-address group spans
    // 10 rows: any hit inside it lights rows 0..9 as a solid block.
    const geo = bandLayout([band(0, 99)], () => 100, 0);
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, geo, DIMS);
    r.ingest(hits({ 5: READ_BIT })); // address 5 -> group 0 (addresses 0-9)
    r.step();

    const teal = s.rects.filter((x) => x.fillStyle === READ_COLOR);
    expect(teal.map((x) => x.y).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('fades a line out over successive steps', () => {
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, GEO, DIMS);
    r.ingest(hits({ 0: READ_BIT }));

    r.step();
    const a1 = s.rects.find((x) => x.fillStyle === READ_COLOR)!.alpha;
    s.reset();
    r.step();
    const a2 = s.rects.find((x) => x.fillStyle === READ_COLOR)!.alpha;
    expect(a2).toBeCloseTo(a1 * 0.9, 5);

    // After enough decay the row falls below threshold and stops drawing.
    for (let i = 0; i < 60; i++) r.step();
    s.reset();
    r.step();
    expect(s.rects.filter((x) => x.fillStyle === READ_COLOR)).toHaveLength(0);
  });

  it('an address touched by both read and write draws coral on top', () => {
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, GEO, DIMS);
    r.ingest(hits({ 0: READ_BIT | WRITE_BIT }));
    r.step();
    const atRow0 = s.rects.filter((x) => x.y === 0);
    // Both colours drawn; coral (write) is painted after teal (read).
    expect(atRow0.map((x) => x.fillStyle)).toEqual([READ_COLOR, WRITE_COLOR]);
  });

  it('clears the canvas every step', () => {
    const s = stubCtx();
    const r = new ActivityRenderer(s.ctx, GEO, DIMS);
    r.step();
    r.step();
    expect(s.clearCount()).toBe(2);
  });
});
