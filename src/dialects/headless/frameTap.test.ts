import { describe, expect, it } from 'vitest';
import {
  createFrameTap,
  SAMPLE_EVERY_FRAMES,
  type FrameSink,
  type ViewFrame,
} from './frameTap';

/**
 * Sampling a run for a viewer, without the machine.
 *
 * The tap is handed a painter and an encoder, so what it does with them is
 * testable from nothing: no boot, no ROM and no frames. What it does to a real
 * run - which is that it does nothing measurable to it - is pinned where the
 * machine is, in `src/mcp/session.test.ts`.
 */

function recordingSink(
  free = () => true,
  watching = () => true,
): FrameSink & { sent: ViewFrame[] } {
  const sent: ViewFrame[] = [];
  return { sent, watching, free, send: (frame) => sent.push(frame) };
}

/** A painter and encoder that count how often they were reached. */
function stubPainting() {
  const counts = { painted: 0, encoded: 0 };
  return {
    counts,
    paint: () => {
      counts.painted++;
      return { width: 2, height: 1, rgba: new Uint8ClampedArray(8) };
    },
    encodePng: () => {
      counts.encoded++;
      return new Uint8Array([1, 2, 3]);
    },
  };
}

describe('sampling a run', () => {
  it('takes the first frame and then every Nth', () => {
    const sink = recordingSink();
    const painting = stubPainting();
    const tap = createFrameTap({ sink, ...painting, every: 4 });
    for (let i = 0; i < 12; i++) tap.frame();
    // Frames 0, 4 and 8 of the twelve.
    expect(sink.sent.length).toBe(3);
    expect(sink.sent[0]).toEqual({
      width: 2,
      height: 1,
      png: new Uint8Array([1, 2, 3]),
    });
    expect(painting.counts.painted).toBe(3);
  });

  it('samples ten times a second of machine time by default', () => {
    // The frame rate of every machine here is 50 or 60Hz, so the constant is
    // what turns a run into something watchable rather than into compression.
    expect(50 / SAMPLE_EVERY_FRAMES).toBeGreaterThanOrEqual(10);
  });

  it('drops a sample rather than queueing it behind one still on its way', () => {
    let free = true;
    const sink = recordingSink(() => free);
    const painting = stubPainting();
    const tap = createFrameTap({ sink, ...painting, every: 1 });

    tap.frame();
    free = false;
    for (let i = 0; i < 20; i++) tap.frame();
    expect(sink.sent.length).toBe(1);
    // Nothing was painted or encoded for the dropped samples either: a busy
    // viewer costs the run nothing at all.
    expect(painting.counts.painted).toBe(1);

    free = true;
    tap.frame();
    expect(sink.sent.length).toBe(2);
  });

  it('costs a run nothing at all while nobody is watching', () => {
    const sink = recordingSink(
      () => true,
      () => false,
    );
    const painting = stubPainting();
    const tap = createFrameTap({ sink, ...painting, every: 1 });
    for (let i = 0; i < 10; i++) tap.frame();
    tap.settle();
    expect(sink.sent).toEqual([]);
    expect(painting.counts.painted).toBe(0);
    expect(tap.costMs).toBe(0);
  });

  it('sends what the run left, whether or not a sample was due', () => {
    const sink = recordingSink();
    const painting = stubPainting();
    const tap = createFrameTap({ sink, ...painting, every: 100 });
    tap.frame();
    tap.frame();
    expect(sink.sent.length).toBe(1);
    tap.settle();
    // The picture a request leaves behind is the one a viewer looks at until
    // the next request, so it is the sample that is never dropped.
    expect(sink.sent.length).toBe(2);
  });

  it('accounts for what it cost, so a runner can take it back out', () => {
    const sink = recordingSink();
    const tap = createFrameTap({
      sink,
      paint: () => {
        const until = performance.now() + 2;
        while (performance.now() < until);
        return { width: 1, height: 1, rgba: new Uint8ClampedArray(4) };
      },
      encodePng: () => new Uint8Array(1),
      every: 1,
    });
    expect(tap.costMs).toBe(0);
    tap.frame();
    expect(tap.costMs).toBeGreaterThanOrEqual(2);
  });
});
